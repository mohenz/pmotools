import { getLocalContext } from "@/lib/server/context";
import { listReceivedInvitations } from "@/lib/server/messages";
import { MessagesScreen } from "@/screens/MessagesScreen";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { userId } = await getLocalContext();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await listReceivedInvitations(userId, { page, pageSize: 20 });
  return <MessagesScreen result={result} />;
}
