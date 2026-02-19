import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { googleAdsConnections } from "@/lib/db/schema";
import { encrypt } from "@/lib/encryption";
import { exchangeCodeForTokens } from "@/lib/google-ads/client";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(errorHtml(`Google denied access: ${error}`), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code) {
    return new Response(errorHtml("Missing authorization code"), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return new Response(
      errorHtml("Not logged in. Please log in and try again."),
      { headers: { "Content-Type": "text/html" } },
    );
  }

  if (state !== session.user.id) {
    return new Response(errorHtml("State mismatch. Please try again."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const redirectUri = `${url.origin}/api/google-ads/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    if (!tokens.refresh_token) {
      return new Response(
        errorHtml(
          "No refresh token received. Please revoke app access in your Google account and try again.",
        ),
        { headers: { "Content-Type": "text/html" } },
      );
    }

    let googleEmail: string | null = null;
    try {
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        googleEmail = userInfo.email || null;
      }
    } catch {
      // Email fetch is optional
    }

    const encryptedRefreshToken = await encrypt(tokens.refresh_token);
    const db = getDb();

    const existing = await db
      .select({ id: googleAdsConnections.id })
      .from(googleAdsConnections)
      .where(eq(googleAdsConnections.userId, session.user.id))
      .get();

    if (existing) {
      await db
        .update(googleAdsConnections)
        .set({
          refreshTokenEncrypted: encryptedRefreshToken,
          email: googleEmail,
          updatedAt: new Date(),
        })
        .where(eq(googleAdsConnections.id, existing.id))
        .run();
    } else {
      await db
        .insert(googleAdsConnections)
        .values({
          id: crypto.randomUUID(),
          userId: session.user.id,
          refreshTokenEncrypted: encryptedRefreshToken,
          email: googleEmail,
        })
        .run();
    }

    return new Response(successHtml(), {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(errorHtml(message), {
      headers: { "Content-Type": "text/html" },
    });
  }
}

function successHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><title>Connected</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5">
  <div style="text-align:center;padding:2rem">
    <div style="font-size:3rem;margin-bottom:1rem">&#10003;</div>
    <h2 style="margin:0 0 0.5rem">Google Ads Connected</h2>
    <p style="color:#666">This window will close automatically...</p>
  </div>
  <script>
    window.opener && window.opener.postMessage({ type: "google-ads-connected" }, "*");
    setTimeout(() => window.close(), 1500);
  </script>
</body>
</html>`;
}

function errorHtml(message: string): string {
  const safeMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
<head><title>Connection Failed</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5">
  <div style="text-align:center;padding:2rem;max-width:400px">
    <div style="font-size:3rem;margin-bottom:1rem">&#10007;</div>
    <h2 style="margin:0 0 0.5rem;color:#d32f2f">Connection Failed</h2>
    <p style="color:#666">${safeMessage}</p>
    <button onclick="window.close()" style="margin-top:1rem;padding:0.5rem 1.5rem;border:1px solid #ccc;border-radius:6px;background:white;cursor:pointer">Close</button>
  </div>
</body>
</html>`;
}
