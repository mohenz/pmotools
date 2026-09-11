CREATE TABLE "portfolio_panel_preferences" (
  "projectId" TEXT NOT NULL,
  "panelKey" TEXT NOT NULL,
  "visible" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "portfolio_panel_preferences_pkey" PRIMARY KEY ("projectId", "panelKey")
);

ALTER TABLE "portfolio_panel_preferences"
  ADD CONSTRAINT "portfolio_panel_preferences_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
