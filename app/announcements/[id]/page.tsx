import { notFound } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";
import { getAnnouncement } from "@/lib/server/announcements";
import { AnnouncementDetailScreen } from "@/screens/AnnouncementDetailScreen";

export const dynamic = "force-dynamic";

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId, role } = await getLocalContext();
  const announcement = await getAnnouncement(projectId, userId, (await params).id, true);
  if (!announcement) notFound();
  return <AnnouncementDetailScreen announcement={announcement} isManager={role === "ADMIN" || role === "OPERATOR"} />;
}
