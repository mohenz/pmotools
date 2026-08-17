import { redirect } from "next/navigation";
import { getLocalContext } from "@/lib/server/context";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const { role } = await getLocalContext();
  const isManager = role === "ADMIN" || role === "OPERATOR";
  redirect(isManager ? "/portfolio" : "/calendar");
}
