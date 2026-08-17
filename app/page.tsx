import { redirect } from "next/navigation";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";

const fallbackRouteByModule: Record<string, string> = {
  room: "/rooms",
  tenant: "/tenants",
  finance: "/bills",
  maintenance: "/repairs",
  setting: "/settings/users",
};

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  for (const moduleCode of Object.keys(fallbackRouteByModule)) {
    if (hasModuleAccess(user, moduleCode)) redirect(fallbackRouteByModule[moduleCode]);
  }

  redirect("/login");
}
