import "server-only";
import { z } from "zod";
import { hash, compare } from "bcryptjs";
import { getPrisma } from "@/lib/server/db-pg";
import { encryptWithPassword, decryptWithPassword } from "@/lib/domain/crypto";
import { DomainError } from "@/lib/server/errors";

export type MessageSummary = { id: string; counterpartName: string; counterpartUserId: string; isRead: boolean; createdAt: string; direction: "sent" | "received" };

export async function listMessages(userId: string, box: "received" | "sent"): Promise<MessageSummary[]> {
  const prisma = getPrisma();
  const messages = await prisma.message.findMany({
    where: box === "received" ? { receiverId: userId } : { senderId: userId },
    include: { sender: { select: { name: true, userId: true } }, receiver: { select: { name: true, userId: true } } },
    orderBy: { createdAt: "desc" },
  });
  return messages.map((m) => ({
    id: m.id,
    counterpartName: box === "received" ? m.sender.name : m.receiver.name,
    counterpartUserId: box === "received" ? m.sender.userId : m.receiver.userId,
    isRead: m.isRead,
    createdAt: m.createdAt.toISOString(),
    direction: box === "received" ? "received" : "sent",
  }));
}

export async function unreadMessageCount(userId: string): Promise<number> {
  return getPrisma().message.count({ where: { receiverId: userId, isRead: false } });
}

const sendSchema = z.object({ receiverUserId: z.string().trim().min(1), content: z.string().trim().min(1).max(5000), viewPassword: z.string().min(4).max(100) });
export async function sendMessage(senderId: string, input: unknown) {
  const data = sendSchema.parse(input);
  const prisma = getPrisma();
  const receiver = await prisma.user.findUnique({ where: { userId: data.receiverUserId } });
  if (!receiver) throw new DomainError("NOT_FOUND", "받는 사람을 찾을 수 없습니다.");
  if (receiver.id === senderId) throw new DomainError("INVALID_CODE", "본인에게는 쪽지를 보낼 수 없습니다.");
  const { contentEncrypted, contentIv } = encryptWithPassword(data.content, data.viewPassword);
  const viewPasswordHash = await hash(data.viewPassword, 10);
  const message = await prisma.message.create({ data: { senderId, receiverId: receiver.id, contentEncrypted, contentIv, viewPasswordHash } });
  return { id: message.id };
}

const viewSchema = z.object({ password: z.string().min(1) });
export async function viewMessage(userId: string, messageId: string, input: unknown) {
  const data = viewSchema.parse(input);
  const prisma = getPrisma();
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || (message.receiverId !== userId && message.senderId !== userId)) throw new DomainError("NOT_FOUND", "쪽지를 찾을 수 없습니다.");
  const passwordOk = await compare(data.password, message.viewPasswordHash);
  if (!passwordOk) throw new DomainError("FORBIDDEN", "조회 비밀번호가 일치하지 않습니다.");
  const content = decryptWithPassword(message.contentEncrypted, message.contentIv, data.password);
  if (content === null) throw new DomainError("FORBIDDEN", "조회 비밀번호가 일치하지 않습니다.");
  if (message.receiverId === userId && !message.isRead) await prisma.message.update({ where: { id: messageId }, data: { isRead: true } });
  return { content };
}
