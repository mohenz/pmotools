import { NextRequest } from "next/server";
import { probabilityLabel, statusLabels } from "@/lib/domain/items";
import { csvCell } from "@/lib/domain/csv";
import { getLocalContext } from "@/lib/server/context";
import { listItemsForExport } from "@/lib/server/items";

export async function GET(request: NextRequest) {
  const { projectId } = getLocalContext();
  const params = request.nextUrl.searchParams;
  const items = await listItemsForExport(projectId, {
    q: params.get("q") ?? undefined, kind: params.get("kind") ?? undefined,
    status: params.get("status") ?? undefined, category: params.get("category") ?? undefined,
    probability: params.get("probability") ?? undefined, impact: params.get("impact") ?? undefined,
    open: params.get("open") === "true", stale: params.get("stale") === "true",
  });
  const header = ["ID", "구분", "유형", "제목", "Track", "확률", "영향", "레벨", "상태", "담당자", "최종갱신"];
  const rows = items.map((item) => [item.displayId, item.kind === "issue" ? "이슈" : "리스크", item.categoryLabel,
    item.title, item.trackName, probabilityLabel(item.probability), probabilityLabel(item.impact), item.escalationLabel,
    statusLabels[item.status], item.ownerName ?? "", item.updatedAt]);
  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="issue-risks-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
