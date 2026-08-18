-- DropIndex
DROP INDEX "DailyBill_documentNo_key";

-- DropIndex
DROP INDEX "Expense_documentNo_key";

-- DropIndex
DROP INDEX "OtherIncome_documentNo_key";

-- CreateIndex
CREATE UNIQUE INDEX "DailyBill_buildingId_documentNo_key" ON "DailyBill"("buildingId", "documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_buildingId_documentNo_key" ON "Expense"("buildingId", "documentNo");

-- CreateIndex
CREATE UNIQUE INDEX "OtherIncome_buildingId_documentNo_key" ON "OtherIncome"("buildingId", "documentNo");

