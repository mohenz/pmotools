import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { riskScore } from "@/lib/domain/items";
import { query, withTransaction } from "@/lib/server/db";

const kindSchema = z.enum(["issue", "risk"]);
const categorySchema = z.enum(["schedule", "cost", "quality", "organization", "contract", "reputation"]);
const probabilitySchema = z.enum(["low", "medium", "high"]);
const statusSchema = z.enum(["registered", "in_progress", "resolved", "on_hold"]);
const escalationSchema = z.enum(["pm", "department_head", "c_level"]);

export const createItemSchema = z.object({
  kind: kindSchema,
  categoryCodeId: z.string().uuid(),
  trackCodeId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).default(""),
  probability: probabilitySchema,
  impact: probabilitySchema,
  exposureText: z.string().trim().max(500).optional(),
  ownerText: z.string().trim().max(100).optional(),
  escalationCodeId: z.string().uuid().optional(),
});

export const updateItemSchema = createItemSchema.omit({ kind: true, escalationCodeId: true }).extend({ version: z.number().int().positive() });
export const statusUpdateSchema = z.object({ status: statusSchema, version: z.number().int().positive() });
export const escalationUpdateSchema = z.object({ escalationCodeId: z.string().uuid(), version: z.number().int().positive() });
export const commentSchema = z.object({ body: z.string().trim().min(1).max(5_000), version: z.number().int().positive() });
export const archiveSchema = z.object({ version: z.number().int().positive() });

export class DomainError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" | "DUPLICATE_CODE" | "LAST_ACTIVE_CODE" | "INVALID_CODE", message: string) {
    super(message);
  }
}

export type ItemRow = {
  id: string;
  displayId: string;
  projectId: string;
  trackCodeId: string;
  kind: "issue" | "risk";
  categoryCodeId: string;
  categoryCode: string;
  categoryLabel: string;
  title: string;
  description: string;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  exposureText: string | null;
  ownerText: string | null;
  escalationCodeId: string;
  escalationCode: string;
  escalationLabel: string;
  status: "registered" | "in_progress" | "resolved" | "on_hold";
  trackName: string;
  trackCode: string;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  businessDaysIdle: number;
  isStale: boolean;
  version: number;
};

export type ItemEventRow = {
  id: string;
  eventType: "created" | "comment" | "status_changed" | "level_changed" | "edited" | "archived";
  actorName: string;
  body: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
};

export type ItemFilters = {
  q?: string;
  kind?: string;
  status?: string;
  category?: string;
  probability?: string;
  impact?: string;
  open?: boolean;
  stale?: boolean;
  page?: number;
  pageSize?: number;
};

const itemSelect = `
  select item.id,
         item.display_id as "displayId",
         item.project_id as "projectId",
         item.track_code_id as "trackCodeId",
         item.kind,
         item.category_code_id as "categoryCodeId",
         category_code.code as "categoryCode",
         category_code.label as "categoryLabel",
         item.title,
         item.description,
         item.probability,
         item.impact,
         item.exposure_text as "exposureText",
         item.owner_text as "ownerText",
         item.escalation_code_id as "escalationCodeId",
         escalation_code.code as "escalationCode",
         escalation_code.label as "escalationLabel",
         item.status,
         track_code.label as "trackName",
         track_code.code as "trackCode",
         coalesce(owner.name, item.owner_text) as "ownerName",
         item.created_at::text as "createdAt",
         item.updated_at::text as "updatedAt",
         item.resolved_at::text as "resolvedAt",
         project_tool.business_days_since(item.updated_at, project.timezone) as "businessDaysIdle",
         (item.status in ('registered', 'in_progress') and project_tool.business_days_since(item.updated_at, project.timezone) >= project.stale_business_days) as "isStale",
         item.version
  from project_tool.issue_risks item
  join project_tool.projects project on project.id = item.project_id
  join project_tool.common_codes category_code on category_code.id = item.category_code_id
  join project_tool.common_codes track_code on track_code.id = item.track_code_id
  join project_tool.common_codes escalation_code on escalation_code.id = item.escalation_code_id
  left join project_tool.profiles owner on owner.id = item.owner_user_id
`;

function buildItemWhere(projectId: string, filters: ItemFilters) {
  const values: unknown[] = [projectId];
  const where = ["item.project_id = $1", "item.archived_at is null"];
  const addEnum = (column: string, value: string | undefined, allowed: readonly string[]) => {
    if (value && allowed.includes(value)) {
      values.push(value);
      where.push(`${column} = $${values.length}`);
    }
  };

  addEnum("item.kind", filters.kind, kindSchema.options);
  addEnum("item.status", filters.status, statusSchema.options);
  if (filters.category?.trim()) {
    values.push(filters.category.trim());
    where.push(`category_code.code = $${values.length}`);
  }
  addEnum("case when item.kind = 'issue' then 'high' else item.probability::text end", filters.probability, probabilitySchema.options);
  addEnum("item.impact", filters.impact, probabilitySchema.options);
  if (filters.open) where.push("item.status in ('registered', 'in_progress')");
  if (filters.stale) where.push("item.status in ('registered', 'in_progress') and project_tool.business_days_since(item.updated_at, project.timezone) >= project.stale_business_days");
  if (filters.q?.trim()) {
    values.push(`%${filters.q.trim()}%`);
    where.push(`(item.title ilike $${values.length} or item.description ilike $${values.length} or coalesce(owner.name, item.owner_text, '') ilike $${values.length})`);
  }
  return { values, where };
}

export async function listTracks(projectId: string) {
  const result = await query<{ id: string; name: string }>(
    `select code.id,code.label as name from project_tool.common_codes code
     join project_tool.common_code_groups group_master on group_master.id=code.group_id
     where group_master.project_id=$1 and group_master.code='track' and group_master.is_active and code.is_active
     order by code.sort_order,code.label`,
    [projectId],
  );
  return result.rows;
}

export async function listItems(projectId: string, filters: ItemFilters = {}) {
  const { values, where } = buildItemWhere(projectId, filters);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 30));
  const requestedPage = Math.max(1, filters.page ?? 1);
  const countResult = await query<{ count: number }>(
    `select count(*)::int as count ${itemSelect.slice(itemSelect.indexOf("from"))} where ${where.join(" and ")}`,
    values,
  );
  const total = countResult.rows[0].count;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  values.push(pageSize, (page - 1) * pageSize);
  const result = await query<ItemRow>(
    `${itemSelect} where ${where.join(" and ")} order by item.updated_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return { items: result.rows, total, page, pageSize, totalPages };
}

export async function listItemsForExport(projectId: string, filters: ItemFilters = {}) {
  const { values, where } = buildItemWhere(projectId, filters);
  const result = await query<ItemRow>(`${itemSelect} where ${where.join(" and ")} order by item.updated_at desc limit 10000`, values);
  return result.rows;
}

export async function getItemDetail(projectId: string, itemId: string) {
  const [itemResult, eventResult] = await Promise.all([
    query<ItemRow>(`${itemSelect} where item.project_id = $1 and item.id = $2 and item.archived_at is null`, [projectId, itemId]),
    query<ItemEventRow>(
      `select event.id, event.event_type as "eventType", actor.name as "actorName", event.body,
              event.before_data as "beforeData", event.after_data as "afterData", event.created_at::text as "createdAt"
       from project_tool.item_events event
       join project_tool.issue_risks item on item.id = event.item_id
       join project_tool.profiles actor on actor.id = event.actor_id
       where item.project_id = $1 and event.item_id = $2
       order by event.created_at desc, event.id desc`,
      [projectId, itemId],
    ),
  ]);
  const item = itemResult.rows[0];
  return item ? { item, events: eventResult.rows } : null;
}

export async function getDashboard(projectId: string) {
  const [summary, matrix, categoryCounts, staleItems] = await Promise.all([
    query<{ total: number; openIssues: number; openRisks: number; stale: number }>(
      `select count(*)::int as total,
              count(*) filter (where kind = 'issue' and status in ('registered','in_progress'))::int as "openIssues",
              count(*) filter (where kind = 'risk' and status in ('registered','in_progress'))::int as "openRisks",
              count(*) filter (where status in ('registered','in_progress') and project_tool.business_days_since(item.updated_at, project.timezone) >= project.stale_business_days)::int as stale
       from project_tool.issue_risks item join project_tool.projects project on project.id = item.project_id
       where item.project_id = $1 and item.archived_at is null`,
      [projectId],
    ),
    query<{ probability: string; impact: string; count: number }>(
      `select case when kind = 'issue' then 'high' else probability::text end as probability,
              impact::text, count(*)::int as count
       from project_tool.issue_risks
       where project_id = $1 and archived_at is null and status in ('registered','in_progress')
       group by 1, 2`, [projectId],
    ),
    query<{ category: string; label: string; count: number }>(
      `select code.code as category, code.label, count(item.id)::int as count
       from project_tool.common_codes code join project_tool.common_code_groups group_master on group_master.id=code.group_id
       left join project_tool.issue_risks item on item.category_code_id=code.id and item.archived_at is null and item.status in ('registered','in_progress')
       where group_master.project_id=$1 and group_master.code='category' and group_master.is_active and code.is_active
       group by code.id,code.code,code.label,code.sort_order order by code.sort_order,code.label`, [projectId],
    ),
    query<ItemRow>(
      `${itemSelect} where item.project_id = $1 and item.archived_at is null
       and item.status in ('registered','in_progress')
       and project_tool.business_days_since(item.updated_at, project.timezone) >= project.stale_business_days
       order by item.updated_at asc limit 8`, [projectId],
    ),
  ]);
  return { summary: summary.rows[0], matrix: matrix.rows, categories: categoryCounts.rows, staleItems: staleItems.rows };
}

async function getPermission(client: PoolClient, projectId: string, userId: string, itemId?: string) {
  const result = await client.query<{ role: string; owns: boolean }>(
    `select member.role::text,
            case when $3::uuid is null then false else exists(
              select 1 from project_tool.issue_risks item
              where item.id = $3 and item.project_id = $1 and (item.created_by = $2 or item.owner_user_id = $2)
            ) end as owns
     from project_tool.project_members member
     where member.project_id = $1 and member.user_id = $2`,
    [projectId, userId, itemId ?? null],
  );
  return result.rows[0] ?? null;
}

async function assertWritePermission(client: PoolClient, projectId: string, userId: string, itemId?: string, requirePm = false) {
  const permission = await getPermission(client, projectId, userId, itemId);
  const isManager = permission && ["pm", "pmo_admin"].includes(permission.role);
  if (!permission || (requirePm ? !isManager : !(isManager || (permission.role === "member" && (!itemId || permission.owns))))) {
    throw new DomainError("FORBIDDEN", "이 작업을 수행할 권한이 없습니다.");
  }
}

async function setAuditContext(client: PoolClient, userId: string, requestId: string) {
  await client.query(`select set_config('app.actor_id', $1, true), set_config('app.request_id', $2, true)`, [userId, requestId]);
}

async function assertCommonCode(client: PoolClient, projectId: string, codeId: string, groupCode: string) {
  const result = await client.query(
    `select 1 from project_tool.common_codes code join project_tool.common_code_groups group_master on group_master.id=code.group_id
     where code.id=$1 and group_master.project_id=$2 and group_master.code=$3 and group_master.is_active and code.is_active`,
    [codeId, projectId, groupCode],
  );
  if (!result.rowCount) throw new DomainError("INVALID_CODE", "선택한 공통코드를 사용할 수 없습니다.");
}

async function suggestedEscalationId(client: PoolClient, projectId: string, kind: "issue" | "risk", probability: "low" | "medium" | "high", impact: "low" | "medium" | "high") {
  const score = riskScore(kind, probability, impact);
  const result = await client.query<{ id: string }>(
    `select code.id from project_tool.common_codes code join project_tool.common_code_groups group_master on group_master.id=code.group_id
     where group_master.project_id=$1 and group_master.code='escalation_level' and group_master.is_active and code.is_active
       and coalesce((code.metadata->>'minScore')::int,1) <= $2
     order by coalesce((code.metadata->>'minScore')::int,1) desc,code.sort_order desc limit 1`,
    [projectId, score],
  );
  if (!result.rowCount) throw new DomainError("INVALID_CODE", "적용 가능한 에스컬레이션 공통코드가 없습니다.");
  return result.rows[0].id;
}

async function throwMutationFailure(client: PoolClient, projectId: string, itemId: string) {
  const exists = await client.query(`select 1 from project_tool.issue_risks where project_id = $1 and id = $2 and archived_at is null`, [projectId, itemId]);
  if (!exists.rowCount) throw new DomainError("NOT_FOUND", "항목을 찾을 수 없습니다.");
  throw new DomainError("VERSION_CONFLICT", "다른 사용자가 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요.");
}

export async function createItem(projectId: string, userId: string, input: unknown) {
  const data = createItemSchema.parse(input);
  const probability = data.kind === "issue" ? "high" : data.probability;
  const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertWritePermission(client, projectId, userId);
    await assertCommonCode(client, projectId, data.categoryCodeId, "category");
    await assertCommonCode(client, projectId, data.trackCodeId, "track");
    const escalationCodeId = data.escalationCodeId ?? await suggestedEscalationId(client, projectId, data.kind, probability, data.impact);
    await assertCommonCode(client, projectId, escalationCodeId, "escalation_level");
    await setAuditContext(client, userId, requestId);
    const inserted = await client.query<{ id: string; displayId: string }>(
      `insert into project_tool.issue_risks(project_id, track_code_id, category_code_id, escalation_code_id, kind, title, description, probability, impact,
       exposure_text, owner_text, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       returning id, display_id as "displayId"`,
      [projectId, data.trackCodeId, data.categoryCodeId, escalationCodeId, data.kind, data.title, data.description, probability, data.impact,
       data.exposureText || null, data.ownerText || null, userId],
    );
    await client.query(`insert into project_tool.item_events(item_id, event_type, actor_id, body) values ($1, 'created', $2, '신규 등록')`, [inserted.rows[0].id, userId]);
    return { ...inserted.rows[0], requestId };
  });
}

export async function updateItem(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = updateItemSchema.parse(input);
  const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertWritePermission(client, projectId, userId, itemId);
    await assertCommonCode(client, projectId, data.categoryCodeId, "category");
    await assertCommonCode(client, projectId, data.trackCodeId, "track");
    await setAuditContext(client, userId, requestId);
    const before = await client.query(`select to_jsonb(item) as data from project_tool.issue_risks item where id = $1 and project_id = $2`, [itemId, projectId]);
    const result = await client.query<{ version: number }>(
      `update project_tool.issue_risks set track_code_id=$1, category_code_id=$2, title=$3, description=$4,
       probability=case when kind='issue' then 'high' else $5::project_tool.probability_level end,
       impact=$6, exposure_text=$7, owner_text=$8
       where id=$9 and project_id=$10 and version=$11 and archived_at is null returning version`,
      [data.trackCodeId, data.categoryCodeId, data.title, data.description, data.probability, data.impact,
       data.exposureText || null, data.ownerText || null, itemId, projectId, data.version],
    );
    if (!result.rowCount) await throwMutationFailure(client, projectId, itemId);
    const after = await client.query(`select to_jsonb(item) as data from project_tool.issue_risks item where id = $1`, [itemId]);
    await client.query(`insert into project_tool.item_events(item_id,event_type,actor_id,body,before_data,after_data) values ($1,'edited',$2,'기본 정보 수정',$3,$4)`, [itemId, userId, before.rows[0]?.data, after.rows[0]?.data]);
    return { version: result.rows[0].version, requestId };
  });
}

export async function updateStatus(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = statusUpdateSchema.parse(input);
  return updateSingleField(projectId, userId, itemId, data.version, "status", data.status, "status_changed", false);
}

export async function updateEscalation(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = escalationUpdateSchema.parse(input);
  return withTransaction(async (client) => {
    await assertWritePermission(client, projectId, userId, itemId, true);
    await assertCommonCode(client, projectId, data.escalationCodeId, "escalation_level");
    const requestId = randomUUID();
    await setAuditContext(client, userId, requestId);
    const labels = await client.query<{ beforeLabel: string; afterLabel: string }>(
      `select current_code.label as "beforeLabel",new_code.label as "afterLabel"
       from project_tool.issue_risks item join project_tool.common_codes current_code on current_code.id=item.escalation_code_id
       join project_tool.common_codes new_code on new_code.id=$3 where item.id=$1 and item.project_id=$2`,
      [itemId, projectId, data.escalationCodeId],
    );
    const result = await client.query<{ version: number }>(
      `update project_tool.issue_risks set escalation_code_id=$1 where id=$2 and project_id=$3 and version=$4 and archived_at is null returning version`,
      [data.escalationCodeId, itemId, projectId, data.version],
    );
    if (!result.rowCount) await throwMutationFailure(client, projectId, itemId);
    await client.query(`insert into project_tool.item_events(item_id,event_type,actor_id,body,before_data,after_data) values($1,'level_changed',$2,'에스컬레이션 레벨 변경',$3,$4)`,
      [itemId, userId, { value: labels.rows[0]?.beforeLabel }, { value: labels.rows[0]?.afterLabel }]);
    return { version: result.rows[0].version, requestId };
  });
}

async function updateSingleField(
  projectId: string, userId: string, itemId: string, version: number,
  field: "status", value: string, eventType: "status_changed", requirePm: boolean,
) {
  const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertWritePermission(client, projectId, userId, itemId, requirePm);
    await setAuditContext(client, userId, requestId);
    const before = await client.query<{ value: string }>(`select ${field}::text as value from project_tool.issue_risks where id=$1 and project_id=$2`, [itemId, projectId]);
    const result = await client.query<{ version: number }>(
      `update project_tool.issue_risks set ${field}=$1 where id=$2 and project_id=$3 and version=$4 and archived_at is null returning version`,
      [value, itemId, projectId, version],
    );
    if (!result.rowCount) await throwMutationFailure(client, projectId, itemId);
    await client.query(
      `insert into project_tool.item_events(item_id,event_type,actor_id,body,before_data,after_data) values ($1,$2,$3,$4,$5,$6)`,
      [itemId, eventType, userId, "상태 변경", { value: before.rows[0]?.value }, { value }],
    );
    return { version: result.rows[0].version, requestId };
  });
}

export async function addComment(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = commentSchema.parse(input);
  const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertWritePermission(client, projectId, userId, itemId);
    await setAuditContext(client, userId, requestId);
    const touched = await client.query<{ version: number }>(
      `update project_tool.issue_risks set updated_at=now() where id=$1 and project_id=$2 and version=$3 and archived_at is null returning version`,
      [itemId, projectId, data.version],
    );
    if (!touched.rowCount) await throwMutationFailure(client, projectId, itemId);
    await client.query(`insert into project_tool.item_events(item_id,event_type,actor_id,body) values ($1,'comment',$2,$3)`, [itemId, userId, data.body]);
    return { version: touched.rows[0].version, requestId };
  });
}

export async function archiveItem(projectId: string, userId: string, itemId: string, input: unknown) {
  const data = archiveSchema.parse(input);
  const requestId = randomUUID();
  return withTransaction(async (client) => {
    await assertWritePermission(client, projectId, userId, itemId, true);
    await setAuditContext(client, userId, requestId);
    const result = await client.query<{ version: number }>(
      `update project_tool.issue_risks set archived_at=now() where id=$1 and project_id=$2 and version=$3 and archived_at is null returning version`,
      [itemId, projectId, data.version],
    );
    if (!result.rowCount) await throwMutationFailure(client, projectId, itemId);
    await client.query(`insert into project_tool.item_events(item_id,event_type,actor_id,body) values ($1,'archived',$2,'항목 보관')`, [itemId, userId]);
    return { version: result.rows[0].version, requestId };
  });
}
