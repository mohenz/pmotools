begin;
create table if not exists project_tool.calendar_events(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  title varchar(200) not null check(length(trim(title))>0),
  description text not null default '',
  event_type varchar(20) not null default 'work' check(event_type in ('meeting','milestone','work','other')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  area_code_id uuid references project_tool.common_codes(id),
  location varchar(200) not null default '',
  created_by uuid not null references project_tool.profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(end_at>=start_at)
);
create index if not exists calendar_events_project_period_idx on project_tool.calendar_events(project_id,start_at,end_at);
drop trigger if exists calendar_events_touch on project_tool.calendar_events;
create trigger calendar_events_touch before update on project_tool.calendar_events for each row execute function project_tool.touch_work_record();
drop trigger if exists calendar_events_audit on project_tool.calendar_events;
create trigger calendar_events_audit after insert or update or delete on project_tool.calendar_events for each row execute function project_tool.audit_work_record();
grant select,insert,update on project_tool.calendar_events to project_tool_app;
commit;
