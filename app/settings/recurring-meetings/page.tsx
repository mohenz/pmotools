import { requireManagerContext } from "@/lib/server/context";
import { listRecurringMeetings } from "@/lib/server/meeting-rooms";
import { RecurringApprovalScreen } from "@/features/meetrooms/RecurringApprovalScreen";

export const dynamic = "force-dynamic";

export default async function RecurringMeetingsSettingsPage() {
  const { projectId, userId } = await requireManagerContext();
  const recurring = await listRecurringMeetings(projectId, userId, true);
  return <RecurringApprovalScreen initialRecurring={JSON.parse(JSON.stringify(recurring))} />;
}
