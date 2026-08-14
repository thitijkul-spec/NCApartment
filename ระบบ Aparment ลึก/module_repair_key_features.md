# สเปค Module: แจ้งซ่อม (Repair Request) + งานซ่อมบำรุง (Maintenance)

อ้างอิงข้อมูลจาก [module_room_key_features.md](module_room_key_features.md) (มี Tab "แจ้งซ่อม" อยู่แล้วใน Room Detail Modal — ดูหัวข้อ 5 ด้านล่างเรื่องความสัมพันธ์), [module_tenant_key_features.md](module_tenant_key_features.md) (LINE ID ผู้เช่า)

สถานะ: ✅ สเปคเสร็จ (รอ confirm ก่อน implement)

---

## 1. หน้าที่ของโมดูล

จัดการงานแจ้งซ่อมของห้องพัก — รับแจ้งจากพนักงาน (กรอกเอง) หรือจากลูกค้าผ่าน LINE, ติดตามสถานะงาน, มอบหมายช่าง, แจ้งเตือนงานใหม่ในหน้าภาพรวม

รวมฟีเจอร์เสริม **"งานซ่อมบำรุง"** (ล้างแอร์ + อุปกรณ์ส่วนกลาง) เป็น Tab ย่อยในหน้าเดียวกัน — **ฟีเจอร์นี้ไม่เน้นความสำคัญมาก มีไว้เก็บประวัติพื้นฐานเท่านั้น**

**ขอบเขต multi-building:** ทุกอย่างในหน้านี้กรองตาม `building_id` ที่กำลังเลือกอยู่

## 2. Data Model

```
RepairRequest
- id
- building_id            → FK Building
- room_id                → FK Room
- tenant_id              → FK Tenant, nullable (มีค่าเมื่อ source=line_liff หรือพนักงานผูกผู้เช่าตอนกรอกเอง)
- source                 → enum: staff_manual (พนักงานกรอก) | line_liff (ลูกค้าแจ้งผ่าน LINE)
- reporter_name          → string, nullable (กรอกเองได้ตอน staff_manual, auto-fill จาก tenant ตอน line_liff)
- reporter_phone         → string, nullable
- title                  → string, บังคับ
- description            → text, บังคับ
- category_name          → string — **snapshot ชื่อประเภทตอนสร้างงาน ไม่ใช่ live FK** เพื่อไม่ให้ลบ RepairCategory ไม่ได้ตอนมีงานอ้างอิงอยู่ (ลบ RepairCategory ได้เสมอ ไม่ต้องเช็คงานเก่า)
- priority               → enum: low(ต่ำ) | medium(ปานกลาง) | high(สูง) | urgent(เร่งด่วน)
- status                 → enum: pending(รอดำเนินการ) | in_progress(กำลังดำเนินการ) | completed(เสร็จสิ้น)
- assigned_technician_id → FK Technician, nullable
- photos                 → array of url, ไม่บังคับ, สูงสุด 5 รูป (JPG/PNG ≤5MB ต่อรูป)
- notes                  → text, nullable
- cost                   → decimal, nullable — ค่าใช้จ่ายทั่วไป **ไม่เชื่อม module ค่าใช้จ่าย**
- is_read                → boolean, default: true ถ้า staff_manual, false ถ้า line_liff — ใช้ตัดสินว่าต้องเด้งแจ้งเตือนในภาพรวมไหม
- completed_at           → datetime, nullable
- created_at / updated_at

RepairCategory
- id
- building_id            → FK Building
- name                   → string
- is_default             → boolean — รายการเริ่มต้น (ไฟฟ้า/ประปา/แอร์/เครื่องใช้ไฟฟ้า/อื่นๆ) แก้ไข/เพิ่มได้ภายหลังในหน้าตั้งค่า

Technician
- id
- building_id            → FK Building
- name                   → string
- phone                  → string, nullable
- active                 → boolean, default true

SharedEquipment
- id
- building_id            → FK Building
- type                   → enum: washer(เครื่องซักผ้า) | dryer(เครื่องอบผ้า) | water_dispenser(ตู้กดน้ำ)
- name                   → string เช่น "เครื่องซักผ้า ชั้น 1" (ตั้งชื่อ/ตำแหน่งเอง)
- created_at

MaintenanceLog
- id
- building_id            → FK Building
- category               → enum: aircon(ล้างแอร์) | shared_equipment(อุปกรณ์ส่วนกลาง)
- room_id                → FK Room, nullable — บังคับถ้า category=aircon
- equipment_id           → FK SharedEquipment, nullable — บังคับถ้า category=shared_equipment
- date                   → date
- technician_id          → FK Technician, nullable
- notes                  → text, nullable
- created_at
```

**หมายเหตุ:**
- แอร์ผูกกับห้องโดยตรง (`room_id`) ไม่ต้องมี Equipment entity แยก เพราะทุกห้องมีแอร์อยู่แล้ว
- อุปกรณ์ส่วนกลาง (เครื่องซักผ้า/อบผ้า/ตู้กดน้ำ) ต้องสร้างรายการ `SharedEquipment` ไว้ก่อน (เผื่ออาคารมีหลายเครื่อง เช่น 2 ชั้น มีคนละเครื่อง) แล้วค่อยเลือกตอนบันทึก log
- บันทึกล้างแอร์ **เลือกได้ทีละหลายห้องในการบันทึกครั้งเดียว** (เช่น ล้าง 10 ห้องในวันเดียว) → ระบบสร้าง `MaintenanceLog` แยกทีละแถวต่อห้อง (share วันที่/ช่าง/หมายเหตุเดียวกัน)
- **ไม่มีระบบแจ้งเตือนอัตโนมัติเมื่อถึงรอบบำรุงรักษา** — เก็บไว้แค่ดูประวัติย้อนหลังเท่านั้น

## 3. หน้าจอย่อย

### 3.1 หน้ารายการหลัก "แจ้งซ่อม"
- Header: "แจ้งซ่อม" + subtitle "จัดการงานซ่อมบำรุง" + ปุ่ม "+ แจ้งซ่อมใหม่"
- Stat cards: รอดำเนินการ / กำลังดำเนินการ / เสร็จสิ้น / เร่งด่วน (**"เร่งด่วน" นับรวมทุกสถานะที่ priority=urgent** ไม่กรองว่าเสร็จหรือยัง — ต่างจาก 3 การ์ดแรกที่นับตามสถานะ)
- ช่องค้นหา: ค้นจากเลขห้อง / ชื่อผู้เช่า / หัวข้อปัญหา
- Filter tabs: ทั้งหมด / รอดำเนินการ / กำลังดำเนินการ / เสร็จสิ้น
- ตารางรายการ: ห้อง, หัวข้อปัญหา, ประเภท, ความเร่งด่วน (สี badge), สถานะ, ช่างที่มอบหมาย, ที่มา (ไอคอน LINE ถ้า line_liff), วันที่แจ้ง, action (ดูรายละเอียด/แก้ไข/มอบหมายช่าง/เปลี่ยนสถานะ/ลบ)
- ลบงานแจ้งซ่อม: **hard delete ลบจริงทันที ไม่เก็บประวัติ** (มี confirm dialog ก่อนลบ)
- แถวที่ `is_read=false` (แจ้งจาก LINE ยังไม่เปิดดู) ให้ไฮไลต์/ตัวหนา — เปิดดูรายละเอียดแล้วเซ็ต `is_read=true` (**global ต่องาน** ไม่ใช่ per-user — ใครเปิดดูคนแรก หายสำหรับทุกคน)

### 3.2 Modal "แจ้งซ่อมใหม่" (พนักงานกรอกเอง)
ตามภาพที่แนบ: เลือกห้อง*, ผู้แจ้ง, เบอร์โทรผู้แจ้ง, หัวข้อปัญหา*, รายละเอียดปัญหา*, ประเภทปัญหา* (dropdown จาก RepairCategory), ระดับความเร่งด่วน* (ปุ่มเลือก 4 ระดับ), รูปภาพปัญหา (upload), หมายเหตุ
- เพิ่ม dropdown "มอบหมายช่าง" (เลือกได้ตอนสร้างเลย หรือเว้นว่างไว้มอบหมายทีหลังก็ได้)

### 3.3 Modal รายละเอียด/แก้ไขงานซ่อม
- แสดงข้อมูลทั้งหมด + ปุ่มเปลี่ยนสถานะ (รอดำเนินการ → กำลังดำเนินการ → เสร็จสิ้น)
- มอบหมายช่างได้ **1 งาน = 1 ช่างเท่านั้น** (dropdown Technician, เปลี่ยนได้ตลอด)
- ช่องกรอกค่าใช้จ่าย (field ทั่วไป ไม่เชื่อม module ค่าใช้จ่าย)
- กด "เสร็จสิ้น" → บันทึก `completed_at`
- **เปลี่ยนสถานะย้อนกลับได้เสมอ** (เหมือน module พัสดุ) แม้จะ "เสร็จสิ้น" ไปแล้ว — มีกล่องยืนยันก่อนเปลี่ยนสถานะย้อนกลับทุกครั้ง; ย้อนออกจาก "เสร็จสิ้น" → เคลียร์ `completed_at`

### 3.4 Tab ย่อย "งานซ่อมบำรุง" (ในหน้าเดียวกับแจ้งซ่อม)

**3.4.1 Sub-tab "ล้างแอร์"**
- ตารางรายห้อง: เลขห้อง, วันที่ล้างล่าสุด, ช่างที่ล้างล่าสุด (ดึงจาก MaintenanceLog ล่าสุดของห้องนั้น)
- ปุ่ม "บันทึกล้างแอร์" → modal: วันที่*, ช่าง (dropdown Technician), เลือกห้อง (multi-select checkbox หลายห้องพร้อมกัน)*, หมายเหตุ
- คลิกแถวห้อง → ดูประวัติล้างแอร์ย้อนหลังทั้งหมดของห้องนั้น

**3.4.2 Sub-tab "อุปกรณ์ส่วนกลาง"**
- จัดการรายการอุปกรณ์ (CRUD SharedEquipment: ชื่อ/ตำแหน่ง, ประเภท)
- ตารางรายอุปกรณ์: ชื่อ/ตำแหน่ง, ประเภท, วันที่บำรุงรักษาล่าสุด, ช่างล่าสุด
- ปุ่ม "บันทึกบำรุงรักษา" → modal: เลือกอุปกรณ์ (dropdown SharedEquipment)*, วันที่*, ช่าง, หมายเหตุ
- คลิกแถวอุปกรณ์ → ดูประวัติย้อนหลังทั้งหมดของอุปกรณ์นั้น

## 4. การแจ้งซ่อมผ่าน LINE (LIFF)

- ลูกค้ากด rich menu ปุ่ม "แจ้งซ่อม" → เปิดหน้าเว็บฟอร์ม LIFF ภายใน LINE
- ระบบดึง LINE ID ของผู้ใช้ปัจจุบัน → หา `tenant_id` + `room_id` ที่ผูกไว้อัตโนมัติ (ตาม `module_tenant`) — **ลูกค้าเลือกห้องเองไม่ได้** ระบบ lock ห้องจาก LINE ID
- ฟอร์ม LIFF ให้กรอก: หัวข้อปัญหา*, รายละเอียดปัญหา*, ประเภทปัญหา* (dropdown), ระดับความเร่งด่วน*, รูปภาพ (ไม่บังคับ)
- Submit → สร้าง `RepairRequest` โดย `source=line_liff`, `tenant_id`/`room_id`/`reporter_name`/`reporter_phone` auto-fill จากข้อมูลผู้เช่า, `is_read=false`
- ถ้า LINE ID ไม่พบผู้เช่าที่ผูกไว้ในระบบ (ยังไม่เชื่อม LINE ตาม flow ใน `module_tenant`) → แสดงข้อความแจ้งให้ผูก LINE ก่อน ไม่ให้กรอกฟอร์ม

## 5. การแจ้งเตือนในหน้า "ภาพรวม" (Dashboard)

- การ์ด/แถบแจ้งเตือนแยกต่างหาก: "งานแจ้งซ่อมใหม่ (ยังไม่รับทราบ)" — นับจาก `RepairRequest.is_read=false`
- badge ตัวเลขแดงติดที่เมนู "แจ้งซ่อม" ใน sidebar
- แสดง list ย่อรายการล่าสุด (ห้อง, หัวข้อ, เวลาที่แจ้ง) กดแล้วไปหน้าแจ้งซ่อม + เปิดรายละเอียด (mark `is_read=true`)

## 6. ความสัมพันธ์กับ module อื่น

- **ห้องพัก (`module_room`):** Room Detail Modal มี Tab "แจ้งซ่อม" อยู่แล้ว — ใช้ **data source เดียวกัน** กับหน้ารายการรวมนี้ (filter ตาม `room_id`) ไม่ใช่คนละชุดข้อมูล
- **ผู้เช่า (`module_tenant`):** ใช้ LINE ID ที่ผูกไว้แล้วเพื่อ auto-link การแจ้งซ่อมผ่าน LIFF กับห้อง/ผู้เช่า
- **ค่าใช้จ่าย (module การเงิน, ยังไม่ทำสเปค):** งานซ่อมมีช่องกรอกค่าใช้จ่ายเป็น field อิสระ **ไม่ sync ข้อมูลกับ module ค่าใช้จ่าย** ในเวอร์ชันนี้
- **ตั้งค่า:** จัดการรายการ RepairCategory (เริ่มต้น: ไฟฟ้า/ประปา/แอร์/เครื่องใช้ไฟฟ้า/อื่นๆ) และรายชื่อ Technician

---

## หมายเหตุการดูแลรักษา (สำหรับแชทถัดไป)
- โมดูลนี้ยังไม่ implement โค้ดจริง — รอ confirm ก่อนเริ่ม
- ฟีเจอร์ "งานซ่อมบำรุง" (ล้างแอร์/อุปกรณ์ส่วนกลาง) เป็นของเสริม ความสำคัญต่ำ ทำทีหลังสุดได้ถ้าต้องตัดลดสโคป
