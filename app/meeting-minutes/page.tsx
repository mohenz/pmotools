import { getLocalContext } from "@/lib/server/context";
import { listMeetingMinutes } from "@/lib/server/meeting-minutes";
import { MeetingMinuteListScreen } from "@/screens/MeetingMinuteListScreen";

export const dynamic = "force-dynamic";

const dateParam = (value: string | string[] | undefined) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "");

export default async function MeetingMinutesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { projectId } = await getLocalContext();
  const params = await searchParams;
  const filters = { q: typeof params.q === "string" ? params.q : "", dateFrom: dateParam(params.dateFrom), dateTo: dateParam(params.dateTo) };
  const result = await listMeetingMinutes(projectId, { ...filters, page: typeof params.page === "string" ? Number(params.page) || 1 : 1 });
  return <MeetingMinuteListScreen result={result} filters={filters} />;
}
