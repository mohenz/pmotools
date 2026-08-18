CREATE TYPE "AnnouncementAudience" AS ENUM ('ALL', 'MANAGERS');

CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "audience" "AnnouncementAudience" NOT NULL DEFAULT 'ALL',
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "showOnDashboard" BOOLEAN NOT NULL DEFAULT false,
    "dashboardVisibleTo" DATE,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATE,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "authorId" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_projectId_deletedAt_isImportant_publishedAt_idx" ON "announcements"("projectId", "deletedAt", "isImportant", "publishedAt");
CREATE INDEX "announcements_projectId_showOnDashboard_dashboardVisibleTo_idx" ON "announcements"("projectId", "showOnDashboard", "dashboardVisibleTo");

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
