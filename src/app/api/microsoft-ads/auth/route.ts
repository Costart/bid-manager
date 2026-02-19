import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuthUrl } from "@/lib/microsoft-ads/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/microsoft-ads/callback`;
  const authUrl = getAuthUrl(redirectUri, session.user.id);

  return NextResponse.json({ url: authUrl });
}
