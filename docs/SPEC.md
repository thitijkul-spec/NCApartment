# SPEC — ระบบจัดการหอพัก (Dormitory Management System)
**เวอร์ชัน:** 1.0 (Full Technical Specification)
**อัปเดตล่าสุด:** 10 สิงหาคม 2569
**สถานะ:** Design Complete — พร้อมเริ่มพัฒนา

เอกสารนี้เป็น Spec ฉบับเต็มสำหรับทีมพัฒนา รวบรวม DB Schema, Business Logic, และ Flow ของทุกโมดูลที่ออกแบบไว้ ใช้เป็น Source of Truth ประกอบการเขียนโค้ด

---

## 0. Technical Foundation

```yaml
Frontend: React / Next.js (Responsive Web only, ไม่มี native app)
Backend: Node.js
Database: PostgreSQL
Hosting: Z.com Cloud
Connectivity: Online-only (แนะนำมี 4G/5G hotspot สำรอง)
Concurrent Users: ≤5 ต่อสาขา
Devices: คอมพิวเตอร์ + เครื่องปริ้นธรรมดา (ไม่มี thermal printer)
Backup: Auto ทุก 6 ชม., เก็บย้อนหลัง 30 วัน, restore-test ทุก 3 เดือน
Migration: Excel Template + Import/Validate/Preview flow
```

### Design System

```yaml
Theme: Navy Blue (#1B3F7A) + White — อ้างอิงจาก liveinrent.com
Style: Modern SaaS Dashboard, การ์ดมุมมน, เงาเบา, badge สถานะสี
Semantic Colors:
  Success/Paid/Available: Green (#0f8a4c)
  Pending/Warning: Amber (#b8730a)
  Danger/Overdue/Blocked: Red (#c0392b)
  Brand/Primary/Nav: Navy (#1B3F7A)
Accessibility: ตัวอักษรใหญ่, ปุ่มขนาดจับง่าย, ขั้นตอนน้อย — รองรับผู้ใช้วัย 50+
```

### Phasing

```
Phase 1 (MVP):  A, B, C, E, I(P1)          + Excel Migration
Phase 2:        D, G, J, F, M
Phase 3:        K, L, H, I(P2 — 2C2P)
```

---

## Module A — Core PMS (Room / Booking / Contract)

### A.1 Room Status (Lean — 3 states)

```
available (ว่าง) → unavailable (ไม่ว่าง) → blocked (ปิดปรับปรุง)
```

- ไม่แยก "ทำความสะอาด"/"ซ่อม" เป็น status เดี่ยว — ใช้ query จาก booking checkout / maintenance_requests แทน

### A.2 DB Schema — Room Setup

```sql
branches (branch_id, name, address, phone, active)
room_types (
  room_type_id, branch_id, name,          -- เตียงเดี่ยว/คู่/Family/ที่เพิ่มเอง
  price_daily, price_monthly, price_deposit,
  max_occupancy, active
)
rooms (
  room_id, branch_id, room_type_id, room_number, floor,
  current_mode ENUM('daily','monthly'),
  status ENUM('available','unavailable','blocked'),
  water_electric_mode ENUM('metered','flat_rate'),
  flat_water_rate, flat_electric_rate,      -- ใช้เมื่อ mode = flat_rate
  active
)
room_mode_switch_log (
  log_id, room_id, from_mode, to_mode,
  date_from, date_to, switched_by, reason, created_at
)
```

**Business Rule — สลับ mode รายเดือน→รายวัน:**
ห้องสลับได้เฉพาะเมื่อไม่มี contract ที่ status ∈ (active, pending) คาบเกี่ยวกับช่วงวันที่ต้องการ ต้อง query เช็คก่อนอนุญาตทุกครั้ง

### A.3 DB Schema — Booking (รายวัน)

```sql
bookings (
  booking_id, room_id, customer_id,
  checkin_date, checkout_date, nights,
  booking_type ENUM('walkin','advance'),
  payment_timing ENUM('prepaid_full','pay_before_checkin','pay_after_checkout'),
  base_amount, discount_amount, discount_reason,
  late_checkout_fee, early_checkout_fee,
  total_amount,                              -- = base - discount + fees
  deposit_paid,
  status ENUM('booked','checked_in','checked_out','cancelled','no_show'),
  created_by, created_at
)
```

- ส่วนลด: ใส่มือ (บาท/%) + เหตุผลบังคับกรอก, จำกัดสิทธิ์ตาม staff_limits (ดู Module E)
- Late/Early checkout fee: กรอกอิสระตอนเช็คเอาท์ ไม่ผูก rate ตายตัว

### A.4 DB Schema — Contract (รายเดือน)

```sql
contract_templates (
  template_id, branch_id (NOT NULL — ไม่ share ข้ามสาขา),
  name, content,                             -- HTML + placeholder {{customer_name}} {{deposit_items_table}} ฯลฯ
  signature_position (page, x, y),
  version, is_active, created_by, created_at
)
-- แก้ไข = insert version ใหม่, version เก่า is_active=false แต่ไม่ลบ (Immutable history)
contracts (
  contract_id, room_id, customer_id,
  template_id, template_version,
  rendered_content,                          -- SNAPSHOT ณ ตอนสร้าง ไม่เปลี่ยนตาม template ที่แก้ทีหลัง
  start_date, end_date, monthly_rate, deposit_amount,
  status ENUM('draft','pending_signature','viewed','signed','active','ended','terminated'),
  signature_method ENUM('line_esign','paper_upload'),
  signed_document_url, uploaded_by, uploaded_at,
  requires_tax_invoice, tax_id, tax_invoice_name, tax_invoice_address,
  created_by, created_at
)
contract_renewal_log (renewal_id, old_contract_id, new_contract_id, renewed_by, renewed_at)
contract_signature_requests (
  request_id, contract_id, customer_id, line_user_id,
  liff_link_token, sent_at, viewed_at,
  signature_image_url, signed_pdf_url,
  signed_at, signed_ip, signed_device,
  status ENUM('sent','viewed','signed','expired')
)
```

**Flow — เซ็นสัญญาผ่าน LINE (Canvas Signature):**

```
1. สร้างสัญญา → เลือก template (filter ตาม branch_id ของห้องอัตโนมัติ) → กรอกข้อมูล → render PDF
2. กด "ส่งให้ลูกค้าเซ็น" → ส่งลิงก์ LIFF ผ่าน LINE OA (token expire, ใช้ครั้งเดียว)
3. ลูกค้าเปิด LIFF → Preview สัญญา → วาดลายเซ็นบน canvas → กดยืนยัน
4. Capture ลายเซ็น (PNG/SVG) → ฝังลง PDF ตามตำแหน่งที่ template กำหนด
5. บันทึก signed_pdf_url, signed_at, signed_ip, signed_device → contract.status = signed
6. ส่ง PDF ที่เซ็นแล้วกลับลูกค้าผ่าน LINE + แจ้งเตือนพนักงาน
```

**Flow — เซ็นสัญญากระดาษ (Paper Upload):**

```
1. สร้างสัญญา → Print
2. ลูกค้าเซ็นสด → พนักงานสแกน/ถ่ายรูป
3. อัปโหลดเข้าระบบผูก contract_id (รองรับหลายไฟล์ → merge เป็น PDF เดียว)
4. staff กด confirm → contract.status = signed, signature_method = paper_upload
```

### A.5 DB Schema — เงินมัดจำ (Deposit)

```sql
deposit_items_master (item_id, branch_id, name, default_amount, active)
deposits (
  deposit_id, contract_id, booking_id, customer_id,
  total_deposit_amount, total_received,
  status ENUM('pending','partial','fully_paid','refunded','deducted'),
  note, created_by, created_at
)
deposit_details (
  detail_id, deposit_id, item_id, item_name_snapshot, amount, note
)
deposit_payments (
  payment_id, deposit_id, amount, payment_date,
  payment_method, slip_image_url, received_by, note
)
deposit_refunds (
  refund_id, deposit_id, deduction_amount, deduction_reason,
  refund_amount, refund_date, processed_by
)
```

- เลือกได้หลายรายการ (multi-select จาก master + เพิ่มเองได้), วางเงินแบบ partial ได้, เงินจองหักเข้าเงินประกันได้
- ดึงข้อมูลไปแสดงในสัญญาผ่าน placeholder `{{deposit_items_table}}`, `{{deposit_total}}`, `{{deposit_received}}`

---

## Module B — บัญชี/บิล (Operation-level)

```sql
bills (
  bill_id, branch_id, bill_type ENUM('monthly','daily'),
  contract_id, booking_id, customer_id, room_id,
  billing_period_start, billing_period_end,
  room_charge, water_charge, electric_charge,
  other_charges JSON,                        -- [{name, amount}]
  discount_amount, total_amount, due_date,
  status ENUM('draft','issued','paid','partial','overdue','cancelled'),
  reversed_at, reversed_by,
  created_by, created_at
)
payments (
  payment_id, bill_id, customer_id, amount, payment_date,
  payment_method ENUM('cash','transfer','promptpay','other'),
  slip_image_url, received_by,
  status ENUM('confirmed','pending_verify')
)
receipts (
  receipt_id, bill_id,
  receipt_type ENUM('simple_receipt','tax_invoice'),  -- ดึงจาก contract/booking.requires_tax_invoice อัตโนมัติ
  receipt_no,                                -- running number แยกชุดตาม type + branch
  issue_date, pdf_url, sent_via_line, line_sent_at
)
```

- รองรับชำระ partial (ยอดคงเหลือ = total_amount - SUM(payments))
- ใบเสร็จ 2 แบบ เลือกตั้งแต่ตอนผูกลูกค้ากับห้อง (ติ๊ก requires_tax_invoice ใน contract/booking)

---

## Module C — มิเตอร์น้ำ-ไฟ

```sql
meter_reading_batches (
  batch_id, branch_id, billing_month,
  confirmed_by, confirmed_at,
  status ENUM('confirmed','reverted')
)
meter_readings (
  reading_id, batch_id, room_id, contract_id, meter_type ENUM('water','electric'),
  billing_month, previous_reading, current_reading, unit_used, rate_per_unit, amount,
  status ENUM('draft','confirmed','editable'),
  flagged_abnormal, recorded_by, recorded_at
)
bill_reversal_log (
  reversal_id, batch_id, bill_id, room_id,
  reversed_by, reversed_at, reason,
  result ENUM('success','blocked_has_payment')
)
```

**Flow เต็ม:**

```
1. บันทึกมิเตอร์แบบ Bulk (ทุกห้องในสาขาหน้าเดียว, ห้อง flat_rate ถูกกรองออกอัตโนมัติ)
   - previous_reading แสดง read-only (ดึงจากเดือนก่อน)
   - unit_used คำนวณ real-time ขณะกรอก
   - flagged_abnormal = true ถ้า unit_used ผิดปกติเทียบค่าเฉลี่ย 3 เดือน (threshold ตั้งได้ต่อสาขา)
2. กด "บันทึกทั้งหมด" ครั้งเดียว (ไม่ save ทีละห้อง)
3. หน้า Recheck: สรุปทุกห้อง highlight ห้องผิดปกติ → แก้ไขได้ตรงนี้ก่อน confirm
4. ยืนยัน → meter_readings.status = confirmed
5. กด "ออกบิลรอบนี้" → generate bills ทุกห้อง (status: issued), ผูก batch_id
```

**Flow ดึงบิลกลับ (Reversal):**

```
เลือกได้ทั้ง batch หรือทีละห้อง
→ เช็คแต่ละห้อง: bill.status ∈ (paid, partial)?
   YES → บล็อก ไม่ลบ, log result = blocked_has_payment, แจ้งเตือน staff
   NO  → ลบเฉพาะ bill, meter_readings.status: confirmed → editable (ไม่ลบเลขมิเตอร์)
→ log ทุกครั้งลง bill_reversal_log (บังคับกรอก reason)
→ staff แก้เลขมิเตอร์ที่ editable ได้ตรงจุด → ออกบิลใหม่เฉพาะห้องที่แก้
```

**กำหนดวันจดมิเตอร์:**

```sql
meter_reading_schedule (schedule_id, branch_id, reading_day, reminder_days_before)
```

เตือนใน staff dashboard ล่วงหน้า, highlight ถ้าถึงวันแล้วยังจดไม่ครบ

---

## Module D — รายงาน

รายงานทั้งหมด derive จาก view/query (ไม่สร้างตารางใหม่):

| รายงาน | Query หลัก |
|---|---|
| ค้างชำระ (รายเดือน) + เบอร์โทร | `bills JOIN customers WHERE status IN (overdue,partial)`, highlight ค้าง > 30 วัน |
| ห้องว่าง (รายเดือน) | `rooms WHERE status=available` แยกตาม room_type |
| Occupancy รายวัน (custom range) | `bookings WHERE checkin/checkout ∈ range` |
| รายได้รายวัน | `SUM(bookings.total_amount) GROUP BY date` |
| เปรียบเทียบรายได้รายวัน vs รายเดือน | กราฟแท่งซ้อนรายเดือน (Chart.js bar) |
| Occupancy ภาพรวม แยกประเภทห้อง | `GROUP BY room_type_id` (dynamic ตาม setup) |

- Export: Excel + PDF ทุกรายงาน
- **ไม่ทำ**รายงานเปรียบเทียบระหว่าง 2 สาขา

---

## Module E — User Management (2-Level RBAC)

```sql
users (
  user_id, branch_id,                        -- null = ทุกสาขา (Owner)
  name, phone, email, password_hash,
  role ENUM('owner','staff'),
  can_manage_users,                           -- เฉพาะ staff
  active, created_at
)
user_module_permissions (
  id, user_id, module ENUM('A','B','C','D','F','G','H','I','J'),  -- ไม่รวม E, K
  can_access                                  -- default = true ทุก module ตอนสร้าง staff ใหม่
)
staff_limits (
  user_id, limit_type ENUM('discount_percent','discount_amount'),
  max_value, requires_approval_above
)
user_audit_log (
  log_id, user_id, module, action, ref_id,
  old_value, new_value, ip_address, created_at
)
```

**Business Rule:**

- Owner มีได้ **1 คนเท่านั้น** (บังคับใน backend), ทำได้ทุกอย่างทุกสาขา, ไม่มี permission checkbox
- Staff: default ติ๊กทุก module = true, ปลดติ๊กได้เป็นรายโมดูล, `can_manage_users` แยกเปิด/ปิดได้
- Module K (Owner Dashboard) ไม่อยู่ในลิสต์ที่ staff ติ๊กได้เลย — เป็นของ Owner โดยเฉพาะ
- Backend ต้องเช็ค permission ทุก request (ไม่ใช่แค่ซ่อนเมนู)

---

## Module F — CRM ลูกค้า (Lean)

```sql
customers (
  customer_id, name, phone, id_card_no, id_card_image,
  line_user_id, address,
  emergency_contact_name, emergency_contact_phone,
  created_at
)
customer_notes (note_id, customer_id, note, created_by, created_at)
blacklist (
  blacklist_id, phone, reason, added_by, added_at, active
)
```

**Business Rule:**

- Blacklist แยกตารางอิสระ **map จากเบอร์โทรตรงๆ** ไม่ผูก customer_id
- เช็ค real-time ทันทีที่พิมพ์เบอร์โทรครบในหน้า booking/contract/customer form → popup เตือน (ไม่ hard block)
- **ไม่มี** Tab ประวัติเช่า/บิล/แจ้งซ่อมใน Customer Profile — ดูผ่าน Module D (filter by customer) แทน

---

## Module G — แจ้งซ่อม/Maintenance

```sql
maintenance_requests (
  request_id, room_id, branch_id, customer_id,
  description, image_urls[],
  preferred_time,
  created_via ENUM('liff','staff_phone'),
  reported_by_staff,                          -- ผูกเมื่อ created_via = staff_phone
  priority INT (1-5),
  category,                                   -- ตั้งเองได้ รวม "ล้างแอร์"
  status ENUM('new','assigned','in_progress','done','cancelled'),
  assigned_to,
  revision_count,                             -- auto +1 ทุกครั้งที่แก้ (priority/assign/note/reschedule)
  completed_date, after_repair_images[],
  created_at
)
maintenance_edit_log (
  log_id, request_id, edited_by, edit_type,
  old_value, new_value, edited_at
)
maintenance_categories (category_id, branch_id, name, active)
```

**Flow:**

```
Request เข้า (LIFF หรือ staff add เอง) → status: new
→ กำหนด priority(1-5) + category + assigned_to → status: assigned
→ เริ่มซ่อม → status: in_progress
→ เสร็จ: อัปโหลดรูปหลังซ่อม + completed_date + cost (ถ้ามี → auto สร้าง expense) → status: done
```

- ประวัติซ่อมต่อห้อง (รวม "ล้างแอร์" เป็น category หนึ่ง) แสดงในหน้า Room Detail — query เดียว `WHERE room_id = X ORDER BY created_at`
- ไม่ auto-lock room status — staff ตัดสินใจ mark blocked เองถ้ากระทบการเข้าพัก

---

## Module H — แม่บ้าน (Lean — Print Only)

**ไม่มี table ใหม่** — ใช้ query จาก `bookings WHERE checkout_date = today AND status = 'checked_out'`

```
ปุ่ม "พิมพ์รายการห้อง Checkout วันนี้" → generate PDF list ห้อง + เวลาเช็คเอาท์
→ ไม่มี assign, ไม่มี tracking, ไม่มี status update ผ่านระบบ (จบที่กระดาษ)
```

---

## Module I — Payment

### Phase 1 — LINE Slip + OCR (ปัจจุบัน)

```sql
payment_slips (
  slip_id, customer_id, bill_id,
  line_message_id, image_url,
  ocr_amount, ocr_datetime, ocr_bank_name, ocr_account_name, ocr_raw_text,
  match_status ENUM('auto_matched','needs_review','no_bill_found','rejected'),
  matched_bill_amount, is_valid_slip,
  reviewed_by, reviewed_at, created_at
)
```

**Flow:**

```
1. ลูกค้าส่งรูปสลิปเข้า LINE OA → webhook รับรูป → บันทึก payment_slips (pending_verify)
2. OCR อ่านสลิป (ยอด, วันที่, ธนาคาร) + Rule-based เช็ค pattern สลิปจริง
3. เทียบยอดกับ bill ค้างของลูกค้า:
   ตรง → match_status = auto_matched
   ไม่ตรง/อ่านไม่ได้ → needs_review (เข้าคิว staff ตรวจมือ)
4. staff confirm เสมอก่อนปิดบิลจริง (ไม่ auto-confirm 100%)
```

⚠️ OCR + rule-based ไม่ยืนยันความแท้ของสลิปได้ 100% — เป็นตัวช่วยกรอง ไม่ใช่ตัวตัดสินสุดท้าย

### Phase 2 — แผนอนาคต

```
เชื่อม 2C2P (Dynamic QR ต่อบิล) + เช็คยอดเงินเข้าอัตโนมัติผ่าน Payment Gateway
```

---

## Module J — LINE OA Integration

```sql
line_accounts (line_account_id, branch_id, channel_id, channel_secret, access_token, active)
-- แยก OA คนละ Official Account ต่อสาขา
customer_line_links (
  link_id, customer_id, line_user_id, branch_id,
  phone_matched, linked_by, linked_at, status
)
-- ผูกแบบ manual: ลูกค้าแอด OA เอง → staff match ด้วยเบอร์โทร
notification_settings (
  setting_id, branch_id, notify_type,
  days_after_due,                             -- ตั้งได้หลายจุด เช่น +3, +7
  active
)
line_messages_log (
  log_id, customer_id, line_user_id, branch_id,
  message_type, ref_id, content_summary, status, sent_at, sent_by
)
```

**Flow — สัญญาใกล้หมดอายุ (Manual trigger, ไม่ auto):**

```
Dashboard แสดง contract ที่จะหมดอายุใน ≤60 วัน (auto query)
→ ติ๊กเลือกได้หลายห้อง (bulk) → กด "ส่งแจ้งเตือน" → Popup confirm
→ ส่งทีละคน → log ผล (sent/failed) → บันทึก contract.expiry_notified_at กันสับสน (ยังส่งซ้ำได้)
```

**Flow — ค้างชำระ (Auto ตาม config, Cron รายวัน):**

```
เช็ค bills.status = overdue ทุกวัน → (today - due_date) ตรงกับ days_after_due ที่ตั้งไว้ → ส่ง LINE auto
```

**Flow — แจ้งซ่อมผ่าน LIFF:**

```sql
-- ใช้ maintenance_requests.created_via = 'liff' (ดู Module G)
```

```
ลูกค้าเปิด LIFF → กรอกรายละเอียด + อัปโหลดรูป + เวลาสะดวก → submit
→ auto-reply: "ได้รับแจ้งแล้ว ทีมงานจะติดต่อกลับ" (ไม่มี auto-update สถานะกลับไปอีก)
```

**ไม่ทำ** ระบบจองห้องผ่าน LINE

---

## Module K — Owner Dashboard

**Aggregation layer** — ไม่มี table ใหม่ ดึงจาก view ของ B, D, G, J

```
K1 การ์ดสรุป: รายได้รวม / ค่าใช้จ่ายรวม / กำไรสุทธิ / ยอดค้างชำระ
K2 กราฟรายได้รายวัน vs รายเดือน (จาก D)
K3 Occupancy ภาพรวม + แยกประเภทห้อง (จาก D)
K4 Top list ค้างชำระเกิน 1 เดือน (จาก D)
K5 สัญญาใกล้หมดอายุ 60 วัน (จาก J)
K6 งานซ่อมค้าง priority สูงสุด (จาก G)
```

**ไม่มี**เปรียบเทียบสาขา

```sql
dashboard_notification_settings (setting_id, branch_id, send_time, enabled, recipient_line_user_id)
```

ส่ง Mini Dashboard สรุปประจำวันเข้า LINE เจ้าของอัตโนมัติ (ตั้งเวลาได้) + ปุ่ม "ขอสรุปตอนนี้" on-demand ผ่าน rich menu
Cache ผลสรุป (เช่น รีเฟรชทุก 15 นาที) แทน query real-time ทุกครั้ง

---

## Module L — ระบบบัญชี SME

```sql
chart_of_accounts (account_id, code, name, type ENUM('asset','liability','equity','revenue','expense'), parent_id, active)
journal_entries (entry_id, entry_date, ref_type ENUM('auto','manual'), ref_id, description, created_by, created_at)
journal_entry_lines (line_id, entry_id, account_id, debit, credit)
-- Double-entry: ทุก transaction จาก Module B (บิลออก/รับเงิน/รายจ่าย) auto สร้าง entry เบื้องหลัง
other_income (income_id, branch_id, account_id, description, amount, income_date, attachment_url, created_by)
bank_statements (statement_id, branch_id, bank_account_no, uploaded_file_url, uploaded_by, uploaded_at)
bank_statement_lines (
  line_id, statement_id, trans_date, description, amount,
  direction ENUM('in','out'),
  matched_status ENUM('matched','unmatched'), matched_payment_id
)
-- AP (ซื้อเชื่อ)
purchases (purchase_id, branch_id, vendor_name, description, total_amount, due_date, status, created_by)
ap_payments (payment_id, purchase_id, amount, payment_date, method, note)
-- AR (ขายเชื่อ)
sales (sale_id, branch_id, customer_id, description, total_amount, due_date, status)
ar_payments (payment_id, sale_id, amount, payment_date, method)
```

**Flow — งบดุล/งบกำไรขาดทุน:**

```
Generate จาก journal_entry_lines JOIN chart_of_accounts ตาม account.type
P&L = SUM(revenue) - SUM(expense) ต่อช่วงเวลา
Balance Sheet = Asset vs Liability+Equity ณ วันที่เลือก
```

**Flow — Bank Statement Cross Check (รองรับ PDF มี Password):**

```
1. อัปโหลด PDF statement → ถ้าตรวจพบว่าล็อก → popup ให้กรอกรหัสผ่าน
2. Decrypt ด้วย pikepdf/qpdf (backend) → ไม่เก็บ password ถาวร ใช้ครั้งเดียวทิ้ง
3. Parse รายการ (layout parser แยกตามธนาคาร) → auto-match กับ payments/expenses ในระบบ
   (เทียบยอดเงิน + วันที่ใกล้เคียง)
4. ตรง → matched_status = matched
   ไม่ตรง → unmatched → แสดงให้ staff ตรวจสอบ/จับคู่มือ หรือพบว่าเงินหาย
```

**AR/AP Partial billing:** ใช้ pattern เดียวกับ Module B (sum payments เทียบ total, status auto)
**ใบกำกับภาษี:** ทุกจุดที่ออกเอกสาร (บิลลูกค้า, AR) มี option เลือก receipt_type เหมือน B2

⚠️ เป็นเครื่องมือช่วยบันทึก+รายงาน ไม่ใช่ตัวแทนนักบัญชี ควรใช้คู่กับผู้ตรวจสอบบัญชีก่อนส่งงบทางการ

---

## Module M — Cross Check ห้องพัก (รายวัน)

**ไม่มี table ใหม่** (ยกเว้นไม่มีเลยในเวอร์ชัน lean สุดท้าย — ตัด room_keys ออกแล้ว) — เป็น view รวมจาก `rooms`, `bookings`, `payments`

**Mini Dashboard (บนสุด):**

```
ห้องรายวันทั้งหมด = COUNT(rooms WHERE mode='daily')
Check-in วันนี้    = COUNT(bookings WHERE checkin_date=today AND status='checked_in')
Check-out วันนี้   = COUNT(bookings WHERE checkout_date=today AND status='checked_out')
ห้องว่าง           = ห้องรายวันทั้งหมด - ห้องที่ status != 'available'
เงินสดรวม/โอนรวม   = SUM(payments.amount) WHERE payment_date=today GROUP BY method
```

**ตารางรายห้อง (Editable in-place):**

```
คอลัมน์: ห้อง, ประเภท, เตียง, ลูกค้า, เบอร์โทร, จำนวนวันพัก, เริ่ม, สิ้นสุด, เงินสด, โอน, เวลาโอน
คลิกแก้ไขได้ตรงๆ → sync กลับ bookings/payments จริง + log ผู้แก้ไข (audit)
```

- Mini Dashboard เดียวกันนี้ถูกส่งเข้า LINE เจ้าของอัตโนมัติ (เชื่อม Module K/J)
- พิมพ์ PDF ได้

---

## ภาคผนวก: Cross-Module Dependencies

```
A (Room/Contract) ──┬──> B (Bills ผูก contract_id/booking_id)
                     ├──> C (Meter ผูก contract_id)
                     └──> M (Booking data)
B ──> L (Journal entries auto-generate)
B ──> I (Payments ผูก bill_id)
E (Permissions) ──> ทุกโมดูล (permission check ทุก request)
G (Maintenance) ──> B/L (cost → auto expense)
                 ──> J (รับ request จาก LIFF)
D (Reports) ──> K (Owner Dashboard aggregate)
             ──> J (Mini Dashboard ส่ง LINE)
F (Blacklist) ──> A (เช็คตอนสร้าง booking/contract)
```

---

## ประเด็นที่ยังไม่ได้ตัดสินใจ (Backlog สำหรับคุยกับทีมก่อนเริ่ม Sprint แรก)

- [ ] PDPA Consent Flow สำหรับเก็บบัตร ปชช./เบอร์โทร/รูปลูกค้า
- [ ] ความถูกต้องทางกฎหมายของ e-signature ผ่าน LIFF (ควรให้ทนายตรวจ)
- [ ] งบประมาณ/Timeline การพัฒนาที่ชัดเจน
- [ ] ประเมินค่าใช้จ่าย LINE Messaging API, OCR API, 2C2P fee, Z.com Hosting
- [ ] ออกแบบ Rich Menu ของ LINE OA อย่างละเอียด
- [ ] Preventive maintenance schedule (เตือนรอบล้างแอร์ครั้งถัดไปอัตโนมัติ) — พูดถึงแต่ยังไม่ทำ
- [ ] Layout parser ของ Bank Statement แยกตามธนาคารที่ใช้จริง (ต้องระบุธนาคาร)

---

*เอกสารนี้เป็น reference หลักสำหรับการพัฒนา อ้างอิงคู่กับ `dormitory-prototype.zip` (clickable prototype) ที่ส่งมอบพร้อมกัน*
