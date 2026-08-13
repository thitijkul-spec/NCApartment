import { redirect } from "next/navigation";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";

const fallbackRouteByModule: Record<string, string> = {
  A: "/rooms",
  B: "/bills",
  C: "/meters",
  F: "/customers",
  G: "/maintenance",
  H: "/housekeeping",
  M: "/cross-check",
  D: "/reports",
  L: "/expenses",
};

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "owner") redirect("/dashboard");

  for (const moduleCode of Object.keys(fallbackRouteByModule)) {
    if (hasModuleAccess(user, moduleCode)) redirect(fallbackRouteByModule[moduleCode]);
  }

  redirect("/login");
}
