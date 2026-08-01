-- PMO CONTROL - Supabase initial schema
-- Generated from database/migrations/001_schema.sql through 010_calendar_events.sql.
-- Run this file once in a new Supabase project using SQL Editor,
-- or keep it as the first Supabase CLI migration.
--
-- Authentication and user-facing RLS policies are intentionally deferred.
-- Until those policies are implemented, anon/authenticated cannot access
-- the private project_tool schema through the Supabase Data API.

-- SOURCE: 001_schema.sql
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








commit;


-- SOURCE: 002_seed.sql
begin;

insert into project_tool.profiles(id, email, name, department)
values ('10000000-0000-4000-8000-000000000001', 'local.pmo@example.com', '로컬 PMO 관리자', 'PMO')
on conflict (id) do update set name = excluded.name, department = excluded.department;

insert into project_tool.projects(id, code, name)
values ('20000000-0000-4000-8000-000000000001', 'PMO-DEMO', 'PMO 통제 프로젝트')
on conflict (id) do update set name = excluded.name;

insert into project_tool.project_members(project_id, user_id, role)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'pmo_admin')
on conflict (project_id, user_id) do update set role = excluded.role;

insert into project_tool.tracks(id, project_id, code, name, sort_order) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'TRACK_A', 'Track A', 1),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'TRACK_B', 'Track B', 2),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'TRACK_C', 'Track C', 3),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'TRACK_D', 'Track D', 4),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'COMMON', '공통/PMO', 5)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

insert into project_tool.issue_risks(
  id, project_id, track_id, kind, category, title, description, probability, impact,
  exposure_text, owner_user_id, escalation_level, status, created_by, created_at, updated_at
) values
  (
    '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001', 'issue', 'schedule', '핵심 인터페이스 일정 지연',
    '외부 연계 규격 확정 지연으로 통합 테스트 일정에 영향이 예상됩니다.', 'high', 'high',
    '통합 테스트 2주 지연 가능', '10000000-0000-4000-8000-000000000001', 'c_level', 'in_progress',
    '10000000-0000-4000-8000-000000000001', now() - interval '5 days', now() - interval '4 days'
  ),
  (
    '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000002', 'risk', 'cost', '추가 라이선스 비용 발생 가능성',
    '사용자 증가에 따라 상용 라이선스 구간 변경 가능성이 있습니다.', 'medium', 'high',
    '연간 약 3천만원', '10000000-0000-4000-8000-000000000001', 'department_head', 'registered',
    '10000000-0000-4000-8000-000000000001', now() - interval '2 days', now() - interval '2 days'
  ),
  (
    '40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000005', 'risk', 'organization', '의사결정 지연 가능성',
    '주요 의사결정권자 일정 중복으로 승인 리드타임 증가가 예상됩니다.', 'medium', 'medium',
    '승인 일정 3영업일 지연 가능', '10000000-0000-4000-8000-000000000001', 'department_head', 'on_hold',
    '10000000-0000-4000-8000-000000000001', now() - interval '1 day', now() - interval '1 day'
  )
on conflict (id) do nothing;

insert into project_tool.item_events(item_id, event_type, actor_id, body)
select item.id, 'created', item.created_by, '초기 데이터 등록'
from project_tool.issue_risks item
where item.id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003'
)
and not exists (
  select 1 from project_tool.item_events event
  where event.item_id = item.id and event.event_type = 'created'
);

commit;


-- SOURCE: 003_business_rules.sql
begin;

create or replace function project_tool.business_days_since(value timestamptz, zone_name text default 'Asia/Seoul')
returns integer
language sql
stable
as $$
  select count(*)::integer
  from generate_series(
    (value at time zone zone_name)::date + 1,
    (now() at time zone zone_name)::date,
    interval '1 day'
  ) day
  where extract(isodow from day) between 1 and 5;
$$;



commit;


-- SOURCE: 004_common_codes.sql
begin;

create table if not exists project_tool.common_codes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  group_key varchar(40) not null check (group_key in ('category', 'track', 'escalation_level')),
  code varchar(50) not null check (code ~ '^[A-Za-z][A-Za-z0-9_-]*$'),
  label varchar(100) not null check (length(trim(label)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, group_key, code)
);

insert into project_tool.common_codes(id, project_id, group_key, code, label, sort_order) values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'category', 'schedule', '일정', 1),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'category', 'cost', '비용', 2),
  ('50000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'category', 'quality', '품질', 3),
  ('50000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'category', 'organization', '조직/정치', 4),
  ('50000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'category', 'contract', '계약', 5),
  ('50000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'category', 'reputation', '대외 평판', 6)
on conflict (project_id, group_key, code) do nothing;

insert into project_tool.common_codes(id, project_id, group_key, code, label, sort_order)
select id, project_id, 'track', code, name, sort_order from project_tool.tracks
on conflict (project_id, group_key, code) do nothing;

insert into project_tool.common_codes(id, project_id, group_key, code, label, sort_order, metadata) values
  ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'escalation_level', 'pm', 'PM 레벨', 1, '{"minScore":1}'),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'escalation_level', 'department_head', '본부장 레벨', 2, '{"minScore":4}'),
  ('60000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'escalation_level', 'c_level', 'C-Level 레벨', 3, '{"minScore":7}')
on conflict (project_id, group_key, code) do nothing;

alter table project_tool.issue_risks add column if not exists category_code_id uuid;
alter table project_tool.issue_risks add column if not exists track_code_id uuid;
alter table project_tool.issue_risks add column if not exists escalation_code_id uuid;

alter table project_tool.issue_risks disable trigger issue_risks_touch;
alter table project_tool.issue_risks disable trigger issue_risks_audit;

update project_tool.issue_risks item set category_code_id=code.id
from project_tool.common_codes code
where item.category_code_id is null and code.project_id=item.project_id and code.group_key='category' and code.code=item.category::text;

update project_tool.issue_risks item set track_code_id=code.id
from project_tool.common_codes code
where item.track_code_id is null and code.project_id=item.project_id and code.group_key='track' and code.id=item.track_id;

update project_tool.issue_risks item set escalation_code_id=code.id
from project_tool.common_codes code
where item.escalation_code_id is null and code.project_id=item.project_id and code.group_key='escalation_level' and code.code=item.escalation_level::text;

alter table project_tool.issue_risks enable trigger issue_risks_touch;
alter table project_tool.issue_risks enable trigger issue_risks_audit;

alter table project_tool.issue_risks alter column category_code_id set not null;
alter table project_tool.issue_risks alter column track_code_id set not null;
alter table project_tool.issue_risks alter column escalation_code_id set not null;

alter table project_tool.issue_risks alter column category drop not null;
alter table project_tool.issue_risks alter column track_id drop not null;
alter table project_tool.issue_risks alter column escalation_level drop not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='issue_risks_category_code_fk') then
    alter table project_tool.issue_risks add constraint issue_risks_category_code_fk foreign key(category_code_id) references project_tool.common_codes(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='issue_risks_track_code_fk') then
    alter table project_tool.issue_risks add constraint issue_risks_track_code_fk foreign key(track_code_id) references project_tool.common_codes(id);
  end if;
  if not exists (select 1 from pg_constraint where conname='issue_risks_escalation_code_fk') then
    alter table project_tool.issue_risks add constraint issue_risks_escalation_code_fk foreign key(escalation_code_id) references project_tool.common_codes(id);
  end if;
end $$;

create index if not exists common_codes_project_group_order_idx on project_tool.common_codes(project_id, group_key, sort_order, label);
create unique index if not exists common_codes_escalation_score_uidx
on project_tool.common_codes(project_id, group_key, (metadata->>'minScore'))
where group_key='escalation_level';
create index if not exists issue_risks_common_codes_idx on project_tool.issue_risks(category_code_id, track_code_id, escalation_code_id);

create or replace function project_tool.touch_common_code()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists common_codes_touch on project_tool.common_codes;
create trigger common_codes_touch before update on project_tool.common_codes
for each row execute function project_tool.touch_common_code();

create or replace function project_tool.validate_issue_common_codes()
returns trigger language plpgsql as $$
begin
  if not exists(select 1 from project_tool.common_codes where id=new.category_code_id and project_id=new.project_id and group_key='category') then
    raise exception 'Invalid category common code';
  end if;
  if not exists(select 1 from project_tool.common_codes where id=new.track_code_id and project_id=new.project_id and group_key='track') then
    raise exception 'Invalid track common code';
  end if;
  if not exists(select 1 from project_tool.common_codes where id=new.escalation_code_id and project_id=new.project_id and group_key='escalation_level') then
    raise exception 'Invalid escalation common code';
  end if;
  return new;
end;
$$;

drop trigger if exists issue_risks_validate_common_codes on project_tool.issue_risks;
create trigger issue_risks_validate_common_codes before insert or update of project_id, category_code_id, track_code_id, escalation_code_id
on project_tool.issue_risks for each row execute function project_tool.validate_issue_common_codes();

create or replace function project_tool.audit_common_code()
returns trigger language plpgsql as $$
declare
  actor_text text := nullif(current_setting('app.actor_id', true), '');
  request_text text := nullif(current_setting('app.request_id', true), '');
begin
  insert into project_tool.audit_logs(project_id, actor_id, action, request_id, before_data, after_data)
  values (coalesce(new.project_id, old.project_id), actor_text::uuid, 'CODE_' || tg_op, request_text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;

drop trigger if exists common_codes_audit on project_tool.common_codes;
create trigger common_codes_audit after insert or update or delete on project_tool.common_codes
for each row execute function project_tool.audit_common_code();



commit;

-- SOURCE: 005_code_groups.sql
begin;

create table if not exists project_tool.common_code_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project_tool.projects(id) on delete cascade,
  code varchar(50) not null check (code ~ '^[A-Za-z][A-Za-z0-9_-]*$'),
  label varchar(100) not null check (length(trim(label)) > 0),
  description varchar(300),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, code)
);

insert into project_tool.common_code_groups(id,project_id,code,label,description,sort_order,is_system) values
  ('70000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','category','유형','이슈·리스크 분류 유형',1,true),
  ('70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','track','관련 Track','프로젝트 수행 영역',2,true),
  ('70000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','escalation_level','에스컬레이션 레벨','확률×영향 점수별 보고 수준',3,true)
on conflict(project_id,code) do nothing;

alter table project_tool.common_codes add column if not exists group_id uuid;

update project_tool.common_codes code set group_id=group_master.id
from project_tool.common_code_groups group_master
where code.group_id is null and code.project_id=group_master.project_id and code.group_key=group_master.code;

alter table project_tool.common_codes alter column group_id set not null;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='common_codes_group_fk') then
    alter table project_tool.common_codes add constraint common_codes_group_fk foreign key(group_id) references project_tool.common_code_groups(id);
  end if;
  if not exists(select 1 from pg_constraint where conname='common_codes_group_code_key') then
    alter table project_tool.common_codes add constraint common_codes_group_code_key unique(group_id,code);
  end if;
end $$;

alter table project_tool.common_codes alter column group_key drop not null;
alter table project_tool.common_codes drop constraint if exists common_codes_group_key_check;

drop index if exists project_tool.common_codes_escalation_score_uidx;
create unique index if not exists common_codes_escalation_score_uidx
on project_tool.common_codes(group_id,(metadata->>'minScore'))
where group_id='70000000-0000-4000-8000-000000000003';
create index if not exists common_codes_group_order_idx on project_tool.common_codes(group_id,is_active,sort_order,label);
create index if not exists common_code_groups_project_order_idx on project_tool.common_code_groups(project_id,is_active,sort_order,label);

create or replace function project_tool.touch_common_code_group()
returns trigger language plpgsql as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists common_code_groups_touch on project_tool.common_code_groups;
create trigger common_code_groups_touch before update on project_tool.common_code_groups
for each row execute function project_tool.touch_common_code_group();

create or replace function project_tool.validate_issue_common_codes()
returns trigger language plpgsql as $$
begin
  if not exists(select 1 from project_tool.common_codes code join project_tool.common_code_groups group_master on group_master.id=code.group_id where code.id=new.category_code_id and code.project_id=new.project_id and group_master.code='category') then
    raise exception 'Invalid category common code';
  end if;
  if not exists(select 1 from project_tool.common_codes code join project_tool.common_code_groups group_master on group_master.id=code.group_id where code.id=new.track_code_id and code.project_id=new.project_id and group_master.code='track') then
    raise exception 'Invalid track common code';
  end if;
  if not exists(select 1 from project_tool.common_codes code join project_tool.common_code_groups group_master on group_master.id=code.group_id where code.id=new.escalation_code_id and code.project_id=new.project_id and group_master.code='escalation_level') then
    raise exception 'Invalid escalation common code';
  end if;
  return new;
end;
$$;

create or replace function project_tool.audit_common_code_group()
returns trigger language plpgsql as $$
declare
  actor_text text := nullif(current_setting('app.actor_id',true),'');
  request_text text := nullif(current_setting('app.request_id',true),'');
begin
  insert into project_tool.audit_logs(project_id,actor_id,action,request_id,before_data,after_data)
  values(coalesce(new.project_id,old.project_id),actor_text::uuid,'GROUP_' || tg_op,request_text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new,old);
end;
$$;

drop trigger if exists common_code_groups_audit on project_tool.common_code_groups;
create trigger common_code_groups_audit after insert or update or delete on project_tool.common_code_groups
for each row execute function project_tool.audit_common_code_group();



commit;


-- SOURCE: 006_remove_legacy_group_key.sql
begin;

drop index if exists project_tool.common_codes_project_group_order_idx;
alter table project_tool.common_codes drop constraint if exists common_codes_project_id_group_key_code_key;
alter table project_tool.common_codes drop column if exists group_key;

commit;

-- SOURCE: 007_work_management.sql
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



commit;

-- SOURCE: 008_work_audit.sql
begin;
alter table project_tool.audit_logs alter column action type varchar(60);

create or replace function project_tool.audit_work_record() returns trigger language plpgsql as $$
declare actor_text text:=nullif(current_setting('app.actor_id',true),''); request_text text:=nullif(current_setting('app.request_id',true),'');
begin
  insert into project_tool.audit_logs(project_id,actor_id,action,request_id,before_data,after_data)
  values(coalesce(new.project_id,old.project_id),coalesce(actor_text::uuid,nullif(to_jsonb(new)->>'created_by','')::uuid),upper(tg_table_name)||'_'||tg_op,request_text,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new,old);
end; $$;

drop trigger if exists project_weeks_audit on project_tool.project_weeks;
create trigger project_weeks_audit after insert or update or delete on project_tool.project_weeks for each row execute function project_tool.audit_work_record();
drop trigger if exists weekly_reports_audit on project_tool.weekly_reports;
create trigger weekly_reports_audit after insert or update or delete on project_tool.weekly_reports for each row execute function project_tool.audit_work_record();
drop trigger if exists weekly_progress_audit on project_tool.weekly_progress;
create trigger weekly_progress_audit after insert or update or delete on project_tool.weekly_progress for each row execute function project_tool.audit_work_record();
drop trigger if exists staff_changes_audit on project_tool.staff_changes;
create trigger staff_changes_audit after insert or update or delete on project_tool.staff_changes for each row execute function project_tool.audit_work_record();
commit;

-- SOURCE: 009_project_information.sql
begin;

alter table project_tool.projects add column if not exists open_method varchar(20) not null default 'phased' check(open_method in ('phased','big_bang'));
alter table project_tool.projects add column if not exists start_date date;
alter table project_tool.projects add column if not exists end_date date;
alter table project_tool.projects add column if not exists first_open_date date;
alter table project_tool.projects add column if not exists second_open_date date;
alter table project_tool.projects add column if not exists go_live_date date;
alter table project_tool.projects add column if not exists customer_name varchar(150) not null default '';
alter table project_tool.projects add column if not exists vendor_name varchar(150) not null default '';
alter table project_tool.projects add column if not exists customer_pm varchar(100) not null default '';
alter table project_tool.projects add column if not exists customer_pmo_count integer not null default 0 check(customer_pmo_count >= 0);
alter table project_tool.projects add column if not exists vendor_pm varchar(100) not null default '';
alter table project_tool.projects add column if not exists vendor_pmo_count integer not null default 0 check(vendor_pmo_count >= 0);
alter table project_tool.projects add column if not exists project_grade varchar(1) not null default 'B' check(project_grade in ('A','B','C'));

do $$ begin
  if not exists(select 1 from pg_constraint where conname='projects_period_check') then
    alter table project_tool.projects add constraint projects_period_check check(start_date is null or end_date is null or end_date >= start_date);
  end if;
  if not exists(select 1 from pg_constraint where conname='projects_open_dates_check') then
    alter table project_tool.projects add constraint projects_open_dates_check check(
      (open_method='phased' and go_live_date is null) or
      (open_method='big_bang' and first_open_date is null and second_open_date is null)
    );
  end if;
end $$;

update project_tool.projects set customer_name='발주사',vendor_name='수행사',customer_pm='발주사 PM',vendor_pm='수행사 PM' where id='20000000-0000-4000-8000-000000000001' and customer_name='';

commit;

-- SOURCE: 010_calendar_events.sql
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

commit;

-- Keep the application schema private until Supabase Auth/RLS is implemented.
revoke all on schema project_tool from anon, authenticated;
grant usage on schema project_tool to service_role;
grant all privileges on all tables in schema project_tool to service_role;
grant all privileges on all sequences in schema project_tool to service_role;
grant execute on all functions in schema project_tool to service_role;
alter default privileges for role postgres in schema project_tool grant all on tables to service_role;
alter default privileges for role postgres in schema project_tool grant all on sequences to service_role;
alter default privileges for role postgres in schema project_tool grant execute on functions to service_role;
