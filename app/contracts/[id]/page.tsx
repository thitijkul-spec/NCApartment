import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { renderContractClauses } from "@/lib/contract-render";
import { formatMoneyWithText } from "@/lib/thai-baht-text";
import SignatureCanvas from "../SignatureCanvas";
import ContractActions from "../ContractActions";
import MoveInBillPrompt from "./MoveInBillPrompt";
import { notFound } from "next/navigation";

import { formatDateBE } from "@/lib/date-utils";

function fmtDateTh(d: Date | null) {
  return formatDateBE(d);
}
function fmtDateEn(d: Date | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function ContractViewPage({ params }: { params: { id: string } }) {
  const { building } = await requireAccess("tenant");
  const id = Number(params.id);

  const contract = await prisma.contract.findFirst({
    where: { id, buildingId: building.id },
    include: {
      room: true,
      tenant: true,
      building: true,
      clauseSelections: { include: { clauseTemplate: true } },
    },
  });
  if (!contract) notFound();

  const moveInBill = await prisma.bill.findFirst({ where: { contractId: contract.id, billType: "move_in" } });

  const clauses = renderContractClauses(contract);
  const additionalRules: string[] = contract.additionalRules ? JSON.parse(contract.additionalRules) : [];
  const witnessNames: string[] = contract.witnessNames ? JSON.parse(contract.witnessNames) : [];

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <a href="/contracts" className="secondary btn">
          ← กลับรายการสัญญา
        </a>
        <ContractActions
          contractId={contract.id}
          signed={!!contract.signedAt}
          roomNumber={contract.room.roomNumber}
          tenantName={contract.tenant.name}
        />
      </div>

      {!moveInBill && (
        <div style={{ maxWidth: 780, margin: "0 auto 16px" }}>
          <MoveInBillPrompt contractId={contract.id} />
        </div>
      )}

      <div className="card" style={{ maxWidth: 780, margin: "0 auto", fontFamily: "inherit" }}>
        {contract.headerTextSnapshot && <p style={{ textAlign: "center", fontWeight: 600 }}>{contract.headerTextSnapshot}</p>}
        <h1 style={{ textAlign: "center", fontSize: 20 }}>สัญญาเช่าห้องพัก</h1>
        <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)" }}>
          ทำที่ {contract.building.address ?? contract.building.name} วันที่ {fmtDateTh(contract.contractDate)}
          {contract.isBilingual && <> / {fmtDateEn(contract.contractDate)}</>}
        </p>

        <table style={{ marginBottom: 16 }}>
          <tbody>
            <tr>
              <td>ผู้ให้เช่า</td>
              <td>{contract.payeeNameSnapshot ?? "-"}</td>
            </tr>
            <tr>
              <td>เลขบัตร/ผู้เสียภาษี</td>
              <td>{contract.payeeIdCardNoSnapshot ?? "-"}</td>
            </tr>
            <tr>
              <td>ที่อยู่ผู้ให้เช่า</td>
              <td>{contract.payeeAddressSnapshot ?? "-"}</td>
            </tr>
            <tr>
              <td>ผู้เช่า</td>
              <td>{contract.tenant.name}</td>
            </tr>
            <tr>
              <td>เลขบัตรผู้เช่า</td>
              <td>{contract.tenant.idCardNo ?? "-"}</td>
            </tr>
            <tr>
              <td>ห้องพัก</td>
              <td>
                {contract.room.roomNumber} ชั้น {contract.room.floor}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {clauses.map((c) => (
            <div key={c.number}>
              <strong>
                ข้อ {c.number}. {c.titleTh}
              </strong>
              <p style={{ margin: "4px 0", lineHeight: 1.7 }}>{c.bodyTh}</p>
              {c.bodyEn && (
                <p style={{ margin: "4px 0", lineHeight: 1.7, color: "var(--text-muted)" }}>
                  <em>
                    Clause {c.number}. {c.titleEn}
                  </em>
                  <br />
                  {c.bodyEn}
                </p>
              )}
            </div>
          ))}
        </div>

        {additionalRules.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <strong>กฎเพิ่มเติม</strong>
            <ul>
              {additionalRules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 14 }}>
          เงินประกันการเช่า: {formatMoneyWithText(contract.depositAmount)}
        </p>

        {witnessNames.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <strong>พยาน</strong>
            <ul>
              {witnessNames.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderBottom: "1px solid var(--text)", width: 220, height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              {contract.ownerSignatureImage && <img src={contract.ownerSignatureImage} alt="ลายเซ็นผู้ให้เช่า" style={{ maxHeight: 55 }} />}
            </div>
            <p style={{ fontSize: 13, marginTop: 6 }}>ผู้ให้เช่า</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderBottom: "1px solid var(--text)", width: 220, height: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              {contract.signedAt && <img src={contract.tenantSignatureImage ?? ""} alt="ลายเซ็นผู้เช่า" style={{ maxHeight: 55 }} />}
            </div>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              ผู้เช่า {contract.signedAt && `(เซ็นเมื่อ ${fmtDateTh(contract.signedAt)})`}
            </p>
          </div>
        </div>

        {!contract.signedAt && (
          <div className="no-print" style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <SignatureCanvas contractId={contract.id} />
          </div>
        )}
      </div>
    </div>
  );
}
