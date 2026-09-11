import { requireManagerContext } from "@/lib/server/context";
import { RequirementExcelClient } from "@/features/requirements/RequirementExcelClient";

export const dynamic = "force-dynamic";

export default async function RequirementExcelPage() {
  await requireManagerContext();
  return <RequirementExcelClient />;
}
