import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { googleAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import {
  refreshAccessToken,
  listMccClientAccounts,
  listAccessibleCustomers,
  getCustomerDetails,
} from "@/lib/google-ads/client";

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

  if (!row?.refreshTokenEncrypted) {
    return NextResponse.json(
      { error: "Not connected to Google Ads" },
      { status: 400 },
    );
  }

  try {
    const refreshToken = await decrypt(row.refreshTokenEncrypted);
    const accessToken = await refreshAccessToken(refreshToken);

    let accounts;
    try {
      accounts = await listMccClientAccounts(accessToken);
    } catch {
      const resourceNames = await listAccessibleCustomers(accessToken);
      const customerIds = resourceNames.map((rn: string) =>
        rn.replace("customers/", ""),
      );
      accounts = await getCustomerDetails(accessToken, customerIds);
    }

    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Token refresh failed")) {
      return NextResponse.json(
        {
          error: "Google Ads disconnected. Please reconnect.",
          reconnect: true,
        },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { customerId, customerName } = body;

  if (!customerId) {
    return NextResponse.json(
      { error: "customerId is required" },
      { status: 400 },
    );
  }

  const db = getDb();
  await db
    .update(googleAdsConnections)
    .set({
      customerId,
      updatedAt: new Date(),
    })
    .where(eq(googleAdsConnections.userId, session.user.id))
    .run();

  return NextResponse.json({ success: true });
}
