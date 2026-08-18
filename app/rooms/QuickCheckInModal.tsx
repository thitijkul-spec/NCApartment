"use client";

import type { RoomWithRelations, TenantOption } from "./types";
import CheckInForm from "./CheckInForm";
import { XIcon, ZapIcon } from "../icons";

export default function QuickCheckInModal({
  room,
  tenants,
  onClose,
  onDone,
}: {
  room: RoomWithRelations;
  tenants: TenantOption[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <ZapIcon size={18} /> Check-in รายวัน — ห้อง {room.roomNumber}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          <CheckInForm
            room={room}
            tenants={tenants}
            defaultTenantType="daily"
            onDone={(msg) => {
              onDone(msg);
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
