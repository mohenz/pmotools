import { listMeetingReservations, listMeetingRooms, listRecurringMeetings } from "@/lib/server/meeting-rooms";
import { MeetingRoomScreen } from "@/features/meetrooms/MeetingRoomScreen";
import { listProjectMembers } from "@/lib/server/users";
import { auth } from "@/lib/server/auth";
import { DEFAULT_PROJECT_ID } from "@/lib/domain/constants";

export const dynamic = "force-dynamic";

export default async function MeetingRoomsPage({ searchParams }: { searchParams: Promise<{ embedded?: string }> }) {
  const query = await searchParams;
  const session = await auth();
  const context = session?.user ?? null;
  const projectId = context?.projectId ?? DEFAULT_PROJECT_ID;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const from = new Date(`${date}T00:00:00+09:00`), to = new Date(`${date}T24:00:00+09:00`);
  const [rooms, reservations, recurring, members] = await Promise.all([
    listMeetingRooms(projectId, false),
    listMeetingReservations(projectId, from, to),
    context ? listRecurringMeetings(projectId, context.id, false) : Promise.resolve([]),
    context ? listProjectMembers(projectId) : Promise.resolve([]),
  ]);
  return <MeetingRoomScreen initialDate={date} initialRooms={rooms} initialReservations={reservations} initialRecurring={JSON.parse(JSON.stringify(recurring))} members={members} currentUserId={context?.id ?? null} isAdmin={context?.role === "ADMIN" || context?.role === "SUPER_ADMIN"} readOnly={!context} embedded={query.embedded === "1"} />;
}
