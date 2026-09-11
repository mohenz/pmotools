import { requireManagerContext } from "@/lib/server/context";
import { listMeetingRooms } from "@/lib/server/meeting-rooms";
import { RoomManagementScreen } from "@/features/meetrooms/RoomManagementScreen";

export const dynamic = "force-dynamic";

export default async function MeetingRoomsSettingsPage() {
  const { projectId } = await requireManagerContext();
  const rooms = await listMeetingRooms(projectId, true);
  return <RoomManagementScreen initialRooms={rooms} />;
}
