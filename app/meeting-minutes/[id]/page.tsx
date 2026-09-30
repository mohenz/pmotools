import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getMeetingMinute } from "@/lib/server/meeting-minutes";
import { MeetingMinuteDetailScreen } from "@/screens/MeetingMinuteDetailScreen";

export const dynamic = "force-dynamic";

export default async function MeetingMinuteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  const minute = await getMeetingMinute(projectId, id, userId);
  if (!minute) notFound();
  return <MeetingMinuteDetailScreen minute={minute} />;
}
