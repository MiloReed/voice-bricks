import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Fail closed if shared rate limiting is unavailable. Never silently spend quota.
export async function reserveTtsCapacity(request: Request, resource?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("TTS rate limiting is not configured");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "local";
  const digest = createHash("sha256").update(ip.split(",")[0].trim()).digest("hex");
  const reserve = async (bucket: string, max: number, seconds: number) => {
    const { data, error } = await client.rpc("reserve_voice_bricks_api", {
      candidate_bucket: bucket, maximum_hits: max, window_seconds: seconds,
    });
    if (error) throw new Error("TTS rate limiting is unavailable");
    return data === true;
  };
  if (!await reserve(`ip:${digest}`, 20, 60)) return false;
  // Coalesce repeated block/final generation across server instances for a minute.
  if (resource && !await reserve(`render:${resource}`, 1, 60)) return false;
  return reserve("tts:daily", 1000, 86400);
}

export async function reserveSoloReplyCapacity(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Text rate limiting is not configured");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const ip = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "local";
  const digest = createHash("sha256").update(ip.split(",")[0].trim()).digest("hex");
  for (const [bucket, max, seconds] of [[`solo:ip:${digest}`, 20, 60], ["solo:daily", 1000, 86400]] as const) {
    const { data, error } = await client.rpc("reserve_voice_bricks_api", { candidate_bucket: bucket, maximum_hits: max, window_seconds: seconds });
    if (error) throw new Error("Text rate limiting is unavailable");
    if (data !== true) return false;
  }
  return true;
}
