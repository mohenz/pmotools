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
  const embedded = query.embedded === "1";
  // 로그인 화면의 "회의실 예약현황 조회" 공개 미리보기(embedded=1)는 실제 로그인 상태(관리자가 미리보기를
  // 열어도)와 무관하게 항상 읽기 전용으로 보여준다.
  return <MeetingRoomScreen initialDate={date} initialRooms={rooms} initialReservations={reservations} initialRecurring={JSON.parse(JSON.stringify(recurring))} members={members} currentUserId={context?.id ?? null} isAdmin={context?.role === "ADMIN" || context?.role === "SUPER_ADMIN"} readOnly={!context || embedded} embedded={embedded} />;
}
