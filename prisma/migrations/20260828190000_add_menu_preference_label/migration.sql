-- Store project-specific display names for configurable navigation items.
ALTER TABLE "menu_preferences" ADD COLUMN "label" TEXT;

UPDATE "menu_preferences"
SET "label" = CASE "menuKey"
  WHEN 'portfolio' THEN '통합 현황'
  WHEN 'management-tasks' THEN '관리업무'
  WHEN 'pmo-daily' THEN 'PMO Daily'
  WHEN 'work-logs' THEN '업무일지'
  WHEN 'calendar' THEN '캘린더'
  WHEN 'meetrooms' THEN '회의실'
  WHEN 'items' THEN '이슈 관리'
  WHEN 'requirements' THEN '요구사항관리'
  WHEN 'announcements' THEN '공지사항'
  WHEN 'weekly-reports' THEN '위클리리포트'
  WHEN 'weekly-progress' THEN '주간실적'
  WHEN 'staff-changes' THEN '인력변동'
  WHEN 'messages' THEN '초청'
  WHEN 'manuals' THEN '매뉴얼'
  ELSE "menuKey"
END;

ALTER TABLE "menu_preferences" ALTER COLUMN "label" SET NOT NULL;
