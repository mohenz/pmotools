import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { query, withTransaction } from "@/lib/server/db";
import { DomainError } from "@/lib/server/items";

export type CommonCodeGroup = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  codeCount: number;
  activeCodeCount: number;
};

export type CommonCode = {
  id: string;
  groupId: string;
  groupCode: string;
  groupLabel: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  minScore: number | null;
};

const codePattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const createGroupSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(codePattern),
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999),
});
const updateGroupSchema = z.object({
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
});
const createCodeSchema = z.object({
  groupId: z.string().uuid(),
  code: z.string().trim().min(1).max(50).regex(codePattern),
  label: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0).max(9999),
  minScore: z.number().int().min(1).max(9).nullable().optional(),
});
const updateCodeSchema = z.object({
  label: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
  minScore: z.number().int().min(1).max(9).nullable().optional(),
});

const selectCodes = `select code.id,code.group_id as "groupId",group_master.code as "groupCode",group_master.label as "groupLabel",
  code.code,code.label,code.sort_order as "sortOrder",code.is_active as "isActive",
  case when group_master.code='escalation_level' then (code.metadata->>'minScore')::int end as "minScore"
  from project_tool.common_codes code join project_tool.common_code_groups group_master on group_master.id=code.group_id`;

export async function listCommonCodeGroups(projectId: string) {
  const result = await query<CommonCodeGroup>(
    `select group_master.id,group_master.code,group_master.label,group_master.description,
       group_master.sort_order as "sortOrder",group_master.is_active as "isActive",group_master.is_system as "isSystem",
       count(code.id)::int as "codeCount",count(code.id) filter(where code.is_active)::int as "activeCodeCount"
     from project_tool.common_code_groups group_master
     left join project_tool.common_codes code on code.group_id=group_master.id
     where group_master.project_id=$1
     group by group_master.id order by group_master.sort_order,group_master.label`,
    [projectId],
  );
  return result.rows;
}

export async function listCommonCodes(projectId: string, includeInactive = true, groupId?: string) {
  const params: unknown[] = [projectId];
  let filters = includeInactive ? "" : "and code.is_active and group_master.is_active";
  if (groupId) { params.push(groupId); filters += ` and group_master.id=$${params.length}`; }
  const result = await query<CommonCode>(
    `${selectCodes} where group_master.project_id=$1 ${filters} order by group_master.sort_order,code.sort_order,code.label`,
    params,
  );
  return result.rows;
}

export async function getCodeOptions(projectId: string) {
  const codes = await listCommonCodes(projectId, false);
  return {
    categories: codes.filter((code) => code.groupCode === "category"),
    tracks: codes.filter((code) => code.groupCode === "track"),
    escalations: codes.filter((code) => code.groupCode === "escalation_level"),
  };
}

async function assertAdmin(client: PoolClient, projectId: string, userId: string) {
  const result = await client.query(`select 1 from project_tool.project_members where project_id=$1 and user_id=$2 and role='pmo_admin'`, [projectId, userId]);
  if (!result.rowCount) throw new DomainError("FORBIDDEN", "공통코드 설정 권한이 없습니다.");
}
async function setAuditContext(client: PoolClient, userId: string, requestId: string) {
  await client.query(`select set_config('app.actor_id',$1,true),set_config('app.request_id',$2,true)`, [userId, requestId]);
}
function metadata(groupCode: string, minScore: number | null | undefined) {
  if (groupCode !== "escalation_level") return {};
  if (minScore == null) throw new DomainError("INVALID_CODE", "에스컬레이션 레벨에는 최소 점수가 필요합니다.");
  return { minScore };
}

export async function createCommonCodeGroup(projectId: string, userId: string, input: unknown) {
  const data = createGroupSchema.parse(input); const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertAdmin(client, projectId, userId); await setAuditContext(client, userId, requestId);
    try {
      const result = await client.query<CommonCodeGroup>(
        `insert into project_tool.common_code_groups(project_id,code,label,description,sort_order)
         values($1,$2,$3,$4,$5) returning id,code,label,description,sort_order as "sortOrder",is_active as "isActive",is_system as "isSystem",0::int as "codeCount",0::int as "activeCodeCount"`,
        [projectId, data.code, data.label, data.description || null, data.sortOrder],
      );
      return { group: result.rows[0], requestId };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DomainError("DUPLICATE_CODE", "동일한 그룹 코드가 이미 존재합니다.");
      throw error;
    }
  });
}

export async function updateCommonCodeGroup(projectId: string, userId: string, groupId: string, input: unknown) {
  const data = updateGroupSchema.parse(input); const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertAdmin(client, projectId, userId);
    const current = await client.query<{ isSystem: boolean }>(`select is_system as "isSystem" from project_tool.common_code_groups where id=$1 and project_id=$2`, [groupId, projectId]);
    if (!current.rowCount) throw new DomainError("NOT_FOUND", "코드 그룹을 찾을 수 없습니다.");
    if (current.rows[0].isSystem && !data.isActive) throw new DomainError("INVALID_CODE", "시스템 코드 그룹은 비활성화할 수 없습니다.");
    await setAuditContext(client, userId, requestId);
    const result = await client.query<CommonCodeGroup>(
      `update project_tool.common_code_groups set label=$1,description=$2,sort_order=$3,is_active=$4 where id=$5 and project_id=$6
       returning id,code,label,description,sort_order as "sortOrder",is_active as "isActive",is_system as "isSystem",
       (select count(*)::int from project_tool.common_codes where group_id=$5) as "codeCount",
       (select count(*)::int from project_tool.common_codes where group_id=$5 and is_active) as "activeCodeCount"`,
      [data.label, data.description || null, data.sortOrder, data.isActive, groupId, projectId],
    );
    return { group: result.rows[0], requestId };
  });
}

export async function createCommonCode(projectId: string, userId: string, input: unknown) {
  const data = createCodeSchema.parse(input); const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertAdmin(client, projectId, userId);
    const group = await client.query<{ code: string }>(`select code from project_tool.common_code_groups where id=$1 and project_id=$2`, [data.groupId, projectId]);
    if (!group.rowCount) throw new DomainError("NOT_FOUND", "코드 그룹을 찾을 수 없습니다.");
    await setAuditContext(client, userId, requestId);
    try {
      const result = await client.query<{ id: string }>(
        `insert into project_tool.common_codes(project_id,group_id,code,label,sort_order,metadata) values($1,$2,$3,$4,$5,$6) returning id`,
        [projectId, data.groupId, data.code, data.label, data.sortOrder, metadata(group.rows[0].code, data.minScore)],
      );
      const created = await client.query<CommonCode>(`${selectCodes} where code.id=$1`, [result.rows[0].id]);
      return { code: created.rows[0], requestId };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DomainError("DUPLICATE_CODE", "그룹 내 동일한 코드 또는 최소 점수가 이미 존재합니다.");
      throw error;
    }
  });
}

export async function updateCommonCode(projectId: string, userId: string, codeId: string, input: unknown) {
  const data = updateCodeSchema.parse(input); const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertAdmin(client, projectId, userId);
    const current = await client.query<{ groupId: string; groupCode: string; isActive: boolean }>(
      `select code.group_id as "groupId",group_master.code as "groupCode",code.is_active as "isActive"
       from project_tool.common_codes code join project_tool.common_code_groups group_master on group_master.id=code.group_id
       where code.id=$1 and code.project_id=$2`, [codeId, projectId],
    );
    if (!current.rowCount) throw new DomainError("NOT_FOUND", "공통코드를 찾을 수 없습니다.");
    if (current.rows[0].isActive && !data.isActive) {
      const active = await client.query<{ count: number }>(`select count(*)::int as count from project_tool.common_codes where group_id=$1 and is_active and id<>$2`, [current.rows[0].groupId, codeId]);
      if (active.rows[0].count === 0) throw new DomainError("LAST_ACTIVE_CODE", "그룹에는 하나 이상의 활성 코드가 필요합니다.");
    }
    await setAuditContext(client, userId, requestId);
    try {
      await client.query(`update project_tool.common_codes set label=$1,sort_order=$2,is_active=$3,metadata=$4 where id=$5 and project_id=$6`,
        [data.label, data.sortOrder, data.isActive, metadata(current.rows[0].groupCode, data.minScore), codeId, projectId]);
      const updated = await client.query<CommonCode>(`${selectCodes} where code.id=$1`, [codeId]);
      return { code: updated.rows[0], requestId };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new DomainError("DUPLICATE_CODE", "동일한 최소 점수가 이미 존재합니다.");
      throw error;
    }
  });
}
