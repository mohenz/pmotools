// [WBS2 복사본] 원본: app/work-logs/[id]/page.tsx — 2026-09-29 복사. 원본과 독립 운영(D-1). 원본 수정이 자동 반영되지 않으므로 docs/다중프로젝트_작업절차서.md 7-4 대응표 참고.
import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/mp/context";
import { getWorkLogDetail } from "@/lib/server/mp/work-logs";
import { WorkLogDetailScreen } from "@/screens/mp/WorkLogDetailScreen";

export const dynamic = "force-dynamic";

export default async function WorkLogDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const { projectId, userId } = await getLocalContext();
  const detail = await getWorkLogDetail(projectId, (await params).id, userId);
  if (!detail) notFound();
  const backHref = (await searchParams).from === "manage" ? "/mp-work-logs/manage" : "/mp-work-logs";
  return <WorkLogDetailScreen detail={detail} backHref={backHref} />;
}
