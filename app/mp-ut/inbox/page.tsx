import { getMpScope } from "@/lib/server/mp/context";
import { listUtCodes } from "@/lib/server/mp/ut/common";
import { listMyUtExecutionTargets, listUtApprovalInbox } from "@/lib/server/mp/ut/executions";
import { listUtReviewInbox } from "@/lib/server/mp/ut/scenarios";
import { UtInboxScreen } from "@/screens/mp/ut/UtInboxScreen";

export const dynamic = "force-dynamic";

// 단위테스트 수행관리(설계서: docs/단위테스트 수행관리 프로그램 설계서.md 8장) — 다중 프로젝트(MP) 계열, 대상 프로젝트 선택 상자 사용.
export default async function UtInboxPage() {
  const scope = await getMpScope();
  const { userId, projectId } = scope.context;
  const [targets, reviews, qc, pl, codes] = await Promise.all([
    listMyUtExecutionTargets(scope.projectIds, userId), listUtReviewInbox(scope.projectIds, userId),
    listUtApprovalInbox(scope.projectIds, userId, "QC"), listUtApprovalInbox(scope.projectIds, userId, "PL"), listUtCodes(projectId),
  ]);
  return <UtInboxScreen data={{ targets, reviews, qc, pl }} rejectReasons={codes.rejectReasons} />;
}
