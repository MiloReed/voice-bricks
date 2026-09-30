insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-bricks-audio', 'voice-bricks-audio', true, 10485760, array['audio/mpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.claim_voice_bricks_render(candidate_room_id uuid)
returns table (
  render_voice_id text,
  render_text text,
  render_duration numeric,
  existing_audio_url text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_room public.rooms%rowtype;
begin
  select r.* into target_room
  from public.rooms r
  where r.id = candidate_room_id
  for update;

  if target_room.id is null or target_room.host_user_id <> auth.uid() then
    raise exception 'Host required';
  end if;
  if target_room.status not in ('rendering', 'revealed', 'completed') then
    raise exception 'Room is not ready to render';
  end if;

  return query
  select
    target_room.voice_id,
    string_agg(b.text, '' order by b.position),
    sum(b.duration_seconds),
    w.final_audio_url
  from public.blocks b
  left join public.works w on w.room_id = candidate_room_id
  where b.room_id = candidate_room_id
  group by w.final_audio_url;
end;
$$;

create or replace function public.finish_voice_bricks_assembly(candidate_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_room public.rooms%rowtype;
begin
  select r.* into target_room
  from public.rooms r
  where r.id = candidate_room_id
  for update;

  if target_room.id is null or target_room.host_user_id <> auth.uid() then
    raise exception 'Host required';
  end if;
  if target_room.status <> 'assembly' then
    raise exception 'Room is not in assembly';
  end if;

  update public.rooms r set status = 'rendering' where r.id = candidate_room_id;
end;
$$;

grant execute on function public.claim_voice_bricks_render(uuid) to authenticated;
revoke execute on function public.claim_voice_bricks_render(uuid) from public, anon;
