import { notFound } from "next/navigation";
import { canViewAllWbs } from "@/lib/domain/job-access";
import { getLocalContext } from "@/lib/server/context";
import { getWbsOwnerStatus } from "@/lib/server/wbs";
import { WbsOwnerStatusScreen } from "@/screens/WbsOwnerStatusScreen";

export const dynamic = "force-dynamic";

export default async function WbsOwnerStatusPage({ params }: { params: Promise<{ loginId: string }> }) {
  const { loginId } = await params;
  const { projectId, loginId: ownLoginId, role } = await getLocalContext();
  if (!canViewAllWbs(role) && loginId !== ownLoginId) notFound();
  const status = await getWbsOwnerStatus(projectId, loginId);
  if (!status) notFound();
  return <WbsOwnerStatusScreen status={status} />;
}
