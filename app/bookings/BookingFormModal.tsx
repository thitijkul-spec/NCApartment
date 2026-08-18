"use client";

import type { Account } from "@prisma/client";
import BookingCreateForm from "./BookingCreateForm";
import type { TenantOption } from "../rooms/types";
import type { BookingRoomOption } from "./types";
import { XIcon } from "../icons";

export default function BookingFormModal({
  rooms,
  tenants,
  accounts,
  onClose,
  onSaved,
}: {
  rooms: BookingRoomOption[];
  tenants: TenantOption[];
  accounts: Account[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>จองห้องพัก</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          <BookingCreateForm
            rooms={rooms}
            tenants={tenants}
            accounts={accounts}
            onDone={(msg) => {
              onSaved(msg);
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
