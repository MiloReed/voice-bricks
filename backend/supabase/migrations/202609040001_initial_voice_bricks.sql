create extension if not exists pgcrypto;

create type public.game_mode as enum ('classic', 'chaos');
create type public.room_status as enum (
  'lobby',
  'playing',
  'assembly',
  'rendering',
  'revealed',
  'completed',
  'cancelled'
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null check (char_length(team_name) between 1 and 24),
  mode public.game_mode not null,
  status public.room_status not null default 'lobby',
  max_players smallint not null check (max_players between 2 and 5),
  theme text not null check (char_length(theme) between 1 and 40),
  voice_id text not null,
  current_player_index smallint not null default 0,
  current_round smallint not null default 1,
  final_edit_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 16),
  color text not null check (color in ('purple', 'blue', 'green', 'yellow', 'pink')),
  seat_index smallint not null check (seat_index between 0 and 4),
  is_ready boolean not null default false,
  has_submitted boolean not null default false,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, seat_index)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.room_players(id) on delete cascade,
  round smallint not null default 1,
  text text not null check (char_length(text) between 1 and 30),
  preview_audio_url text,
  duration_seconds numeric(5, 2) check (duration_seconds > 0 and duration_seconds <= 15),
  position smallint,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'rendered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, round, player_id)
);

create table public.works (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms(id) on delete cascade,
  final_text text not null,
  final_audio_url text,
  duration_seconds numeric(5, 2),
  ai_comment text,
  share_image_url text,
  share_video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger rooms_set_updated_at before update on public.rooms
for each row execute function public.set_updated_at();
create trigger room_players_set_updated_at before update on public.room_players
for each row execute function public.set_updated_at();
create trigger blocks_set_updated_at before update on public.blocks
for each row execute function public.set_updated_at();
create trigger works_set_updated_at before update on public.works
for each row execute function public.set_updated_at();

create or replace function public.is_room_member(candidate_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.room_players rp
    where rp.room_id = candidate_room_id and rp.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_host(candidate_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = candidate_room_id and r.host_user_id = auth.uid()
  );
$$;

create or replace function public.create_voice_bricks_room(
  player_name text,
  requested_team_name text,
  requested_mode public.game_mode,
  requested_max_players smallint,
  requested_theme text,
  requested_voice_id text
)
returns table (created_room_id uuid, created_room_code text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  new_room_id uuid;
  new_code text;
  attempts smallint := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if requested_max_players not between 2 and 5 then raise exception 'Player count must be 2–5'; end if;

  loop
    attempts := attempts + 1;
    new_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
    begin
      insert into public.rooms (
        code, host_user_id, team_name, mode, max_players, theme, voice_id
      ) values (
        new_code, auth.uid(), trim(requested_team_name), requested_mode,
        requested_max_players, trim(requested_theme), requested_voice_id
      ) returning id into new_room_id;
      exit;
    exception when unique_violation then
      if attempts >= 8 then raise; end if;
    end;
  end loop;

  insert into public.room_players (
    room_id, user_id, display_name, color, seat_index, is_ready
  ) values (
    new_room_id, auth.uid(), trim(player_name), 'purple', 0, true
  );

  return query select new_room_id, new_code;
end;
$$;

create or replace function public.join_voice_bricks_room(
  requested_code text,
  player_name text
)
returns table (joined_room_id uuid, joined_seat_index smallint)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_room public.rooms%rowtype;
  existing_player public.room_players%rowtype;
  next_seat smallint;
  colors text[] := array['purple', 'blue', 'green', 'yellow', 'pink'];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select r.* into target_room
  from public.rooms r
  where r.code = upper(trim(requested_code))
  for update;

  if target_room.id is null then raise exception 'Room not found'; end if;

  select rp.* into existing_player
  from public.room_players rp
  where rp.room_id = target_room.id and rp.user_id = auth.uid();

  if existing_player.id is not null then
    return query select target_room.id, existing_player.seat_index;
    return;
  end if;

  if target_room.status <> 'lobby' then raise exception 'Game already started'; end if;

  select count(*)::smallint into next_seat
  from public.room_players rp
  where rp.room_id = target_room.id;

  if next_seat >= target_room.max_players then raise exception 'Room is full'; end if;

  insert into public.room_players (
    room_id, user_id, display_name, color, seat_index
  ) values (
    target_room.id, auth.uid(), trim(player_name), colors[next_seat + 1], next_seat
  );

  return query select target_room.id, next_seat;
end;
$$;

create or replace function public.set_voice_bricks_ready(candidate_room_id uuid, ready boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.room_players rp
  set is_ready = ready
  where rp.room_id = candidate_room_id and rp.user_id = auth.uid();
  if not found then raise exception 'Player not found in room'; end if;
end;
$$;

create or replace function public.start_voice_bricks_room(candidate_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_room public.rooms%rowtype;
  joined_count integer;
  unready_count integer;
begin
  select r.* into target_room from public.rooms r where r.id = candidate_room_id for update;
  if target_room.id is null or target_room.host_user_id <> auth.uid() then raise exception 'Host required'; end if;
  if target_room.status <> 'lobby' then raise exception 'Room already started'; end if;

  select count(*), count(*) filter (where not rp.is_ready)
  into joined_count, unready_count
  from public.room_players rp where rp.room_id = candidate_room_id;

  if joined_count <> target_room.max_players then raise exception 'Wait for every invited player'; end if;
  if unready_count > 0 then raise exception 'Some players are not ready'; end if;

  update public.rooms r set status = 'playing' where r.id = candidate_room_id;
end;
$$;

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
begin
  select r.* into target_room from public.rooms r where r.id = candidate_room_id for update;
  if target_room.id is null or target_room.status <> 'playing' then raise exception 'Room is not accepting blocks'; end if;

  select rp.* into current_player
  from public.room_players rp
  where rp.room_id = candidate_room_id and rp.user_id = auth.uid()
  for update;
  if current_player.id is null then raise exception 'Player not found in room'; end if;
  if current_player.has_submitted then raise exception 'Block already submitted'; end if;
  if target_room.mode = 'classic' and current_player.seat_index <> target_room.current_player_index then
    raise exception 'Not your turn';
  end if;

  insert into public.blocks (room_id, player_id, round, text, duration_seconds, position, status)
  values (
    candidate_room_id,
    current_player.id,
    target_room.current_round,
    trim(submitted_text),
    submitted_duration,
    current_player.seat_index,
    'submitted'
  ) returning id into new_block_id;

  update public.room_players rp set has_submitted = true where rp.id = current_player.id;
  select count(*) into player_count from public.room_players rp where rp.room_id = candidate_room_id;
  select count(*) into submitted_count from public.room_players rp where rp.room_id = candidate_room_id and rp.has_submitted;

  if submitted_count >= player_count then
    update public.rooms r set status = 'assembly' where r.id = candidate_room_id;
  elsif target_room.mode = 'classic' then
    update public.rooms r set current_player_index = target_room.current_player_index + 1 where r.id = candidate_room_id;
  end if;

  return new_block_id;
end;
$$;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.blocks enable row level security;
alter table public.works enable row level security;

create policy rooms_select_members on public.rooms for select to authenticated
using (public.is_room_member(id));
create policy room_players_select_members on public.room_players for select to authenticated
using (public.is_room_member(room_id));

create policy blocks_select_members on public.blocks for select to authenticated
using (
  public.is_room_member(room_id)
  and (
    exists (select 1 from public.room_players rp where rp.id = player_id and rp.user_id = auth.uid())
    or exists (
      select 1 from public.rooms r
      where r.id = room_id
      and (r.mode = 'classic' or r.status not in ('lobby', 'playing'))
    )
  )
);
create policy works_select_public on public.works for select to anon, authenticated using (true);
create policy works_insert_host on public.works for insert to authenticated
with check (public.is_room_host(room_id));
create policy works_update_host on public.works for update to authenticated
using (public.is_room_host(room_id)) with check (public.is_room_host(room_id));

grant execute on function public.create_voice_bricks_room(text, text, public.game_mode, smallint, text, text) to authenticated;
grant execute on function public.join_voice_bricks_room(text, text) to authenticated;
grant execute on function public.set_voice_bricks_ready(uuid, boolean) to authenticated;
grant execute on function public.start_voice_bricks_room(uuid) to authenticated;
grant execute on function public.submit_voice_brick(uuid, text, numeric) to authenticated;

revoke execute on function public.create_voice_bricks_room(text, text, public.game_mode, smallint, text, text) from public, anon;
revoke execute on function public.join_voice_bricks_room(text, text) from public, anon;
revoke execute on function public.set_voice_bricks_ready(uuid, boolean) from public, anon;
revoke execute on function public.start_voice_bricks_room(uuid) from public, anon;
revoke execute on function public.submit_voice_brick(uuid, text, numeric) from public, anon;

revoke insert, update, delete on public.rooms, public.room_players, public.blocks from anon, authenticated;
grant select on public.rooms, public.room_players, public.blocks to authenticated;
grant select on public.works to anon, authenticated;
grant insert, update on public.works to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.room_players;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.blocks;
exception when duplicate_object then null;
end $$;
