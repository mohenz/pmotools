import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

afterAll(() => pool.end());

describe("PostgreSQL schema integration", () => {
  it("has every required application table", async () => {
    const result = await pool.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema='project_tool' and table_name = any($1::text[])`,
      [["profiles", "projects", "project_members", "tracks", "issue_risks", "item_events", "audit_logs", "common_code_groups", "common_codes", "project_weeks", "weekly_reports", "weekly_progress", "staff_changes", "calendar_events"]],
    );
    expect(result.rows.map((row) => row.table_name).sort()).toEqual([
      "audit_logs", "calendar_events", "common_code_groups", "common_codes", "issue_risks", "item_events", "profiles", "project_members", "project_weeks", "projects", "staff_changes", "tracks", "weekly_progress", "weekly_reports",
    ]);
  });

  it("keeps issue probability fixed to high", async () => {
    const result = await pool.query<{ count: number }>(
      `select count(*)::int as count from project_tool.issue_risks where kind='issue' and probability <> 'high'`,
    );
    expect(result.rows[0].count).toBe(0);
  });

  it("keeps active records referentially complete", async () => {
    const result = await pool.query<{ count: number }>(
      `select count(*)::int as count from project_tool.issue_risks item
       left join project_tool.projects project on project.id=item.project_id
       left join project_tool.common_codes category on category.id=item.category_code_id
       left join project_tool.common_code_groups category_group on category_group.id=category.group_id and category_group.code='category'
       left join project_tool.common_codes track on track.id=item.track_code_id
       left join project_tool.common_code_groups track_group on track_group.id=track.group_id and track_group.code='track'
       left join project_tool.common_codes escalation on escalation.id=item.escalation_code_id
       left join project_tool.common_code_groups escalation_group on escalation_group.id=escalation.group_id and escalation_group.code='escalation_level'
       left join project_tool.profiles creator on creator.id=item.created_by
       where item.archived_at is null and (project.id is null or category_group.id is null or track_group.id is null or escalation_group.id is null or creator.id is null)`,
    );
    expect(result.rows[0].count).toBe(0);
  });

  it("keeps all common-code groups available", async () => {
    const result = await pool.query<{ group_code: string; count: number }>(
      `select group_master.code as group_code,count(code.id)::int as count
       from project_tool.common_code_groups group_master left join project_tool.common_codes code on code.group_id=group_master.id and code.is_active
       where group_master.is_active group by group_master.code`,
    );
    expect(Object.fromEntries(result.rows.map((row) => [row.group_code, row.count]))).toMatchObject({ category: 6, track: 5, escalation_level: 3 });
  });

  it("owns every common code through a group master", async () => {
    const result = await pool.query<{ orphan_count: number; duplicate_count: number }>(
      `select
        count(*) filter(where group_master.id is null)::int as orphan_count,
        (select count(*)::int from (select group_id,code from project_tool.common_codes group by group_id,code having count(*) > 1) duplicates) as duplicate_count
       from project_tool.common_codes code left join project_tool.common_code_groups group_master on group_master.id=code.group_id`,
    );
    expect(result.rows[0]).toEqual({ orphan_count: 0, duplicate_count: 0 });
  });

  it("keeps work records connected to project weeks and areas", async () => {
    const result = await pool.query<{ orphan_count: number }>(
      `select sum(orphan_count)::int as orphan_count from (
        select count(*)::int orphan_count from project_tool.weekly_reports record left join project_tool.project_weeks week on week.id=record.week_id left join project_tool.common_codes area on area.id=record.area_code_id where week.id is null or area.id is null
        union all select count(*)::int from project_tool.weekly_progress record left join project_tool.project_weeks week on week.id=record.week_id left join project_tool.common_codes area on area.id=record.area_code_id where week.id is null or area.id is null
        union all select count(*)::int from project_tool.staff_changes record left join project_tool.project_weeks week on week.id=record.week_id left join project_tool.common_codes area on area.id=record.area_code_id where week.id is null or area.id is null
       ) records`,
    );
    expect(result.rows[0].orphan_count).toBe(0);
  });

  it("keeps calendar event periods valid", async () => {
    const result = await pool.query<{ invalid_count: number }>(`select count(*)::int invalid_count from project_tool.calendar_events where end_at < start_at`);
    expect(result.rows[0].invalid_count).toBe(0);
  });
});
