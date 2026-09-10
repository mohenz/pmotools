import { requireManagerContext } from "@/lib/server/context";
import { WbsManageScreen } from "@/screens/WbsManageScreen";

export const dynamic = "force-dynamic";

export default async function WbsManagePage() {
  await requireManagerContext();
  return <WbsManageScreen />;
}
