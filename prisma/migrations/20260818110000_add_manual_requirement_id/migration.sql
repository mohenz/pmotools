ALTER TABLE "requirements" ADD COLUMN "requirementId" TEXT;

CREATE UNIQUE INDEX "requirements_projectId_requirementId_key"
ON "requirements"("projectId", "requirementId");
