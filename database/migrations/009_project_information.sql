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
