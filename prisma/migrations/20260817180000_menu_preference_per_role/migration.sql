-- AlterTable: replace the single "visible" flag with per-role visibility.
ALTER TABLE "menu_preferences" ADD COLUMN "visibleAdmin" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "menu_preferences" ADD COLUMN "visibleOperator" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "menu_preferences" ADD COLUMN "visibleMember" BOOLEAN NOT NULL DEFAULT true;

UPDATE "menu_preferences" SET "visibleAdmin" = "visible", "visibleOperator" = "visible", "visibleMember" = "visible";

ALTER TABLE "menu_preferences" DROP COLUMN "visible";
