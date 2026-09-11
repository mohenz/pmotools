import { getLocalContext } from "@/lib/server/context";
import { listAnnouncements } from "@/lib/server/announcements";
import { AnnouncementListScreen } from "@/screens/AnnouncementListScreen";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const page = typeof params.page === "string" ? Number(params.page) || 1 : 1;
  const { projectId, userId, role } = await getLocalContext();
  return <AnnouncementListScreen result={await listAnnouncements(projectId, userId, q, page)} q={q} isManager={role === "ADMIN" || role === "OPERATOR" || role === "SUPER_ADMIN"} />;
}
