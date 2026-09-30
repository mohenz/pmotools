import { getLocalContext } from "@/lib/server/context";
import { getMeetingMinuteDraft } from "@/lib/server/meeting-minutes";
import { listProjectMembers } from "@/lib/server/users";
import { MeetingMinuteFormScreen } from "@/screens/MeetingMinuteFormScreen";

export const dynamic = "force-dynamic";

export default async function NewMeetingMinutePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId, userId } = await getLocalContext();
  const params = await searchParams;
  const source = { calendarEventId: typeof params.calendarEventId === "string" ? params.calendarEventId : undefined, reservationId: typeof params.reservationId === "string" ? params.reservationId : undefined };
  const [draft, members] = await Promise.all([getMeetingMinuteDraft(projectId, userId, source), listProjectMembers(projectId)]);
  return <MeetingMinuteFormScreen initial={draft} members={members} />;
}
