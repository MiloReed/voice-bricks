create or replace function public.reorder_voice_bricks(
  candidate_room_id uuid,
  ordered_block_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_room public.rooms%rowtype;
  room_block_count integer;
  distinct_input_count integer;
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

  select count(*) into room_block_count
  from public.blocks b
  where b.room_id = candidate_room_id;

  select count(distinct block_id) into distinct_input_count
  from unnest(ordered_block_ids) as input(block_id);

  if cardinality(ordered_block_ids) <> room_block_count or distinct_input_count <> room_block_count then
    raise exception 'Order must contain every block exactly once';
  end if;
  if exists (
    select 1 from unnest(ordered_block_ids) as input(block_id)
    where not exists (
      select 1 from public.blocks b
      where b.id = block_id and b.room_id = candidate_room_id
    )
  ) then
    raise exception 'Order contains a block from another room';
  end if;

  update public.blocks b
  set position = ordered.position - 1
  from unnest(ordered_block_ids) with ordinality as ordered(block_id, position)
  where b.id = ordered.block_id and b.room_id = candidate_room_id;
end;
$$;

create or replace function public.final_edit_voice_brick(
  candidate_room_id uuid,
  candidate_block_id uuid,
  edited_text text,
  edited_duration numeric
)
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
  if not target_room.final_edit_available then
    raise exception 'Final edit already used';
  end if;

  update public.blocks b
  set text = trim(edited_text),
      duration_seconds = edited_duration,
      preview_audio_url = null,
      status = 'submitted'
  where b.id = candidate_block_id and b.room_id = candidate_room_id;
  if not found then raise exception 'Block not found'; end if;

  update public.rooms r
  set final_edit_available = false
  where r.id = candidate_room_id;
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

  update public.rooms r set status = 'revealed' where r.id = candidate_room_id;
end;
$$;

grant execute on function public.reorder_voice_bricks(uuid, uuid[]) to authenticated;
grant execute on function public.final_edit_voice_brick(uuid, uuid, text, numeric) to authenticated;
grant execute on function public.finish_voice_bricks_assembly(uuid) to authenticated;

revoke execute on function public.reorder_voice_bricks(uuid, uuid[]) from public, anon;
revoke execute on function public.final_edit_voice_brick(uuid, uuid, text, numeric) from public, anon;
revoke execute on function public.finish_voice_bricks_assembly(uuid) from public, anon;
