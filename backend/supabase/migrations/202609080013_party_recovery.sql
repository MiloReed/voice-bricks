-- Keep completed works immutable when the same party plays again.
alter table public.rooms add column next_room_id uuid references public.rooms(id);
alter table public.rooms add column reveal_at timestamptz;
alter table public.room_players add column audio_ready boolean not null default false;

-- A single MVCC snapshot, with existing RLS preserving blind-writing privacy.
create function public.voice_bricks_snapshot(candidate_room_id uuid) returns jsonb
language sql stable security invoker set search_path = public, auth as $$
  select jsonb_build_object('room', to_jsonb(r), 'currentUserId', auth.uid(), 'serverTime', now(),
    'players', (select coalesce(jsonb_agg(p order by p.seat_index), '[]') from public.room_players p where p.room_id=r.id),
    'blocks', (select coalesce(jsonb_agg(b order by b.position), '[]') from public.blocks b where b.room_id=r.id),
    'work', (select to_jsonb(w) from public.works w where w.room_id=r.id))
  from public.rooms r where r.id=candidate_room_id and public.is_room_member(r.id);
$$;

create function public.rematch_voice_bricks(candidate_room_id uuid) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare r public.rooms%rowtype; next_id uuid; next_code text;
begin
  select * into r from public.rooms where id=candidate_room_id for update;
  if auth.uid() is null or r.host_user_id is distinct from auth.uid() then raise exception 'Host required'; end if;
  if r.status not in ('revealed','completed') then raise exception 'Finish this game first'; end if;
  if r.next_room_id is not null then return r.next_room_id; end if;
  loop
    next_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
    begin
      insert into public.rooms(code,host_user_id,team_name,mode,max_players,theme,voice_id)
      values(next_code,r.host_user_id,r.team_name,r.mode,r.max_players,r.theme,r.voice_id) returning id into next_id;
      exit;
    exception when unique_violation then null;
    end;
  end loop;
  insert into public.room_players(room_id,user_id,display_name,color,seat_index,is_ready)
  select next_id,user_id,display_name,color,seat_index,user_id=auth.uid() from public.room_players where room_id=r.id;
  update public.rooms set next_room_id=next_id where id=r.id;
  return next_id;
end;
$$;

create function public.ready_voice_bricks_audio(candidate_room_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_room_member(candidate_room_id) then raise exception 'Membership required'; end if;
  if not exists(select 1 from public.rooms where id=candidate_room_id and status in ('revealed','completed')) then raise exception 'Audio not ready'; end if;
  update public.room_players set audio_ready=true where room_id=candidate_room_id and user_id=auth.uid();
end;
$$;

create function public.start_voice_bricks_reveal(candidate_room_id uuid) returns timestamptz
language plpgsql security definer set search_path = public, auth as $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id=candidate_room_id for update;
  if auth.uid() is null or r.host_user_id is distinct from auth.uid() then raise exception 'Host required'; end if;
  if r.status not in ('revealed','completed') then raise exception 'Audio not ready'; end if;
  if r.reveal_at is not null then return r.reveal_at; end if;
  if exists(select 1 from public.room_players where room_id=r.id and not audio_ready) then raise exception '还有朋友没有准备好声音'; end if;
  update public.rooms set reveal_at=now()+interval '5 seconds' where id=r.id returning reveal_at into r.reveal_at;
  return r.reveal_at;
end;
$$;

-- Host explicitly closes a stalled blind-writing round; never invent a friend's text.
create function public.recover_voice_bricks_chaos(candidate_room_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare r public.rooms%rowtype;
begin
  select * into r from public.rooms where id=candidate_room_id for update;
  if auth.uid() is null or r.host_user_id is distinct from auth.uid() then raise exception 'Host required'; end if;
  if r.mode <> 'chaos' or r.status <> 'playing' then raise exception 'Chaos writing required'; end if;
  if now() < r.turn_started_at + interval '90 seconds' then raise exception '请给朋友至少 90 秒'; end if;
  if not exists(select 1 from public.blocks where room_id=r.id) then raise exception '至少需要一块已提交的积木'; end if;
  update public.rooms set status='assembly', chaos_reveal_started_at=now(), assembly_deadline_at=null where id=r.id;
end;
$$;

-- Submission retries carry the original round: a lost response cannot submit into the next round.
alter function public.submit_voice_brick(uuid,text,numeric) rename to submit_voice_brick_internal;
revoke all on function public.submit_voice_brick_internal(uuid,text,numeric) from public, anon, authenticated;
create function public.submit_voice_brick(candidate_room_id uuid, submitted_text text, submitted_duration numeric, expected_round integer default null) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare r public.rooms%rowtype; previous public.blocks%rowtype; player_id_value uuid;
begin
  select * into r from public.rooms where id=candidate_room_id for update;
  select id into player_id_value from public.room_players where room_id=r.id and user_id=auth.uid();
  if player_id_value is null then raise exception 'Membership required'; end if;
  select * into previous from public.blocks where room_id=r.id and player_id=player_id_value and round=coalesce(expected_round,r.current_round);
  if previous.id is not null then
    if previous.text=trim(submitted_text) then return previous.id; end if;
    raise exception '这一轮已经提交，请同步房间';
  end if;
  if expected_round is not null and expected_round<>r.current_round then raise exception '回合已变化，请同步房间'; end if;
  if char_length(trim(submitted_text)) > (case when r.mode='chaos' or r.max_players=5 then 12 when r.max_players=2 then 15 else 13 end) then raise exception '文字超出本局单块限制'; end if;
  return public.submit_voice_brick_internal(candidate_room_id,submitted_text,greatest(1.2,round(char_length(trim(submitted_text))/4.7,1)));
end;
$$;

revoke all on function public.voice_bricks_snapshot(uuid), public.rematch_voice_bricks(uuid), public.ready_voice_bricks_audio(uuid), public.start_voice_bricks_reveal(uuid), public.recover_voice_bricks_chaos(uuid), public.submit_voice_brick(uuid,text,numeric,integer) from public, anon;
grant execute on function public.voice_bricks_snapshot(uuid), public.rematch_voice_bricks(uuid), public.ready_voice_bricks_audio(uuid), public.start_voice_bricks_reveal(uuid), public.recover_voice_bricks_chaos(uuid), public.submit_voice_brick(uuid,text,numeric,integer) to authenticated;

-- Two players each get two blind lines; assembly waits for the host, not network speed.
create or replace function public.submit_voice_brick_internal(
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
    and (total_duration >= 10 or total_characters + char_length(trim(submitted_text)) >= 55)
    and (
      (player_count = 2 and target_room.current_round >= 2 and submitted_count >= player_count)
      or (player_count > 2 and (target_room.current_round > 1 or submitted_count >= player_count))
    )
  then
    update public.rooms r set status = 'assembly', assembly_deadline_at = null where r.id = candidate_room_id;
    return new_block_id;
  end if;

  if submitted_count >= player_count then
    if target_room.mode = 'chaos' and player_count = 2 and target_room.current_round < 2 then
      update public.room_players set has_submitted=false where room_id=candidate_room_id;
      update public.rooms set current_round=current_round+1, turn_started_at=now() where id=candidate_room_id;
    elsif target_room.mode = 'chaos' then
      with shuffled as (
        select b.id, row_number() over (order by md5(b.id::text || clock_timestamp()::text)) - 1 as next_position
        from public.blocks b where b.room_id = candidate_room_id
      )
      update public.blocks b set position = shuffled.next_position from shuffled where b.id = shuffled.id;
      update public.rooms r
      set status = 'assembly', chaos_reveal_started_at = now(), assembly_deadline_at = null
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
