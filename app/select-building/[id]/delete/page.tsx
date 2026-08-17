import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { confirmDeleteBuilding } from "../../actions";

export default async function DeleteBuildingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/select-building");

  const buildingId = Number(params.id);
  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building) redirect("/select-building");

  const [roomCount, tenantCount, contractCount] = await Promise.all([
    prisma.room.count({ where: { buildingId } }),
    prisma.tenant.count({ where: { buildingId } }),
    prisma.contract.count({ where: { buildingId } }),
  ]);

  return (
    <div style={{ maxWidth: 520, margin: "40px auto" }}>
      <h1 className="page-title">ลบอาคาร: {building.name}</h1>
      <div className="card">
        <p style={{ color: "var(--danger)", fontWeight: 600 }}>
          คำเตือน — การลบอาคารจะลบข้อมูลทั้งหมดที่ผูกกับอาคารนี้ถาวร กู้คืนไม่ได้
        </p>
        <ul style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.8 }}>
          <li>ห้องพัก {roomCount} ห้อง</li>
          <li>ผู้เช่า {tenantCount} คน</li>
          <li>สัญญาเช่า {contractCount} ฉบับ</li>
          <li>รวมถึงบิล, ใบเสร็จ, การจอง, มิเตอร์, แจ้งซ่อม และประวัติทั้งหมดของอาคารนี้</li>
        </ul>

        {searchParams.error && <p className="form-error">{searchParams.error}</p>}

        <form
          action={async (formData: FormData) => {
            "use server";
            const result = await confirmDeleteBuilding(formData);
            if (result?.error) {
              redirect(`/select-building/${buildingId}/delete?error=${encodeURIComponent(result.error)}`);
            }
          }}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input type="hidden" name="buildingId" value={buildingId} />
          <div className="field">
            <label>
              พิมพ์ชื่ออาคาร <strong>{building.name}</strong> เพื่อยืนยัน
            </label>
            <input name="confirmName" required autoComplete="off" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="danger">
              ลบอาคารถาวร
            </button>
            <a href="/select-building" className="secondary btn">
              ยกเลิก
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
