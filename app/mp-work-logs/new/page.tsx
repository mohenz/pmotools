// [WBS2 복사본] 원본: app/work-logs/new/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { getLocalContext } from "@/lib/server/mp/context";
import { getCodeOptions } from "@/lib/server/common-codes";
import { getWorkLogIdentity } from "@/lib/server/mp/work-logs";
import { listWbsTaskOptionsForOwner } from "@/lib/server/mp/wbs";
import { WorkLogFormScreen } from "@/screens/mp/WorkLogFormScreen";

export const dynamic = "force-dynamic";

export default async function NewWorkLogPage() {
  const { projectId, userId } = await getLocalContext();
  const [identity, options, wbsOptions] = await Promise.all([getWorkLogIdentity(projectId, userId), getCodeOptions(projectId), listWbsTaskOptionsForOwner(projectId, userId)]);
  const groups = identity.group ? [{ id: identity.group.id, groupId: identity.group.id, groupCode: "track", groupLabel: "업무그룹", code: identity.group.code, label: identity.group.label, sortOrder: 0, isActive: true, minScore: null }] : [];
  return <WorkLogFormScreen mode="create" groups={groups} deliverableExtensions={options.deliverableExtensions} assigneeName={identity.name} wbsOptions={wbsOptions} />;
}
