import "server-only";

import { getPrisma } from "@/lib/server/db-pg";
import type { MenuAppScope } from "@/lib/generated/prisma/enums";

export async function getLoginImage(scope: MenuAppScope) {
  return getPrisma().loginImage.findUnique({ where: { scope } });
}

export async function setLoginImage(scope: MenuAppScope, buffer: Buffer, mimeType: string, updatedBy: string | null) {
  const data = new Uint8Array(buffer);
  return getPrisma().loginImage.upsert({
    where: { scope },
    create: { scope, data, mimeType, updatedBy },
    update: { data, mimeType, updatedBy },
  });
}

export async function resetLoginImage(scope: MenuAppScope) {
  await getPrisma().loginImage.deleteMany({ where: { scope } });
}
