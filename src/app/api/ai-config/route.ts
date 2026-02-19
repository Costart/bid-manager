import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { userAiSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const row = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, session.user.id))
    .get();

  if (!row) {
    return NextResponse.json({ config: null });
  }

  try {
    const apiKey = await decrypt(row.encryptedKey);
    return NextResponse.json({
      config: {
        apiKey,
        model: row.model,
        baseUrl: row.provider,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to decrypt settings" },
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
  const { apiKey, model, baseUrl } = body;

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const encryptedKey = await encrypt(apiKey);
  const db = getDb();

  const existing = await db
    .select({ id: userAiSettings.id })
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, session.user.id))
    .get();

  if (existing) {
    await db
      .update(userAiSettings)
      .set({
        provider: baseUrl || "https://api.openai.com/v1",
        model: model || "gpt-4o-mini",
        encryptedKey,
        updatedAt: new Date(),
      })
      .where(eq(userAiSettings.id, existing.id))
      .run();
  } else {
    await db
      .insert(userAiSettings)
      .values({
        id: crypto.randomUUID(),
        userId: session.user.id,
        provider: baseUrl || "https://api.openai.com/v1",
        model: model || "gpt-4o-mini",
        encryptedKey,
      })
      .run();
  }

  return NextResponse.json({ success: true });
}
