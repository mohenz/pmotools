import "server-only";

import { z } from "zod";
import { query } from "@/lib/server/db";
import type { CommonCode } from "@/lib/server/common-codes";
import { getCodeOptions } from "@/lib/server/common-codes";

export type ProjectWeek = { id: string; weekKey: string; label: string; startDate: string; endDate: string; status: "open" | "closed" };
export type WeeklyReport = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; achievements: string; nextPlan: string; issues: string; decisions: string; notes: string; version: number };
export type ProgressRow = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; taskName: string; planDetail: string; planTargetDate: string | null; actualDetail: string; actualDate: string | null; progress: number; nextPlan: string; nextTargetDate: string | null; notes: string; version: number; delayed: boolean };
export type StaffChange = { id: string; weekId: string; weekLabel: string; areaCodeId: string; areaLabel: string; changeType: "join" | "leave"; currentCount: number; nextCount: number; notes: string; version: number };

export async function listProjectWeeks(projectId: string) {
  const result = await query<ProjectWeek>(`select id,week_key as "weekKey",label,start_date::text as "startDate",end_date::text as "endDate",status from project_tool.project_weeks where project_id=$1 order by start_date desc`, [projectId]);
  return result.rows;
}

export async function getWorkOptions(projectId: string) {
  const [weeks, codes] = await Promise.all([listProjectWeeks(projectId), getCodeOptions(projectId)]);
  return { weeks, areas: codes.tracks as CommonCode[] };
}

const weekSchema = z.object({ weekKey: z.string().trim().min(7).max(10), label: z.string().trim().min(1).max(50), startDate: z.string().date(), endDate: z.string().date() });
export async function createProjectWeek(projectId: string, input: unknown) {
  const data = weekSchema.parse(input);
  const result = await query<ProjectWeek>(`insert into project_tool.project_weeks(project_id,week_key,label,start_date,end_date) values($1,$2,$3,$4,$5) returning id,week_key as "weekKey",label,start_date::text as "startDate",end_date::text as "endDate",status`, [projectId,data.weekKey,data.label,data.startDate,data.endDate]);
  return result.rows[0];
}
export async function updateProjectWeekStatus(projectId:string,id:string,status:unknown){const value=z.enum(["open","closed"]).parse(status);const r=await query<ProjectWeek>(`update project_tool.project_weeks set status=$1 where id=$2 and project_id=$3 returning id,week_key as "weekKey",label,start_date::text as "startDate",end_date::text as "endDate",status`,[value,id,projectId]);return r.rows[0];}

export type ActivityLog={id:string;action:string;actorName:string|null;createdAt:string;beforeData:Record<string,unknown>|null;afterData:Record<string,unknown>|null};
export async function listActivityLogs(projectId:string){const r=await query<ActivityLog>(`select log.id::text,log.action,profile.name as "actorName",log.created_at::text as "createdAt",log.before_data as "beforeData",log.after_data as "afterData" from project_tool.audit_logs log left join project_tool.profiles profile on profile.id=log.actor_id where log.project_id=$1 order by log.created_at desc limit 200`,[projectId]);return r.rows;}

export async function listWeeklyReports(projectId: string, weekId?: string) {
  const result = await query<WeeklyReport>(`select report.id,report.week_id as "weekId",week.label as "weekLabel",report.area_code_id as "areaCodeId",area.label as "areaLabel",report.achievements,report.next_plan as "nextPlan",report.issues,report.decisions,report.notes,report.version
    from project_tool.weekly_reports report join project_tool.project_weeks week on week.id=report.week_id join project_tool.common_codes area on area.id=report.area_code_id
    where report.project_id=$1 and ($2::uuid is null or report.week_id=$2) order by week.start_date desc,area.sort_order`, [projectId,weekId ?? null]);
  return result.rows;
}
const reportSchema = z.object({ weekId:z.string().uuid(),areaCodeId:z.string().uuid(),achievements:z.string().max(10000),nextPlan:z.string().max(10000),issues:z.string().max(10000),decisions:z.string().max(10000),notes:z.string().max(10000) });
export async function saveWeeklyReport(projectId:string,userId:string,input:unknown) {
  const d=reportSchema.parse(input);
  const result=await query<{id:string}>(`insert into project_tool.weekly_reports(project_id,week_id,area_code_id,achievements,next_plan,issues,decisions,notes,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9)
    on conflict(week_id,area_code_id) do update set achievements=excluded.achievements,next_plan=excluded.next_plan,issues=excluded.issues,decisions=excluded.decisions,notes=excluded.notes returning id`,[projectId,d.weekId,d.areaCodeId,d.achievements,d.nextPlan,d.issues,d.decisions,d.notes,userId]);
  return result.rows[0];
}

export async function listWeeklyProgress(projectId:string,weekId?:string) {
  const result=await query<ProgressRow>(`select progress.id,progress.week_id as "weekId",week.label as "weekLabel",progress.area_code_id as "areaCodeId",area.label as "areaLabel",progress.task_name as "taskName",progress.plan_detail as "planDetail",progress.plan_target_date::text as "planTargetDate",progress.actual_detail as "actualDetail",progress.actual_date::text as "actualDate",progress.progress::float8 as progress,progress.next_plan as "nextPlan",progress.next_target_date::text as "nextTargetDate",progress.notes,progress.version,(progress.progress<100 and progress.plan_target_date<current_date) as delayed
    from project_tool.weekly_progress progress join project_tool.project_weeks week on week.id=progress.week_id join project_tool.common_codes area on area.id=progress.area_code_id
    where progress.project_id=$1 and ($2::uuid is null or progress.week_id=$2) order by week.start_date desc,area.sort_order,progress.created_at`,[projectId,weekId??null]);
  return result.rows;
}
const progressSchema=z.object({weekId:z.string().uuid(),areaCodeId:z.string().uuid(),taskName:z.string().trim().min(1).max(200),planDetail:z.string().max(10000),planTargetDate:z.string().date().nullable(),actualDetail:z.string().max(10000),actualDate:z.string().date().nullable(),progress:z.number().min(0).max(100),nextPlan:z.string().max(10000),nextTargetDate:z.string().date().nullable(),notes:z.string().max(10000)});
export async function createProgress(projectId:string,userId:string,input:unknown){const d=progressSchema.parse(input);const r=await query<{id:string}>(`insert into project_tool.weekly_progress(project_id,week_id,area_code_id,task_name,plan_detail,plan_target_date,actual_detail,actual_date,progress,next_plan,next_target_date,notes,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,[projectId,d.weekId,d.areaCodeId,d.taskName,d.planDetail,d.planTargetDate,d.actualDetail,d.actualDate,d.progress,d.nextPlan,d.nextTargetDate,d.notes,userId]);return r.rows[0];}
export async function updateProgress(projectId:string,id:string,input:unknown){const d=progressSchema.parse(input);const r=await query<{id:string}>(`update project_tool.weekly_progress set week_id=$1,area_code_id=$2,task_name=$3,plan_detail=$4,plan_target_date=$5,actual_detail=$6,actual_date=$7,progress=$8,next_plan=$9,next_target_date=$10,notes=$11 where id=$12 and project_id=$13 returning id`,[d.weekId,d.areaCodeId,d.taskName,d.planDetail,d.planTargetDate,d.actualDetail,d.actualDate,d.progress,d.nextPlan,d.nextTargetDate,d.notes,id,projectId]);return r.rows[0];}

export async function listStaffChanges(projectId:string,weekId?:string){const r=await query<StaffChange>(`select staff.id,staff.week_id as "weekId",week.label as "weekLabel",staff.area_code_id as "areaCodeId",area.label as "areaLabel",staff.change_type as "changeType",staff.current_count as "currentCount",staff.next_count as "nextCount",staff.notes,staff.version from project_tool.staff_changes staff join project_tool.project_weeks week on week.id=staff.week_id join project_tool.common_codes area on area.id=staff.area_code_id where staff.project_id=$1 and ($2::uuid is null or staff.week_id=$2) order by week.start_date desc,area.sort_order,staff.change_type`,[projectId,weekId??null]);return r.rows;}
const staffSchema=z.object({weekId:z.string().uuid(),areaCodeId:z.string().uuid(),changeType:z.enum(["join","leave"]),currentCount:z.number().int().min(0),nextCount:z.number().int().min(0),notes:z.string().max(10000)});
export async function saveStaffChange(projectId:string,userId:string,input:unknown){const d=staffSchema.parse(input);const r=await query<{id:string}>(`insert into project_tool.staff_changes(project_id,week_id,area_code_id,change_type,current_count,next_count,notes,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(week_id,area_code_id,change_type) do update set current_count=excluded.current_count,next_count=excluded.next_count,notes=excluded.notes returning id`,[projectId,d.weekId,d.areaCodeId,d.changeType,d.currentCount,d.nextCount,d.notes,userId]);return r.rows[0];}

export async function getPortfolioDashboard(projectId:string){
  const [weeks,reports,progress,staff,issues]=await Promise.all([
    listProjectWeeks(projectId),
    query<{count:number}>(`select count(*)::int count from project_tool.weekly_reports where project_id=$1`,[projectId]),
    query<{average:number;delayed:number}>(`select coalesce(round(avg(progress),1),0)::float8 average,count(*) filter(where progress<100 and plan_target_date<current_date)::int delayed from project_tool.weekly_progress where project_id=$1`,[projectId]),
    query<{current:number;next:number}>(`select coalesce(sum(case when change_type='join' then current_count else -current_count end),0)::int current,coalesce(sum(case when change_type='join' then next_count else -next_count end),0)::int next from project_tool.staff_changes where project_id=$1`,[projectId]),
    query<{open:number}>(`select count(*) filter(where status in ('registered','in_progress'))::int open from project_tool.issue_risks where project_id=$1 and archived_at is null`,[projectId]),
  ]);
  return {currentWeek:weeks[0]??null,reportCount:reports.rows[0].count,averageProgress:progress.rows[0].average,delayedCount:progress.rows[0].delayed,currentStaff:staff.rows[0].current,nextStaff:staff.rows[0].next,openIssues:issues.rows[0].open};
}

export async function listCalendarEvents(projectId:string){
  const r=await query<{id:string;date:string;type:string;title:string;detail:string}>(`select id,plan_target_date::text date,'progress' type,task_name title,'계획 목표일' detail from project_tool.weekly_progress where project_id=$1 and plan_target_date is not null
    union all select id,next_target_date::text,'next_plan',task_name,'차주 목표일' from project_tool.weekly_progress where project_id=$1 and next_target_date is not null
    union all select id,created_at::date::text,'issue',title,'이슈·리스크 등록' from project_tool.issue_risks where project_id=$1 and archived_at is null order by date desc`,[projectId]);return r.rows;
}
