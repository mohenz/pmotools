begin;

create table if not exists project_tool.project_weeks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  week_key varchar(10) not null,
  label varchar(50) not null,
  start_date date not null,
  end_date date not null,
  status varchar(10) not null default 'open' check(status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,week_key),
  check(end_date >= start_date)
);

create table if not exists project_tool.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  week_id uuid not null references project_tool.project_weeks(id) on delete cascade,
  area_code_id uuid not null references project_tool.common_codes(id),
  achievements text not null default '',
  next_plan text not null default '',
  issues text not null default '',
  decisions text not null default '',
  notes text not null default '',
  created_by uuid not null references project_tool.profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(week_id,area_code_id)
);

create table if not exists project_tool.weekly_progress (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  week_id uuid not null references project_tool.project_weeks(id) on delete cascade,
  area_code_id uuid not null references project_tool.common_codes(id),
  task_name varchar(200) not null check(length(trim(task_name)) > 0),
  plan_detail text not null default '',
  plan_target_date date,
  actual_detail text not null default '',
  actual_date date,
  progress numeric(5,2) not null default 0 check(progress between 0 and 100),
  next_plan text not null default '',
  next_target_date date,
  notes text not null default '',
  created_by uuid not null references project_tool.profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_tool.staff_changes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  week_id uuid not null references project_tool.project_weeks(id) on delete cascade,
  area_code_id uuid not null references project_tool.common_codes(id),
  change_type varchar(10) not null check(change_type in ('join','leave')),
  current_count integer not null default 0 check(current_count >= 0),
  next_count integer not null default 0 check(next_count >= 0),
  notes text not null default '',
  created_by uuid not null references project_tool.profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(week_id,area_code_id,change_type)
);

create index if not exists project_weeks_project_start_idx on project_tool.project_weeks(project_id,start_date desc);
create index if not exists weekly_reports_project_week_idx on project_tool.weekly_reports(project_id,week_id);
create index if not exists weekly_progress_project_week_area_idx on project_tool.weekly_progress(project_id,week_id,area_code_id);
create index if not exists weekly_progress_target_idx on project_tool.weekly_progress(project_id,plan_target_date,next_target_date);
create index if not exists staff_changes_project_week_idx on project_tool.staff_changes(project_id,week_id);

create or replace function project_tool.touch_work_record() returns trigger language plpgsql as $$
begin new.updated_at=now(); new.version=old.version+1; return new; end; $$;
create or replace function project_tool.touch_project_week() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists project_weeks_touch on project_tool.project_weeks;
create trigger project_weeks_touch before update on project_tool.project_weeks for each row execute function project_tool.touch_project_week();
drop trigger if exists weekly_reports_touch on project_tool.weekly_reports;
create trigger weekly_reports_touch before update on project_tool.weekly_reports for each row execute function project_tool.touch_work_record();
drop trigger if exists weekly_progress_touch on project_tool.weekly_progress;
create trigger weekly_progress_touch before update on project_tool.weekly_progress for each row execute function project_tool.touch_work_record();
drop trigger if exists staff_changes_touch on project_tool.staff_changes;
create trigger staff_changes_touch before update on project_tool.staff_changes for each row execute function project_tool.touch_work_record();

insert into project_tool.project_weeks(id,project_id,week_key,label,start_date,end_date) values
 ('81000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-W31','2026년 31주차','2026-07-27','2026-08-02'),
 ('81000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','2026-W32','2026년 32주차','2026-08-03','2026-08-09')
on conflict(project_id,week_key) do nothing;

insert into project_tool.weekly_reports(id,project_id,week_id,area_code_id,achievements,next_plan,issues,decisions,created_by)
select '82000000-0000-4000-8000-000000000001',w.project_id,w.id,c.id,
 '핵심 기능 요구사항과 화면 흐름을 정리했습니다.','주간실적 및 인력변동 기능을 구현합니다.','공통코드 운영 기준 확정이 필요합니다.','인증은 업무 기능 완료 후 적용합니다.','10000000-0000-4000-8000-000000000001'
from project_tool.project_weeks w join project_tool.common_code_groups g on g.project_id=w.project_id and g.code='track'
join project_tool.common_codes c on c.group_id=g.id and c.code='COMMON'
where w.id='81000000-0000-4000-8000-000000000001'
on conflict(week_id,area_code_id) do nothing;

insert into project_tool.weekly_progress(id,project_id,week_id,area_code_id,task_name,plan_detail,plan_target_date,actual_detail,actual_date,progress,next_plan,next_target_date,created_by)
select '83000000-0000-4000-8000-000000000001',w.project_id,w.id,c.id,'이슈관리 기능 고도화','공통코드 그룹형 전환','2026-08-01','그룹형 관리 및 고밀도 UI 완료','2026-08-01',100,'주간업무 모듈 구현','2026-08-07','10000000-0000-4000-8000-000000000001'
from project_tool.project_weeks w join project_tool.common_code_groups g on g.project_id=w.project_id and g.code='track'
join project_tool.common_codes c on c.group_id=g.id and c.code='TRACK_A'
where w.id='81000000-0000-4000-8000-000000000001'
on conflict do nothing;

insert into project_tool.staff_changes(id,project_id,week_id,area_code_id,change_type,current_count,next_count,notes,created_by)
select '84000000-0000-4000-8000-000000000001',w.project_id,w.id,c.id,'join',4,5,'차주 개발 인력 1명 추가 예정','10000000-0000-4000-8000-000000000001'
from project_tool.project_weeks w join project_tool.common_code_groups g on g.project_id=w.project_id and g.code='track'
join project_tool.common_codes c on c.group_id=g.id and c.code='TRACK_A'
where w.id='81000000-0000-4000-8000-000000000001'
on conflict(week_id,area_code_id,change_type) do nothing;

grant select,insert,update on project_tool.project_weeks,project_tool.weekly_reports,project_tool.weekly_progress,project_tool.staff_changes to project_tool_app;

commit;
