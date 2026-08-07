import { getLocalContext } from "@/lib/server/context";
import { listMessages } from "@/lib/server/messages";
import { listProjectMembers } from "@/lib/server/users";
import { MessagesScreen } from "@/screens/MessagesScreen";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  const { userId, projectId } = await getLocalContext();
  const box = (await searchParams).box === "sent" ? "sent" as const : "received" as const;
  const [messages, members] = await Promise.all([listMessages(userId, box), listProjectMembers(projectId)]);
  return <MessagesScreen messages={messages} members={members} box={box} />;
}
