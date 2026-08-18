import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { building } = await requireAccess("finance");
  const accountId = Number(req.nextUrl.searchParams.get("accountId"));
  if (!accountId) return NextResponse.json({ entries: [] });

  const account = await prisma.account.findFirst({ where: { id: accountId, buildingId: building.id } });
  if (!account) return NextResponse.json({ entries: [] });

  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId },
    orderBy: { date: "asc" },
    select: { date: true, description: true, direction: true, amount: true },
  });

  return NextResponse.json({ entries });
}
