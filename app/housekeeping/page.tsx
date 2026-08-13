import { prisma } from "@/lib/prisma";
import PrintButton from "../bills/PrintButton";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function HousekeepingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "H")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const bookings = await prisma.booking.findMany({
    where: {
      status: "checked_out",
      checkoutDate: { gte: startOfToday(), lte: endOfToday() },
    },
    include: { room: true, customer: true },
    orderBy: { room: { roomNumber: "asc" } },
  });

  return (
    <div>
      <h1 className="page-title">แจ้งทำความสะอาด — รายการห้อง Checkout วันนี้</h1>

      <div className="card">
        <h2>วันที่ {formatDate(new Date())}</h2>
        {bookings.length === 0 ? (
          <p className="empty">วันนี้ยังไม่มีห้องเช็คเอาท์</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ลูกค้า</th>
                <th>เวลาเช็คเอาท์</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.room.roomNumber}</td>
                  <td>{b.customer.name}</td>
                  <td>{formatDate(b.checkoutDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="no-print" style={{ marginTop: 16 }}>
          <PrintButton label="พิมพ์รายการห้อง Checkout" />
        </div>
      </div>
    </div>
  );
}
