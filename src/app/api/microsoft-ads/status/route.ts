import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { microsoftAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const connection = await db
    .select()
    .from(microsoftAdsConnections)
    .where(eq(microsoftAdsConnections.userId, session.user.id))
    .get();

  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    accountId: connection.accountId,
    accountName: connection.accountName,
    customerId: connection.customerId,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  await db
    .delete(microsoftAdsConnections)
    .where(eq(microsoftAdsConnections.userId, session.user.id))
    .run();

  return NextResponse.json({ success: true });
}
