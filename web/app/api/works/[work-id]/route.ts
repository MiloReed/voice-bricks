import { createClient } from "@supabase/supabase-js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ "work-id": string }> },
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return Response.json({ error: "Public works are not configured" }, { status: 503 });
  }

  const { "work-id": workId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(workId)) {
    return Response.json({ error: "Invalid work" }, { status: 400 });
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("works")
    .select("id, room_id, final_text, final_audio_url, duration_seconds, ai_comment, share_payload, share_image_url, share_video_url")
    .eq("room_id", workId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 503 });
  if (!data) return Response.json({ error: "Work not found" }, { status: 404 });
  return Response.json(data, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
