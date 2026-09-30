import { todayInKorea } from "@/lib/domain/meeting-action-items";
import { getLocalContext } from "@/lib/server/context";
import { listMeetingActionItems } from "@/lib/server/meeting-action-items";
import { MeetingActionItemListScreen, type MeetingActionItemScreenFilters } from "@/screens/MeetingActionItemListScreen";

export const dynamic = "force-dynamic";

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
const dateParam = (value: string | string[] | undefined) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");

export default async function MeetingActionItemsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId, userId } = await getLocalContext();
  const params = await searchParams;
  const filters: MeetingActionItemScreenFilters = {
    status: text(params.status), overdue: params.overdue === "y", mine: params.mine === "y",
    assignee: text(params.assignee), q: text(params.q), dateFrom: dateParam(params.dateFrom), dateTo: dateParam(params.dateTo),
  };
  const today = todayInKorea();
  const result = await listMeetingActionItems(projectId, userId, today, { ...filters, page: Number(text(params.page)) || 1 });
  return <MeetingActionItemListScreen result={result} filters={filters} today={today} />;
}
