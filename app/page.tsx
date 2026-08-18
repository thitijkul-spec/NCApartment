import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentBuilding } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

function monthsBack(n: number) {
  const now = new Date();
  const arr: { year: number; month: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ year: d.getFullYear(), month: d.getMonth(), label: `${d.getMonth() + 1}/${d.getFullYear() + 543}` });
  }
  return arr;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const building = await getCurrentBuilding(user);
  if (!building) redirect("/select-building");
  const buildingId = building.id;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonths = monthsBack(6);
  const rangeStart = new Date(sixMonths[0].year, sixMonths[0].month, 1);

  const [
    rooms,
    billPaymentsThisMonth,
    otherIncomePaymentsThisMonth,
    expensePaymentsThisMonth,
    overdueBills,
    billPayments6mo,
    otherIncomePayments6mo,
    expensePayments6mo,
    pendingRepairs,
    parcels,
    parcelSettings,
    contracts,
    auditLogs,
  ] = await Promise.all([
    prisma.room.findMany({ where: { buildingId } }),
    prisma.payment.findMany({ where: { bill: { buildingId }, paidAt: { gte: monthStart } }, select: { amount: true } }),
    prisma.otherIncomePayment.findMany({ where: { otherIncome: { buildingId }, date: { gte: monthStart } }, select: { amount: true } }),
    prisma.expensePayment.findMany({ where: { expense: { buildingId }, date: { gte: monthStart } }, select: { amount: true } }),
    prisma.bill.findMany({
      where: { buildingId, status: { in: ["unpaid", "partially_paid"] } },
      include: { lineItems: true, payments: true },
    }),
    prisma.payment.findMany({ where: { bill: { buildingId }, paidAt: { gte: rangeStart } }, select: { amount: true, paidAt: true } }),
    prisma.otherIncomePayment.findMany({ where: { otherIncome: { buildingId }, date: { gte: rangeStart } }, select: { amount: true, date: true } }),
    prisma.expensePayment.findMany({ where: { expense: { buildingId }, date: { gte: rangeStart } }, select: { amount: true, date: true } }),
    prisma.repairRequest.findMany({
      where: { buildingId, status: { not: "completed" } },
      include: { room: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.parcel.findMany({ where: { buildingId, status: { not: "picked_up" } }, include: { room: true }, orderBy: { receivedAt: "asc" } }),
    prisma.buildingSettings.findUnique({ where: { buildingId } }),
    prisma.contract.findMany({
      where: { buildingId, archivedAt: null, signedAt: { not: null }, OR: [{ noEndDate: true }, { endDate: { gte: now } }] },
      include: { room: true, tenant: true },
    }),
    user.role === "owner"
      ? prisma.auditLog.findMany({ where: { buildingId }, orderBy: { createdAt: "desc" }, take: 8 })
      : Promise.resolve([]),
  ]);

  const roomStats = {
    total: rooms.length,
    available: rooms.filter((r) => r.status === "available").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
  };
  const occupancyRate = roomStats.total > 0 ? Math.round((roomStats.occupied / roomStats.total) * 100) : 0;

  const revenueThisMonth =
    billPaymentsThisMonth.reduce((s, p) => s + p.amount, 0) + otherIncomePaymentsThisMonth.reduce((s, p) => s + p.amount, 0);
  const expenseThisMonth = expensePaymentsThisMonth.reduce((s, p) => s + p.amount, 0);

  const overdueBillsSummary = overdueBills.map((b) => {
    const total = b.lineItems.reduce((s, li) => s + li.amount, 0) - (b.discountAmount ?? 0);
    const paid = b.payments.reduce((s, p) => s + p.amount, 0);
    return total - paid;
  });
  const overdueCount = overdueBillsSummary.length;
  const overdueTotal = overdueBillsSummary.reduce((s, b) => s + b, 0);

  const chartData = sixMonths.map(({ year, month, label }) => {
    const inMonth = (d: Date) => d.getFullYear() === year && d.getMonth() === month;
    const revenue =
      billPayments6mo.filter((p) => inMonth(new Date(p.paidAt))).reduce((s, p) => s + p.amount, 0) +
      otherIncomePayments6mo.filter((p) => inMonth(new Date(p.date))).reduce((s, p) => s + p.amount, 0);
    const expense = expensePayments6mo.filter((p) => inMonth(new Date(p.date))).reduce((s, p) => s + p.amount, 0);
    const occupied = rooms.filter((r) => r.status === "occupied").length; // snapshot ปัจจุบันใช้ประมาณทุกเดือน (ไม่ใช่ room-nights จริง — ดูรายงานสำหรับตัวเลขแม่นยำ)
    return { label, revenue, expense, occupancy: roomStats.total > 0 ? Math.round((occupied / roomStats.total) * 100) : 0 };
  });

  const contractsNearExpiry = contracts
    .filter((c) => !c.noEndDate && c.endDate)
    .map((c) => ({ ...c, daysLeft: Math.ceil((new Date(c.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) }))
    .filter((c) => c.daysLeft <= 60)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 5);

  const overdueDays = parcelSettings?.parcelOverdueDays ?? 3;
  const overdueParcels = parcels
    .filter((p) => (Date.now() - new Date(p.receivedAt).getTime()) / (1000 * 60 * 60 * 24) > overdueDays)
    .slice(0, 5);

  return (
    <DashboardClient
      buildingName={building.name}
      isOwner={user.role === "owner"}
      roomStats={roomStats}
      occupancyRate={occupancyRate}
      revenueThisMonth={revenueThisMonth}
      expenseThisMonth={expenseThisMonth}
      overdueCount={overdueCount}
      overdueTotal={overdueTotal}
      chartData={chartData}
      pendingRepairs={pendingRepairs}
      overdueParcels={overdueParcels}
      contractsNearExpiry={contractsNearExpiry}
      auditLogs={auditLogs}
    />
  );
}
