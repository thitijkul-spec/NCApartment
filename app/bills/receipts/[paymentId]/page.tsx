import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatMoneyWithText } from "@/lib/thai-baht-text";
import { notFound } from "next/navigation";
import PrintButton from "./PrintButton";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

export default async function ReceiptPrintPage({ params }: { params: { paymentId: string } }) {
  const { building } = await requireAccess("finance");
  const id = Number(params.paymentId);

  const payment = await prisma.payment.findFirst({
    where: { id, bill: { buildingId: building.id } },
    include: { bill: { include: { room: true, tenant: true } }, account: true },
  });
  if (!payment) notFound();

  const isTaxInvoice = !!payment.taxInvoiceNo;

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <a href="/bills/receipts" className="secondary btn">
          ← กลับรายการใบเสร็จ
        </a>
        <PrintButton />
      </div>

      <div className="card" style={{ maxWidth: isTaxInvoice ? 780 : 480, margin: "0 auto" }}>
        <div className="receipt-header">
          <div>
            <h2 style={{ margin: 0 }}>{building.name}</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{isTaxInvoice ? "ใบกำกับภาษี" : "ใบเสร็จรับเงิน"}</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 13 }}>
            <div>เลขที่ {payment.receiptNo}</div>
            {payment.taxInvoiceNo && <div>เลขที่ใบกำกับภาษี {payment.taxInvoiceNo}</div>}
            <div>{fmtDate(payment.paidAt)}</div>
          </div>
        </div>

        <table style={{ marginBottom: 16 }}>
          <tbody>
            <tr>
              <td>ผู้รับเงิน</td>
              <td>{payment.payeeNameSnapshot ?? "-"}</td>
            </tr>
            <tr>
              <td>ที่อยู่ผู้รับเงิน</td>
              <td>{payment.payeeAddressSnapshot ?? "-"}</td>
            </tr>
            <tr>
              <td>{isTaxInvoice ? "ผู้ซื้อ/ผู้เช่า" : "ผู้ชำระ"}</td>
              <td>{isTaxInvoice ? payment.taxpayerName ?? payment.bill.tenant.name : payment.bill.tenant.name}</td>
            </tr>
            {isTaxInvoice && (
              <>
                <tr>
                  <td>เลขผู้เสียภาษี</td>
                  <td>{payment.taxpayerTaxId ?? "-"}</td>
                </tr>
                <tr>
                  <td>ที่อยู่</td>
                  <td>{payment.taxpayerAddress ?? "-"}</td>
                </tr>
              </>
            )}
            <tr>
              <td>ห้อง / บิลเลขที่</td>
              <td>
                {payment.bill.room.roomNumber} / {payment.bill.billNo} (งวด {payment.bill.billingMonth})
              </td>
            </tr>
            <tr>
              <td>วิธีชำระ</td>
              <td>
                {payment.method === "cash" ? "เงินสด" : "โอนเงิน"} {payment.account && `(${payment.account.name})`}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-total" style={{ textAlign: "right" }}>
          จำนวนเงิน {formatMoneyWithText(payment.amount)}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          หมายเหตุ: ค่าเช่าที่พักอาศัยได้รับยกเว้นภาษีมูลค่าเพิ่มตามประมวลรัษฎากร
        </p>

        <div style={{ marginTop: 40, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderBottom: "1px solid var(--text)", width: 200, height: 50 }} />
            <p style={{ fontSize: 13, marginTop: 6 }}>ผู้รับเงิน</p>
          </div>
        </div>
      </div>
    </div>
  );
}
