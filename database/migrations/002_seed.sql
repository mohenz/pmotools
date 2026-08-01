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

