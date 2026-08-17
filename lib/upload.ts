import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

/** เซฟไฟล์ที่อัปโหลดผ่าน FormData ลง public/uploads/<subdir>/ คืนเป็น URL แบบ relative (เก็บลง DB ได้ตรงๆ) */
export async function saveUploadedFile(file: File | null | undefined, subdir: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const dir = path.join(UPLOAD_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const ext = path.extname(file.name) || "";
  const filename = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);
  return `/uploads/${subdir}/${filename}`;
}

/** เซฟรูปจาก data URL (base64) เช่น ลายเซ็นจาก canvas — คืน URL แบบ relative เหมือน saveUploadedFile */
export async function saveBase64Image(dataUrl: string | null | undefined, subdir: string): Promise<string | null> {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const [, ext, base64] = match;
  const dir = path.join(UPLOAD_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(base64, "base64"));
  return `/uploads/${subdir}/${filename}`;
}
