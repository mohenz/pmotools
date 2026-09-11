import { getLocalContext } from "@/lib/server/context";
import { exportWbsToExcel } from "@/lib/server/wbs-excel";

export async function GET() {
  const { projectId } = await getLocalContext();
  const buffer = await exportWbsToExcel(projectId);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="wbs-${date}.xlsx"`,
    },
  });
}
