begin;

create schema if not exists project_tool;

do $$ begin
  create type project_tool.member_role as enum ('viewer', 'member', 'pm', 'pmo_admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type project_tool.item_kind as enum ('issue', 'risk');
exception when duplicate_object then null; end $$;
do $$ begin
  create type project_tool.item_category as enum ('schedule', 'cost', 'quality', 'organization', 'contract', 'reputation');
exception when duplicate_object then null; end $$;
do $$ begin
  create type project_tool.probability_level as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;
do $$ begin
  create type project_tool.impact_level as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;
do $$ begin
  create type project_tool.escalation_level as enum ('pm', 'department_head', 'c_level');
exception when duplicate_object then null; end $$;
do $$ begin
  create type project_tool.item_status as enum ('registered', 'in_progress', 'resolved', 'on_hold');
exception when duplicate_object then null; end $$;
do $$ begin
  create type project_tool.event_type as enum ('created', 'comment', 'status_changed', 'level_changed', 'edited', 'archived');
exception when duplicate_object then null; end $$;

create table if not exists project_tool.profiles (
  id uuid primary key,
  auth_user_id uuid unique,
  email varchar(320) not null unique,
  name varchar(100) not null,
  department varchar(120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_tool.projects (
  id uuid primary key default gen_random_uuid(),
  code varchar(30) not null unique,
  name varchar(150) not null,
  timezone varchar(50) not null default 'Asia/Seoul',
  stale_business_days integer not null default 3 check (stale_business_days between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_tool.project_members (
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  user_id uuid not null references project_tool.profiles(id) on delete cascade,
  role project_tool.member_role not null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists project_tool.tracks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  code varchar(30) not null,
  name varchar(100) not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, code)
);

create sequence if not exists project_tool.issue_risk_number_seq;

create table if not exists project_tool.issue_risks (
  id uuid primary key default gen_random_uuid(),
  display_id varchar(30) not null unique default (
    'IR-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('project_tool.issue_risk_number_seq')::text, 6, '0')
  ),
  project_id uuid not null references project_tool.projects(id),
  track_id uuid not null references project_tool.tracks(id),
  kind project_tool.item_kind not null,
  category project_tool.item_category not null,
  title varchar(200) not null check (length(trim(title)) > 0),
  description text not null default '',
  probability project_tool.probability_level not null,
  impact project_tool.impact_level not null,
  exposure_text varchar(500),
  owner_user_id uuid references project_tool.profiles(id),
  owner_text varchar(100),
  escalation_level project_tool.escalation_level not null,
  status project_tool.item_status not null default 'registered',
  created_by uuid not null references project_tool.profiles(id),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  archived_at timestamptz,
  constraint issue_probability_high check (kind <> 'issue' or probability = 'high')
);

create table if not exists project_tool.item_events (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references project_tool.issue_risks(id) on delete cascade,
  event_type project_tool.event_type not null,
  actor_id uuid not null references project_tool.profiles(id),
  body text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists project_tool.audit_logs (
  id bigint generated always as identity primary key,
  project_id uuid,
  item_id uuid,
  actor_id uuid,
  action varchar(20) not null,
  request_id varchar(100),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists issue_risks_project_status_updated_idx on project_tool.issue_risks(project_id, status, updated_at desc);
create index if not exists issue_risks_project_kind_category_idx on project_tool.issue_risks(project_id, kind, category);
create index if not exists issue_risks_project_matrix_idx on project_tool.issue_risks(project_id, probability, impact);
create index if not exists issue_risks_owner_status_idx on project_tool.issue_risks(owner_user_id, status);
create index if not exists item_events_item_created_idx on project_tool.item_events(item_id, created_at desc);
create index if not exists project_members_user_project_idx on project_tool.project_members(user_id, project_id);

create or replace function project_tool.touch_issue_risk()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  if new.status = 'resolved' and old.status <> 'resolved' then
    new.resolved_at = now();
  elsif new.status <> 'resolved' then
    new.resolved_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists issue_risks_touch on project_tool.issue_risks;
create trigger issue_risks_touch
before update on project_tool.issue_risks
for each row execute function project_tool.touch_issue_risk();

create or replace function project_tool.audit_issue_risk()
returns trigger language plpgsql as $$
declare
  actor_text text := nullif(current_setting('app.actor_id', true), '');
  request_text text := nullif(current_setting('app.request_id', true), '');
begin
  insert into project_tool.audit_logs(project_id, item_id, actor_id, action, request_id, before_data, after_data)
  values (
    coalesce(new.project_id, old.project_id),
    coalesce(new.id, old.id),
    actor_text::uuid,
    tg_op,
    request_text,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists issue_risks_audit on project_tool.issue_risks;
create trigger issue_risks_audit
after insert or update or delete on project_tool.issue_risks
for each row execute function project_tool.audit_issue_risk();

grant usage on schema project_tool to project_tool_app;
grant select, insert, update on all tables in schema project_tool to project_tool_app;
revoke delete on project_tool.issue_risks, project_tool.item_events, project_tool.audit_logs from project_tool_app;
grant usage, select on all sequences in schema project_tool to project_tool_app;
alter default privileges in schema project_tool grant select, insert, update on tables to project_tool_app;
alter default privileges in schema project_tool grant usage, select on sequences to project_tool_app;

commit;

