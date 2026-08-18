import { redirect } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  await getLocalContext();
  redirect("/announcements");
}
