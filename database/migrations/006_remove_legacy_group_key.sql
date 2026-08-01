begin;

drop index if exists project_tool.common_codes_project_group_order_idx;
alter table project_tool.common_codes drop constraint if exists common_codes_project_id_group_key_code_key;
alter table project_tool.common_codes drop column if exists group_key;

commit;
