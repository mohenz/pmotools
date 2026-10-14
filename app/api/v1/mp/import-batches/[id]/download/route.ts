import { getLocalContext } from "@/lib/server/mp/context";
import { mutationErrorResponse } from "@/lib/server/http";
import { downloadImportBatch } from "@/lib/server/mp/import-staging";

type RouteContext = { params: Promise<{ id: string }> };

// 현재 임시 내용(화면 수정 반영)을 엑셀로 내려받기 — 올린 사람만
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, userId } = await getLocalContext();
    const { buffer, fileName } = await downloadImportBatch(projectId, userId, (await params).id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="import.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) { return mutationErrorResponse(error); }
}
