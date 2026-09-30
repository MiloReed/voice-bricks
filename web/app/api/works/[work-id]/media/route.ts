import { createClient } from "@supabase/supabase-js";
import { isExpectedMediaUrl, shareMediaPath } from "@/lib/share/media-path";

function getServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && publishableKey && serviceRoleKey ? { url, publishableKey, serviceRoleKey } : null;
}

async function authorizeHost(request: Request, workId: string) {
  const config = getServerConfig();
  if (!config) return { error: Response.json({ error: "Share storage is not configured" }, { status: 503 }) };
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: Response.json({ error: "Authentication required" }, { status: 401 }) };
  const userClient = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData } = await userClient.auth.getUser(token);
  if (!userData.user) return { error: Response.json({ error: "Invalid session" }, { status: 401 }) };
  const service = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: room } = await service.from("rooms").select("host_user_id").eq("id", workId).maybeSingle();
  if (!room || room.host_user_id !== userData.user.id) return { error: Response.json({ error: "Host required" }, { status: 403 }) };
  return { service };
}

export async function POST(request: Request, { params }: { params: Promise<{ "work-id": string }> }) {
  const { "work-id": workId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(workId)) return Response.json({ error: "Invalid work" }, { status: 400 });
  const auth = await authorizeHost(request, workId);
  if (auth.error || !auth.service) return auth.error;
  const body = await request.json() as { kind?: unknown };
  const kind = body.kind === "video" ? "video" : body.kind === "image" ? "image" : null;
  if (!kind) return Response.json({ error: "Invalid media kind" }, { status: 400 });
  const path = shareMediaPath(workId, kind);
  const { data, error } = await auth.service.storage.from("voice-bricks-share").createSignedUploadUrl(path, { upsert: true });
  if (error) return Response.json({ error: error.message }, { status: 503 });
  const { data: publicData } = auth.service.storage.from("voice-bricks-share").getPublicUrl(path);
  return Response.json({ path, token: data.token, publicUrl: publicData.publicUrl });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ "work-id": string }> }) {
  const { "work-id": workId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(workId)) return Response.json({ error: "Invalid work" }, { status: 400 });
  const auth = await authorizeHost(request, workId);
  if (auth.error || !auth.service) return auth.error;
  const body = await request.json() as { kind?: unknown; publicUrl?: unknown };
  const kind = body.kind === "video" ? "video" : body.kind === "image" ? "image" : null;
  if (!kind) return Response.json({ error: "Invalid media record" }, { status: 400 });
  const { data: expected } = auth.service.storage.from("voice-bricks-share").getPublicUrl(shareMediaPath(workId, kind));
  if (!isExpectedMediaUrl(body.publicUrl, expected.publicUrl)) return Response.json({ error: "Invalid media URL" }, { status: 400 });
  const publicUrl = expected.publicUrl;
  const column = kind === "video" ? "share_video_url" : "share_image_url";
  const { error } = await auth.service.from("works").update({ [column]: publicUrl }).eq("room_id", workId);
  if (error) return Response.json({ error: error.message }, { status: 503 });
  await auth.service.from("rooms").update({ status: "completed" }).eq("id", workId).in("status", ["revealed", "completed"]);
  return Response.json({ url: publicUrl });
}
