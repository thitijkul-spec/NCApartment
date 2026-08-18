-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookingCode" TEXT NOT NULL,
    "buildingId" INTEGER NOT NULL,
    "roomId" INTEGER,
    "tenantId" INTEGER,
    "bookingType" TEXT NOT NULL,
    "checkinDate" DATETIME NOT NULL,
    "contractDeadlineDate" DATETIME,
    "nights" INTEGER,
    "checkoutDate" DATETIME,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cancelReason" TEXT,
    "depositRefunded" BOOLEAN,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInAt" DATETIME,
    "checkedInBy" INTEGER,
    "archivedAt" DATETIME,
    CONSTRAINT "Booking_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("archivedAt", "bookingCode", "bookingType", "buildingId", "cancelReason", "checkedInAt", "checkedInBy", "checkinDate", "checkoutDate", "contractDeadlineDate", "createdAt", "createdBy", "depositRefunded", "id", "nights", "note", "roomId", "status", "tenantId") SELECT "archivedAt", "bookingCode", "bookingType", "buildingId", "cancelReason", "checkedInAt", "checkedInBy", "checkinDate", "checkoutDate", "contractDeadlineDate", "createdAt", "createdBy", "depositRefunded", "id", "nights", "note", "roomId", "status", "tenantId" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE UNIQUE INDEX "Booking_bookingCode_key" ON "Booking"("bookingCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
