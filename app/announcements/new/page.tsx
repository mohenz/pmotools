import { requireManagerContext } from "@/lib/server/context";
import { AnnouncementFormScreen } from "@/screens/AnnouncementFormScreen";

export const dynamic = "force-dynamic";

export default async function NewAnnouncementPage() { await requireManagerContext(); return <AnnouncementFormScreen />; }
