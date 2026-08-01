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
