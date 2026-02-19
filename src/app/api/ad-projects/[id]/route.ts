import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { adProjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const row = await db
    .select()
    .from(adProjects)
    .where(and(eq(adProjects.id, id), eq(adProjects.userId, session.user.id)))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const analysisData = row.analysisData ? JSON.parse(row.analysisData) : {};
  const treeData = row.treeData ? JSON.parse(row.treeData) : null;
  const mappingState = row.mappingState ? JSON.parse(row.mappingState) : null;

  return NextResponse.json({
    project: {
      id: row.id,
      project_name: row.name,
      target_url: analysisData.targetUrl || "",
      sitemap_url: analysisData.sitemapUrl || null,
      status: row.status,
      site_analysis: analysisData.siteAnalysis || null,
      folder_tree: treeData,
      discovered_urls: mappingState?.discoveredUrls || [],
      selected_paths: mappingState?.selectedPaths || [],
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const db = getDb();

  // Fetch existing row to merge analysis data
  const existing = await db
    .select()
    .from(adProjects)
    .where(and(eq(adProjects.id, id), eq(adProjects.userId, session.user.id)))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const updates: Record<string, any> = { updatedAt: new Date() };

  // Merge analysis-level data into analysisData JSON
  const existingAnalysis = existing.analysisData
    ? JSON.parse(existing.analysisData)
    : {};
  if (body.siteAnalysis !== undefined) {
    existingAnalysis.siteAnalysis = body.siteAnalysis;
    updates.analysisData = JSON.stringify(existingAnalysis);
  }

  // Tree data
  if (body.folderTree !== undefined) {
    updates.treeData = JSON.stringify(body.folderTree);
  }

  // Mapping state (discovered URLs, selected paths)
  const existingMapping = existing.mappingState
    ? JSON.parse(existing.mappingState)
    : {};
  let mappingChanged = false;
  if (body.discoveredUrls !== undefined) {
    existingMapping.discoveredUrls = body.discoveredUrls;
    mappingChanged = true;
  }
  if (body.selectedPaths !== undefined) {
    existingMapping.selectedPaths = body.selectedPaths;
    mappingChanged = true;
  }
  if (mappingChanged) {
    updates.mappingState = JSON.stringify(existingMapping);
  }

  if (body.status !== undefined) updates.status = body.status;
  if (body.projectName !== undefined) updates.name = body.projectName;

  await db
    .update(adProjects)
    .set(updates)
    .where(and(eq(adProjects.id, id), eq(adProjects.userId, session.user.id)))
    .run();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  await db
    .delete(adProjects)
    .where(and(eq(adProjects.id, id), eq(adProjects.userId, session.user.id)))
    .run();

  return NextResponse.json({ success: true });
}
