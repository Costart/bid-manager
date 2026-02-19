import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { microsoftAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getAccounts } from "@/lib/microsoft-ads/client";

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
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  if (!connection.accessTokenEncrypted) {
    return NextResponse.json(
      { error: "No access token stored. Please disconnect and reconnect." },
      { status: 400 },
    );
  }

  try {
    const accessToken = await decrypt(connection.accessTokenEncrypted);
    const accounts = await getAccounts(accessToken);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `SOAP API call failed: ${message.slice(0, 500)}` },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { accountId, accountName, customerId } = body;

  if (!accountId) {
    return NextResponse.json({ error: "Account ID required" }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(microsoftAdsConnections)
    .set({
      accountId,
      accountName: accountName || `Account ${accountId}`,
      customerId,
      updatedAt: new Date(),
    })
    .where(eq(microsoftAdsConnections.userId, session.user.id))
    .run();

  return NextResponse.json({ success: true });
}
