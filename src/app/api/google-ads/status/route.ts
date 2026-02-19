import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { googleAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const row = await db
    .select()
    .from(googleAdsConnections)
    .where(eq(googleAdsConnections.userId, session.user.id))
    .get();

  if (!row) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    googleEmail: row.email,
    selectedCustomerId: row.customerId,
    selectedCustomerName: row.customerId
      ? `Account ${row.customerId}`
      : undefined,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  await db
    .delete(googleAdsConnections)
    .where(eq(googleAdsConnections.userId, session.user.id))
    .run();

  return NextResponse.json({ success: true });
}
