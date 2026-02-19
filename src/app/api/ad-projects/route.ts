import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adProjects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(adProjects)
    .where(eq(adProjects.userId, session.user.id))
    .orderBy(desc(adProjects.updatedAt))
    .all();

  const projects = rows.map((p) => {
    const analysis = p.analysisData ? JSON.parse(p.analysisData) : null;
    const campaigns = analysis?.campaigns || [];
    const adGroupCount = campaigns.reduce(
      (sum: number, c: any) => sum + (c.adGroups?.length || 0),
      0,
    );
    return {
      id: p.id,
      projectName: p.name,
      targetUrl: analysis?.targetUrl || "",
      status: p.status,
      campaignCount: campaigns.length,
      adGroupCount,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectName, targetUrl, sitemapUrl } = body;

  if (!projectName || !targetUrl) {
    return NextResponse.json(
      { error: "Project name and target URL are required" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const db = getDb();

  await db
    .insert(adProjects)
    .values({
      id,
      userId: session.user.id,
      name: projectName,
      analysisData: JSON.stringify({ targetUrl, sitemapUrl }),
      status: "draft",
    })
    .run();

  return NextResponse.json({ id });
}
