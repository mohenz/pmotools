import { notFound } from "next/navigation";
import { requireManagerContext } from "@/lib/server/context";
import { getAnnouncement } from "@/lib/server/announcements";
import { AnnouncementFormScreen } from "@/screens/AnnouncementFormScreen";

export const dynamic = "force-dynamic";

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { projectId, userId } = await requireManagerContext();
  const announcement = await getAnnouncement(projectId, userId, (await params).id);
  if (!announcement) notFound();
  return <AnnouncementFormScreen announcement={announcement} />;
}
