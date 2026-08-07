-- 최소 방어선: Supabase의 공개 Data API(PostgREST, anon/authenticated 롤)가 이 테이블들을
-- 직접 읽거나 쓰지 못하도록 RLS를 켠다. 정책을 하나도 만들지 않으므로 anon/authenticated는 항상 거부되고,
-- 애플리케이션은 테이블 소유자(postgres) 커넥션으로 Prisma를 통해서만 접근하므로 영향을 받지 않는다.
-- (테이블 소유자는 기본적으로 RLS를 우회한다 — FORCE ROW LEVEL SECURITY를 사용하지 않는 한 그대로 유지)

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."project_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_group_map" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."common_code_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."common_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."item_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."item_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."weeks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."weekly_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."weekly_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."staff_changes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_exceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_assignees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_group_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
