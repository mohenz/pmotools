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

grant select,insert,update on project_tool.common_code_groups to project_tool_app;

commit;

