import { requireManagerContext } from "@/lib/server/context";
import { listMeetingRooms, listRecurringMeetingApplicants, listRecurringMeetingsPaged } from "@/lib/server/meeting-rooms";
import { RecurringManagementScreen } from "@/features/meetrooms/RecurringManagementScreen";

export const dynamic = "force-dynamic";

export default async function RecurringMeetingsSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await requireManagerContext();
  const p = await searchParams;
  const value = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");
  const filters = { status: value("status"), roomId: value("roomId"), applicantId: value("applicantId"), page: Number(value("page")) || 1, pageSize: [20, 40, 60, 80, 100].includes(Number(value("pageSize"))) ? Number(value("pageSize")) : 20 };
  const [result, rooms, applicants] = await Promise.all([listRecurringMeetingsPaged(projectId, filters), listMeetingRooms(projectId), listRecurringMeetingApplicants(projectId)]);
  return <RecurringManagementScreen result={JSON.parse(JSON.stringify(result))} filters={filters} rooms={rooms} applicants={applicants} />;
}
