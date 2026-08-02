select
  count(*) filter (where table_type = 'BASE TABLE') as table_count,
  count(*) filter (where table_name = 'projects') as projects_table,
  count(*) filter (where table_name = 'issue_risks') as issue_risks_table,
  count(*) filter (where table_name = 'calendar_events') as calendar_events_table
from information_schema.tables
where table_schema = 'project_tool';

select
  (select count(*) from project_tool.projects) as projects,
  (select count(*) from project_tool.profiles) as profiles,
  (select count(*) from project_tool.common_code_groups) as code_groups,
  (select count(*) from project_tool.common_codes) as common_codes;
