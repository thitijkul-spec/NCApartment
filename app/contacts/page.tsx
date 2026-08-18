import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ContactsClient from "./ContactsClient";

export default async function ContactsPage() {
  const { building } = await requireAccess("finance");

  const contacts = await prisma.contact.findMany({ orderBy: { name: "asc" } });

  return <ContactsClient contacts={contacts} buildingName={building.name} />;
}
