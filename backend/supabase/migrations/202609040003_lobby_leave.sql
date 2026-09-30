alter table public.room_players
drop constraint room_players_room_id_seat_index_key;

alter table public.room_players
add constraint room_players_room_id_seat_index_key
unique (room_id, seat_index)
deferrable initially deferred;

create or replace function public.leave_voice_bricks_room(candidate_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_room public.rooms%rowtype;
  leaving_player public.room_players%rowtype;
  colors text[] := array['purple', 'blue', 'green', 'yellow', 'pink'];
begin
  select r.* into target_room
  from public.rooms r
  where r.id = candidate_room_id
  for update;

  if target_room.id is null then raise exception 'Room not found'; end if;
  if target_room.status <> 'lobby' then raise exception 'Cannot leave after the game starts'; end if;

  select rp.* into leaving_player
  from public.room_players rp
  where rp.room_id = candidate_room_id and rp.user_id = auth.uid()
  for update;
  if leaving_player.id is null then raise exception 'Player not found in room'; end if;

  if target_room.host_user_id = auth.uid() then
    update public.rooms r set status = 'cancelled' where r.id = candidate_room_id;
    return true;
  end if;

  delete from public.room_players rp where rp.id = leaving_player.id;

  with ranked as (
    select rp.id, (row_number() over (order by rp.seat_index) - 1)::smallint as new_seat
    from public.room_players rp
    where rp.room_id = candidate_room_id
  )
  update public.room_players rp
  set seat_index = ranked.new_seat,
      color = colors[ranked.new_seat + 1],
      is_ready = case when ranked.new_seat = 0 then true else rp.is_ready end
  from ranked
  where rp.id = ranked.id;

  return false;
end;
$$;

grant execute on function public.leave_voice_bricks_room(uuid) to authenticated;
revoke execute on function public.leave_voice_bricks_room(uuid) from public, anon;
