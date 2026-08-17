import { getLocalContext } from "@/lib/server/context";
import { listMeetingReservations, listMeetingRooms, listRecurringMeetings } from "@/lib/server/meeting-rooms";
import { MeetingRoomScreen } from "@/features/meetrooms/MeetingRoomScreen";
import { listProjectMembers } from "@/lib/server/users";

export const dynamic = "force-dynamic";

export default async function MeetingRoomsPage() {
  const context = await getLocalContext();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const from = new Date(`${date}T00:00:00+09:00`), to = new Date(`${date}T24:00:00+09:00`);
  const [rooms, reservations, recurring, members] = await Promise.all([
    listMeetingRooms(context.projectId, false),
    listMeetingReservations(context.projectId, from, to),
    listRecurringMeetings(context.projectId, context.userId, false),
    listProjectMembers(context.projectId),
  ]);
  return <MeetingRoomScreen initialDate={date} initialRooms={rooms} initialReservations={reservations} initialRecurring={JSON.parse(JSON.stringify(recurring))} members={members} currentUserId={context.userId} isAdmin={context.role === "ADMIN"} />;
}
