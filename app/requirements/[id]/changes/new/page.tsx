import { notFound } from "next/navigation";
import { requireManagerContext } from "@/lib/server/context";
import { getRequirementDetail } from "@/lib/server/requirements";
import { RequirementChangeCreateScreen } from "@/screens/RequirementChangeCreateScreen";

export const dynamic = "force-dynamic";

export default async function RequirementChangeNewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId } = await requireManagerContext();
  const detail = await getRequirementDetail(projectId, id);
  if (!detail) notFound();
  return <RequirementChangeCreateScreen requirement={detail.requirement} />;
}
