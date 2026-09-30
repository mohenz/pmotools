import { notFound, redirect } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getMeetingMinute } from "@/lib/server/meeting-minutes";
import { listProjectMembers } from "@/lib/server/users";
import { MeetingMinuteFormScreen } from "@/screens/MeetingMinuteFormScreen";

export const dynamic = "force-dynamic";

export default async function EditMeetingMinutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projectId, userId } = await getLocalContext();
  const [minute, members] = await Promise.all([getMeetingMinute(projectId, id, userId), listProjectMembers(projectId)]);
  if (!minute) notFound();
  if (!minute.canEdit) redirect(`/meeting-minutes/${id}`);
  return <MeetingMinuteFormScreen initial={minute} members={members} minuteId={id} version={minute.version} />;
}
