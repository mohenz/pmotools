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

grant execute on function project_tool.business_days_since(timestamptz, text) to project_tool_app;

commit;

