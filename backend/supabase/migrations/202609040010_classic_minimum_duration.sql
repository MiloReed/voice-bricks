-- Keep Classic rounds going until the shared work reaches the 10-second target.
-- Two-player rooms still require at least two full rounds.

create or replace function public.submit_voice_brick(
  candidate_room_id uuid,
  submitted_text text,
  submitted_duration numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_room public.rooms%rowtype;
  current_player public.room_players%rowtype;
  new_block_id uuid;
  player_count integer;
  submitted_count integer;
  existing_block_count integer;
  total_duration numeric;
  total_characters integer;
  continue_round boolean;
begin
  select r.* into target_room from public.rooms r where r.id = candidate_room_id for update;
  if target_room.id is null or target_room.status <> 'playing' then raise exception 'Room is not accepting blocks'; end if;
  if char_length(trim(submitted_text)) not between 1 and 30 then raise exception 'Text must be 1–30 characters'; end if;
  if not public.is_voice_bricks_text_safe(trim(submitted_text)) then raise exception 'Text contains unsupported content'; end if;
  if submitted_duration <= 0 or submitted_duration > 8 then raise exception 'Invalid block duration'; end if;

  select coalesce(sum(b.duration_seconds), 0), count(*), coalesce(sum(char_length(b.text)), 0)
  into total_duration, existing_block_count, total_characters
  from public.blocks b where b.room_id = candidate_room_id;
  if total_duration + submitted_duration > 15 then raise exception 'The final work cannot exceed 15 seconds'; end if;
  if total_characters + char_length(trim(submitted_text)) > 65 then raise exception 'The final work cannot exceed 65 characters'; end if;

  select rp.* into current_player
  from public.room_players rp
  where rp.room_id = candidate_room_id and rp.user_id = auth.uid()
  for update;
  if current_player.id is null then raise exception 'Player not found in room'; end if;
  if current_player.has_submitted then raise exception 'Block already submitted this round'; end if;
  if target_room.mode = 'classic' and current_player.seat_index <> target_room.current_player_index then raise exception 'Not your turn'; end if;

  insert into public.blocks (room_id, player_id, round, text, duration_seconds, position, status)
  values (candidate_room_id, current_player.id, target_room.current_round, trim(submitted_text), submitted_duration, existing_block_count, 'submitted')
  returning id into new_block_id;

  total_duration := total_duration + submitted_duration;
  update public.room_players rp set has_submitted = true where rp.id = current_player.id;
  select count(*) into player_count from public.room_players rp where rp.room_id = candidate_room_id;
  select count(*) into submitted_count from public.room_players rp where rp.room_id = candidate_room_id and rp.has_submitted;

  if target_room.mode = 'classic'
    and total_duration >= 10
    and (
      (player_count = 2 and target_room.current_round >= 2 and submitted_count >= player_count)
      or (player_count > 2 and (target_room.current_round > 1 or submitted_count >= player_count))
    )
  then
    update public.rooms r set status = 'assembly', assembly_deadline_at = null where r.id = candidate_room_id;
    return new_block_id;
  end if;

  if submitted_count >= player_count then
    if target_room.mode = 'chaos' then
      with shuffled as (
        select b.id, row_number() over (order by md5(b.id::text || clock_timestamp()::text)) - 1 as next_position
        from public.blocks b where b.room_id = candidate_room_id
      )
      update public.blocks b set position = shuffled.next_position from shuffled where b.id = shuffled.id;
      update public.rooms r
      set status = 'assembly', chaos_reveal_started_at = now(), assembly_deadline_at = now() + interval '30 seconds'
      where r.id = candidate_room_id;
    else
      continue_round := (player_count = 2 and target_room.current_round < 2) or total_duration < 10;
      if continue_round then
        update public.room_players rp set has_submitted = false where rp.room_id = candidate_room_id;
        update public.rooms r
        set current_round = target_room.current_round + 1, current_player_index = 0, turn_started_at = now()
        where r.id = candidate_room_id;
      else
        update public.rooms r set status = 'assembly', assembly_deadline_at = null where r.id = candidate_room_id;
      end if;
    end if;
  elsif target_room.mode = 'classic' then
    update public.rooms r
    set current_player_index = target_room.current_player_index + 1, turn_started_at = now()
    where r.id = candidate_room_id;
  end if;

  return new_block_id;
end;
$$;

create or replace function public.skip_voice_bricks_turn(candidate_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_room public.rooms%rowtype;
  player_count integer;
  submitted_count integer;
  continue_round boolean;
begin
  select r.* into target_room from public.rooms r where r.id = candidate_room_id for update;
  if target_room.id is null or target_room.host_user_id <> auth.uid() then raise exception 'Host required'; end if;
  if target_room.status <> 'playing' or target_room.mode <> 'classic' then raise exception 'Classic turn required'; end if;
  if target_room.turn_started_at is null or now() < target_room.turn_started_at + interval '60 seconds' then raise exception 'The player still has time'; end if;

  update public.room_players rp
  set has_submitted = true
  where rp.room_id = candidate_room_id and rp.seat_index = target_room.current_player_index;

  select count(*), count(*) filter (where rp.has_submitted)
  into player_count, submitted_count
  from public.room_players rp where rp.room_id = candidate_room_id;
  if submitted_count >= player_count then
    continue_round := player_count = 2 and target_room.current_round < 2;
    if continue_round then
      update public.room_players rp set has_submitted = false where rp.room_id = candidate_room_id;
      update public.rooms r
      set current_round = target_room.current_round + 1, current_player_index = 0, turn_started_at = now()
      where r.id = candidate_room_id;
    else
      update public.rooms r set status = 'assembly', assembly_deadline_at = null where r.id = candidate_room_id;
    end if;
  else
    update public.rooms r
    set current_player_index = target_room.current_player_index + 1, turn_started_at = now()
    where r.id = candidate_room_id;
  end if;
end;
$$;
