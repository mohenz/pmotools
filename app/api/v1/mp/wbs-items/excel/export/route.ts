// [WBS2 복사본] 원본: app/api/v1/wbs-items/excel/export/route.ts — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { getLocalContext } from "@/lib/server/mp/context";
import { exportWbsToExcel } from "@/lib/server/mp/wbs-excel";

export async function GET() {
  const { projectId } = await getLocalContext();
  const buffer = await exportWbsToExcel(projectId);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="wbs-${date}.xlsx"`,
    },
  });
}
