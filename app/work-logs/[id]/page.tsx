import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getWorkLogDetail } from "@/lib/server/work-logs";
import { WorkLogDetailScreen } from "@/screens/WorkLogDetailScreen";

export const dynamic = "force-dynamic";

export default async function WorkLogDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { projectId, userId } = await getLocalContext();
  const detail = await getWorkLogDetail(projectId, (await params).id, userId);
  if (!detail) notFound();
  const backHref = (await searchParams).from === "manage" ? "/work-logs/manage" : "/work-logs";
  return <WorkLogDetailScreen detail={detail} backHref={backHref} />;
}
