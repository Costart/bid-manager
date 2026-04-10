import { auth } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key } = await params;

  try {
    const { env } = getCloudflareContext();
    const bucket = (env as any).IMAGES;

    const object = await bucket.get(key);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    headers.set(
      "Content-Type",
      object.httpMetadata?.contentType || "image/jpeg",
    );
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(object.body, { headers });
  } catch (err) {
    return new Response("Error fetching image", { status: 500 });
  }
}
