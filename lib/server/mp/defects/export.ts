import "server-only";
import ExcelJS from "exceljs";
import type { listDefects } from "@/lib/server/mp/defects/defects";

type Row = Awaited<ReturnType<typeof listDefects>>["rows"][number];
const CLASS_LABEL: Record<string, string> = { OPEN: "미조치", DONE: "조치완료", CLOSED: "종결" };

// DM-01 목록 엑셀 — 현재 조회 범위·필터 결과를 그대로 출력한다.
export async function buildDefectWorkbook(rows: Row[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("결함 목록");
  ws.addRow(["결함번호", "제목", "테스트 단계", "심각도", "우선순위", "상태", "상태 분류", "조치자", "등록자", "업무단위", "화면경로", "등록일", "조치 예정일"]);
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow([r.displayId, r.title, r.testStage, r.severity, r.priority ?? "", r.status, CLASS_LABEL[r.statusClass] ?? r.statusClass, r.assignee?.name ?? "(미배정)", r.creator, r.group ?? "", r.screenPath, r.createdAt.slice(0, 10), r.actionDueDate ?? ""]);
  [18, 50, 12, 10, 10, 12, 10, 14, 12, 14, 30, 12, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
