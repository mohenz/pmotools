import { getLocalContext } from "@/lib/server/context";
import { listReceivedInvitations } from "@/lib/server/messages";
import { MessagesScreen } from "@/screens/MessagesScreen";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const { userId } = await getLocalContext();
  const invitations = await listReceivedInvitations(userId);
  return <MessagesScreen invitations={invitations} />;
}
