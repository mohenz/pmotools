import { requireManagerContext } from "@/lib/server/context";
import { CalendarExcelClient } from "@/features/calendar/CalendarExcelClient";

export const dynamic = "force-dynamic";

export default async function CalendarExcelPage() {
  await requireManagerContext();
  return <CalendarExcelClient />;
}
