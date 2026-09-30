-- WBS상세내용(업무일지)에 산출물명/산출물 확장자 필드를 추가한다.

CREATE TYPE "DeliverableExtension" AS ENUM ('PPTX', 'XLSX', 'DOCX', 'PDF', 'MD', 'TXT');

ALTER TABLE "work_logs" ADD COLUMN "deliverableName" TEXT;
ALTER TABLE "work_logs" ADD COLUMN "deliverableExtension" "DeliverableExtension";
