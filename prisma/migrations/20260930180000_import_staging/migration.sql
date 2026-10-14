-- 엑셀 업로드 임시 저장(스테이징) — WBS2 · 요구사항관리2 (2026-09-30)
-- 수기 작성: prisma migrate diff가 백오피스 전용 테이블(main_menus/sub_menus) DROP을 끼워 넣으므로 직접 작성한다.

-- CreateEnum
CREATE TYPE "ImportBatchKind" AS ENUM ('WBS', 'REQUIREMENT');
CREATE TYPE "ImportRowStatus" AS ENUM ('OK', 'ERROR');

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ImportBatchKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "headers" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_batch_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "cells" JSONB NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'OK',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "import_batch_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_projectId_kind_uploadedBy_key" ON "import_batches"("projectId", "kind", "uploadedBy");
CREATE UNIQUE INDEX "import_batch_rows_batchId_rowNo_key" ON "import_batch_rows"("batchId", "rowNo");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_batch_rows" ADD CONSTRAINT "import_batch_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
