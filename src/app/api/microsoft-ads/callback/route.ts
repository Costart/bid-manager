import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { microsoftAdsConnections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";
import { exchangeCodeForTokens } from "@/lib/microsoft-ads/client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // userId
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'microsoft-ads-error',error:'${error}'},'*');window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 },
    );
  }

  const redirectUri = `${url.origin}/api/microsoft-ads/callback`;

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    console.log("Microsoft OAuth tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });
    const db = getDb();

    const encryptedAccess = await encrypt(tokens.access_token);
    const encryptedRefresh = await encrypt(tokens.refresh_token);

    // Upsert connection
    const existing = await db
      .select()
      .from(microsoftAdsConnections)
      .where(eq(microsoftAdsConnections.userId, state))
      .get();

    if (existing) {
      await db
        .update(microsoftAdsConnections)
        .set({
          accessTokenEncrypted: encryptedAccess,
          refreshTokenEncrypted: encryptedRefresh,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          updatedAt: new Date(),
        })
        .where(eq(microsoftAdsConnections.userId, state))
        .run();
    } else {
      await db
        .insert(microsoftAdsConnections)
        .values({
          id: crypto.randomUUID(),
          userId: state,
          accessTokenEncrypted: encryptedAccess,
          refreshTokenEncrypted: encryptedRefresh,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .run();
    }

    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'microsoft-ads-callback',success:true},'*');window.close();</script></body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const safeMessage = message.replace(/'/g, "\\'").replace(/</g, "&lt;");
    return new Response(
      `<html><body>
        <h2>Microsoft Ads Connection Failed</h2>
        <p style="color:red;word-break:break-all;">${safeMessage}</p>
        <p>Redirect URI used: ${redirectUri}</p>
        <script>window.opener?.postMessage({type:'microsoft-ads-error',error:'${safeMessage}'},'*');</script>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }
}
