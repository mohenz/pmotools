import { NextRequest } from "next/server";
import { getLocalContext } from "@/lib/server/context";
import { exportMonthToExcel } from "@/lib/server/calendar-excel";

export async function GET(request: NextRequest) {
  const { projectId } = await getLocalContext();
  const month = request.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const buffer = await exportMonthToExcel(projectId, month);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="calendar-${month}.xlsx"`,
    },
  });
}
