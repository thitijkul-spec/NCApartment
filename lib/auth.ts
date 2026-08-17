import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const SECRET = process.env.AUTH_SECRET || "dev-fallback-secret";
const COOKIE_NAME = "session";
const BUILDING_COOKIE_NAME = "buildingId";

export const MODULES = [
  { code: "dashboard", label: "ภาพรวม" },
  { code: "room", label: "ห้องพัก" },
  { code: "tenant", label: "ผู้เช่า" },
  { code: "finance", label: "การเงิน" },
  { code: "maintenance", label: "ซ่อมบำรุง/พัสดุ" },
  { code: "report", label: "รายงาน" },
  { code: "setting", label: "ตั้งค่า" },
] as const;

export type ModuleCode = (typeof MODULES)[number]["code"];

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
  store.delete(BUILDING_COOKIE_NAME);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { buildingAccess: { include: { building: true } } },
  });
  if (!user || !user.active) return null;
  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function hasModuleAccess(user: { role: string; permissions: string }, moduleCode: ModuleCode | string) {
  if (user.role === "owner") return true;
  return user.permissions.split(",").includes(moduleCode);
}

/** อาคารที่ user คนนี้เข้าถึงได้ — owner เข้าได้ทุกอาคาร, staff เข้าได้เฉพาะที่ผูกไว้ */
export async function getAccessibleBuildings(user: CurrentUser) {
  if (user.role === "owner") {
    return prisma.building.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  }
  return user.buildingAccess.map((a) => a.building).filter((b) => b.active);
}

/** อาคารที่กำลังทำงานอยู่ตอนนี้ (จาก cookie) — ถ้ายังไม่เลือกหรือเลือกอาคารที่เข้าไม่ได้ จะ fallback เป็นอาคารแรกที่เข้าถึงได้ */
export async function getCurrentBuilding(user: CurrentUser) {
  const buildings = await getAccessibleBuildings(user);
  if (buildings.length === 0) return null;

  const store = await cookies();
  const selected = store.get(BUILDING_COOKIE_NAME)?.value;
  const found = selected ? buildings.find((b) => String(b.id) === selected) : null;
  return found ?? buildings[0];
}

export async function setCurrentBuildingId(buildingId: number) {
  const store = await cookies();
  store.set(BUILDING_COOKIE_NAME, String(buildingId), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** ใช้เปิดหัวไฟล์ page.tsx ของทุกโมดูล — เช็ค login + สิทธิ์ + ต้องมีอาคารที่เข้าถึงได้ ครบในคำเดียว */
export async function requireAccess(moduleCode: ModuleCode) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, moduleCode)) redirect("/");
  const building = await getCurrentBuilding(user);
  if (!building) redirect("/select-building");
  return { user, building };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
