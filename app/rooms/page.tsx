import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "./actions";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import RoomsClient from "./RoomsClient";

export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "A")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const branch = await getDefaultBranch();
  const roomTypes = await prisma.roomType.findMany({
    where: { branchId: branch.id },
    orderBy: { id: "asc" },
  });
  const rooms = await prisma.room.findMany({
    where: { branchId: branch.id },
    include: { roomType: true },
    orderBy: { roomNumber: "asc" },
  });

  return <RoomsClient rooms={rooms} roomTypes={roomTypes} />;
}
