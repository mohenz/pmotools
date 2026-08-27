ALTER TABLE "groups" ADD COLUMN "leaderId" TEXT;

CREATE INDEX "groups_leaderId_idx" ON "groups"("leaderId");

ALTER TABLE "groups"
ADD CONSTRAINT "groups_leaderId_fkey"
FOREIGN KEY ("leaderId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
