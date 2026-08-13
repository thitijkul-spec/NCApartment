import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SECRET = process.env.AUTH_SECRET || "dev-fallback-secret";
const COOKIE_NAME = "session";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

function sign(userId: number) {
  const sig = crypto.createHmac("sha256", SECRET).update(String(userId)).digest("hex");
  return `${userId}.${sig}`;
}

function verify(token: string): number | null {
  const [idStr, sig] = token.split(".");
  if (!idStr || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(idStr).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return Number(idStr);
}

export async function createSession(userId: number) {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return null;
  return user;
}

export function hasModuleAccess(
  user: { role: string; permissions: string },
  moduleCode: string
) {
  if (user.role === "owner") return true;
  return user.permissions.split(",").includes(moduleCode);
}
