"use client";

import { useState } from "react";
import CheckInForm from "../rooms/CheckInForm";
import type { TenantOption } from "../rooms/types";
import type { BookingRoomOption } from "./types";
import { XIcon } from "../icons";
import { ROOM_STATUS_LABEL } from "@/lib/room-utils";

export default function BookingFormModal({
  rooms,
  tenants,
  onClose,
  onSaved,
}: {
  rooms: BookingRoomOption[];
  tenants: TenantOption[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [roomId, setRoomId] = useState<number | "">("");
  const selectedRoom = rooms.find((r) => r.id === roomId) || null;

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
          <div className="field">
            <label>เลือกห้อง (แสดงทุกห้องไม่กรองสถานะ)</label>
            <select value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
              <option value="">-- เลือกห้อง --</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} (ชั้น {r.floor} · {ROOM_STATUS_LABEL[r.status]})
                </option>
              ))}
            </select>
          </div>

          {selectedRoom && (
            <CheckInForm
              room={selectedRoom}
              tenants={tenants}
              forceReservation
              onDone={(msg) => {
                onSaved(msg);
                onClose();
              }}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
