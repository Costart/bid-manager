import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { base64, contentType, key } = body;

  if (!base64 || !key) {
    return NextResponse.json(
      { error: "Missing base64 or key" },
      { status: 400 },
    );
  }

  try {
    const { env } = getCloudflareContext();
    const bucket = (env as any).IMAGES;

    const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    await bucket.put(key, buffer, {
      httpMetadata: {
        contentType: contentType || "image/jpeg",
      },
    });

    return NextResponse.json({ key });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
