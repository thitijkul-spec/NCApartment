import { prisma } from "./prisma";

/**
 * ลบอาคารทั้งหมดแบบ hard delete รวมข้อมูลที่ผูกอยู่ทุกตาราง
 * ลำดับลบ: ลูกก่อนพ่อเสมอ (topological order ตาม FK ใน schema.prisma) ป้องกัน FK constraint error
 */
export async function deleteBuildingCascade(buildingId: number) {
  await prisma.$transaction([
    // ชั้น 1 — ตารางปลายทาง ไม่มีอะไรอ้างอิงกลับมา
    prisma.auditLog.deleteMany({ where: { buildingId } }),
    prisma.ledgerEntry.deleteMany({ where: { buildingId } }),
    prisma.otherIncomePayment.deleteMany({ where: { otherIncome: { buildingId } } }),
    prisma.otherIncomeLineItem.deleteMany({ where: { otherIncome: { buildingId } } }),
    prisma.expensePayment.deleteMany({ where: { expense: { buildingId } } }),
    prisma.expenseLineItem.deleteMany({ where: { expense: { buildingId } } }),
    prisma.dailyBill.deleteMany({ where: { buildingId } }),
    prisma.parcel.deleteMany({ where: { buildingId } }),
    prisma.maintenanceLog.deleteMany({ where: { buildingId } }),
    prisma.payment.deleteMany({ where: { bill: { buildingId } } }),
    prisma.billLineItem.deleteMany({ where: { bill: { buildingId } } }),
    prisma.bookingPayment.deleteMany({ where: { booking: { buildingId } } }),
    prisma.contractClauseSelection.deleteMany({ where: { contract: { buildingId } } }),
    prisma.tenantVehicle.deleteMany({ where: { tenant: { buildingId } } }),
    prisma.roomImage.deleteMany({ where: { buildingId } }),
    prisma.deposit.deleteMany({ where: { room: { buildingId } } }),
    prisma.meterReading.deleteMany({ where: { buildingId } }),
    prisma.repairRequest.deleteMany({ where: { buildingId } }),
    prisma.repairCategory.deleteMany({ where: { buildingId } }),

    // ชั้น 2 — ปลอดภัยหลังชั้น 1 ลบหมดแล้ว
    prisma.sharedEquipment.deleteMany({ where: { buildingId } }),
    prisma.technician.deleteMany({ where: { buildingId } }),
    prisma.bill.deleteMany({ where: { buildingId } }),
    prisma.booking.deleteMany({ where: { buildingId } }),
    prisma.otherIncome.deleteMany({ where: { buildingId } }),
    prisma.expense.deleteMany({ where: { buildingId } }),
    prisma.contractClauseTemplate.deleteMany({ where: { buildingId } }),

    // ชั้น 3-4
    prisma.contract.deleteMany({ where: { buildingId } }),
    prisma.roomOccupancy.deleteMany({ where: { room: { buildingId } } }),

    // ชั้น 5-7
    prisma.tenant.deleteMany({ where: { buildingId } }),
    prisma.room.deleteMany({ where: { buildingId } }),
    prisma.account.deleteMany({ where: { buildingId } }),

    // ชั้น 8 — ค่าตั้งค่าระดับอาคาร
    prisma.buildingPayeeSettings.deleteMany({ where: { buildingId } }),
    prisma.buildingSettings.deleteMany({ where: { buildingId } }),
    prisma.userBuildingAccess.deleteMany({ where: { buildingId } }),

    // ชั้น 9 — ตัวอาคารเอง
    prisma.building.delete({ where: { id: buildingId } }),
  ]);
}
