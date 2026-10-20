import { getMpScope } from "@/lib/server/mp/context";
import { listUtCodes } from "@/lib/server/mp/ut/common";
import { listUtApprovalInbox } from "@/lib/server/mp/ut/executions";
import { getUtWbsTree, wbsSubtreeDisplayIds } from "@/lib/server/mp/ut/grid";
import { UtApprovalInboxScreen } from "@/screens/mp/ut/UtApprovalInboxScreen";

export const dynamic = "force-dynamic";

// 단위테스트(설계서 8장 화면 ID 기준) — 다중 프로젝트(MP) 계열, 좌측 WBS 트리 고정.
// UT-031 QC 확인함
export default async function UtQcInboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  const scope = await getMpScope();
  if (scope.isTopLevel) return <div className="content"><p className="action-message">단위테스트는 하위 프로젝트 단위로 관리합니다. 상단에서 하위 프로젝트를 선택해 주세요.</p></div>;
  const c = scope.context;
  const [tree, rows, codes, only] = await Promise.all([getUtWbsTree(c.projectId), listUtApprovalInbox([c.projectId], c.userId, "QC"), listUtCodes(c.projectId), wbsSubtreeDisplayIds(c.projectId, pick("wbs") || undefined)]);
  return <UtApprovalInboxScreen step="QC" tree={tree} rows={only ? rows.filter((r) => only.has(r.wbsDisplayId)) : rows} rejectReasons={codes.rejectReasons} />;
}
