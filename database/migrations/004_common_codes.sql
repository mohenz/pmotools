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

grant select, insert, update on project_tool.common_codes to project_tool_app;

commit;
