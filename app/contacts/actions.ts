"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function readContactFields(formData: FormData) {
  return {
    name: String(formData.get("name") || "").trim(),
    taxId: String(formData.get("taxId") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    contactPerson: String(formData.get("contactPerson") || "").trim() || null,
  };
}

export async function createContact(formData: FormData) {
  await requireAccess("finance");
  const fields = readContactFields(formData);
  if (!fields.name) return { error: "กรุณากรอกชื่อ/ชื่อกิจการ" };

  const contact = await prisma.contact.create({ data: fields });
  revalidatePath("/contacts");
  return { contact };
}

export async function updateContact(formData: FormData) {
  await requireAccess("finance");
  const id = Number(formData.get("contactId"));
  const fields = readContactFields(formData);
  if (!fields.name) return { error: "กรุณากรอกชื่อ/ชื่อกิจการ" };

  await prisma.contact.update({ where: { id }, data: fields });
  revalidatePath("/contacts");
}

export async function deleteContact(formData: FormData) {
  await requireAccess("finance");
  const id = Number(formData.get("contactId"));
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contacts");
}
