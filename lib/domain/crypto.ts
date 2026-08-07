import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT_LEN = 16, IV_LEN = 12, TAG_LEN = 16, KEY_LEN = 32;

export function encryptWithPassword(plaintext: string, password: string): { contentEncrypted: string; contentIv: string } {
  const salt = randomBytes(SALT_LEN), iv = randomBytes(IV_LEN);
  const key = scryptSync(password, salt, KEY_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    contentEncrypted: Buffer.concat([encrypted, authTag]).toString("base64"),
    contentIv: Buffer.concat([salt, iv]).toString("base64"),
  };
}

export function decryptWithPassword(contentEncrypted: string, contentIv: string, password: string): string | null {
  try {
    const combined = Buffer.from(contentIv, "base64");
    const salt = combined.subarray(0, SALT_LEN), iv = combined.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const key = scryptSync(password, salt, KEY_LEN);
    const payload = Buffer.from(contentEncrypted, "base64");
    const authTag = payload.subarray(payload.length - TAG_LEN), encrypted = payload.subarray(0, payload.length - TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
