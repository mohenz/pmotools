-- CreateTable
CREATE TABLE "menu_preferences" (
    "projectId" TEXT NOT NULL,
    "menuKey" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_preferences_pkey" PRIMARY KEY ("projectId","menuKey")
);

-- AddForeignKey
ALTER TABLE "menu_preferences" ADD CONSTRAINT "menu_preferences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
