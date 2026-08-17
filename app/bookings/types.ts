import type { Booking, BookingPayment, Room, Tenant, Account } from "@prisma/client";
import type { CheckInRoomLike } from "../rooms/CheckInForm";

export type BookingWithRelations = Booking & {
  room: Room;
  tenant: Tenant | null;
  payments: (BookingPayment & { account: Account | null })[];
};

export type BookingRoomOption = CheckInRoomLike & { floor: number; status: string };
