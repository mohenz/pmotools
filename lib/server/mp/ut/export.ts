import "server-only";
import ExcelJS from "exceljs";
import { UT_DEFECT_STATUS_LABEL, UT_VERDICT_LABEL, UT_VERIFICATION_LABEL, type UtDefectStatus, type UtVerdict, type UtVerificationResult } from "@/lib/domain/ut";
import type { UtRunRow } from "@/lib/server/mp/ut/defects";

// 설계서 5.1 테스트 수행·결함 관리 양식 — 13개 열을 정해진 순서·명칭으로 출력하고, 식별·상태 열을 뒤에 붙인다.
export const UT_RUN_COLUMNS = ["업무단위", "테스트케이스ID", "테스트케이스명", "테스트스텝", "결함내용", "담당자", "테스트수행일", "화면ID", "조치일", "조치자", "검증결과", "검증일자", "검증자"] as const;

export async function buildUtRunWorkbook(rows: UtRunRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("수행·결함");
  sheet.addRow([...UT_RUN_COLUMNS, "차수", "판정", "결함ID", "결함상태"]);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) {
    sheet.addRow([
      r.unit, r.caseDisplayId, r.caseName, r.steps, r.description, r.executorName, r.executedOn ?? "", r.screenId,
      r.fixedAt ?? "", r.fixerName ?? "", r.verificationResult ? UT_VERIFICATION_LABEL[r.verificationResult as UtVerificationResult] : "", r.verifiedAt ?? "", r.verifierName ?? "",
      r.roundNo, UT_VERDICT_LABEL[r.verdict as UtVerdict], r.defectDisplayId ?? "", r.defectStatus ? UT_DEFECT_STATUS_LABEL[r.defectStatus as UtDefectStatus] : "",
    ]);
  }
  [14, 22, 28, 40, 40, 10, 12, 12, 12, 10, 10, 12, 10, 6, 8, 16, 10].forEach((width, i) => { sheet.getColumn(i + 1).width = width; });
  sheet.getColumn(4).alignment = { wrapText: true, vertical: "top" };
  sheet.getColumn(5).alignment = { wrapText: true, vertical: "top" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
