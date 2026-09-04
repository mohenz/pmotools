-- "이력은 쌓이는 로그가 아니라 다른 필드와 같은 수준으로 관리·표시되는 정보여야 한다"는 요청에 따라
-- 자동 누적되는 이슈 변경이력 로그(issue_events)를 제거한다. 계정별 변경 감사는 기존 audit_logs로 계속 남는다.
DROP TABLE "issue_events";
DROP TYPE "IssueEventType";
