import { getLocalContext } from "@/lib/server/context";
import { exportRequirementsToExcel } from "@/lib/server/requirements-excel";

export async function GET() {
  const { projectId } = await getLocalContext();
  const buffer = await exportRequirementsToExcel(projectId);
  const today = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="requirements-${today}.xlsx"`,
    },
  });
}
