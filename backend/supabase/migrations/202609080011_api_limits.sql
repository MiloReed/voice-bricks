-- Only the server can reserve generation capacity. One shared store across workers.
create table public.voice_bricks_api_limits (
  bucket text primary key,
  hits integer not null,
  expires_at timestamptz not null
);
alter table public.voice_bricks_api_limits enable row level security;
revoke all on public.voice_bricks_api_limits from public, anon, authenticated;

create function public.reserve_voice_bricks_api(candidate_bucket text, maximum_hits integer, window_seconds integer)
returns boolean language plpgsql security definer set search_path = public
as $$
declare current_hits integer;
begin
  if maximum_hits < 1 or window_seconds < 1 or length(candidate_bucket) > 200 then
    raise exception 'Invalid rate limit';
  end if;
  delete from public.voice_bricks_api_limits where expires_at < now();
  insert into public.voice_bricks_api_limits as limits (bucket, hits, expires_at)
  values (candidate_bucket, 1, now() + make_interval(secs => window_seconds))
  on conflict (bucket) do update set hits = limits.hits + 1
  returning hits into current_hits;
  return current_hits <= maximum_hits;
end;
$$;
revoke all on function public.reserve_voice_bricks_api(text, integer, integer) from public, anon, authenticated;
grant execute on function public.reserve_voice_bricks_api(text, integer, integer) to service_role;
