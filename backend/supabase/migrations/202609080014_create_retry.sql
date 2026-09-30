alter table public.rooms add column creation_request_id uuid;
create unique index rooms_creation_request on public.rooms(host_user_id,creation_request_id);
alter function public.create_voice_bricks_room(text,text,public.game_mode,smallint,text,text) rename to create_voice_bricks_room_internal;
revoke all on function public.create_voice_bricks_room_internal(text,text,public.game_mode,smallint,text,text) from public, anon, authenticated;
create function public.create_voice_bricks_room(player_name text, requested_team_name text, requested_mode public.game_mode, requested_max_players smallint, requested_theme text, requested_voice_id text, request_id uuid default null)
returns table(created_room_id uuid, created_room_code text)
language plpgsql security definer set search_path=public,auth as $$
declare result_id uuid; result_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  -- Serialize concurrent retries from this identity before checking the receipt.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select id,code into result_id,result_code from public.rooms where host_user_id=auth.uid() and creation_request_id=request_id;
  if result_id is null then
    select c.created_room_id,c.created_room_code into result_id,result_code from public.create_voice_bricks_room_internal(player_name,requested_team_name,requested_mode,requested_max_players,requested_theme,requested_voice_id) c;
    update public.rooms set creation_request_id=request_id where id=result_id;
  end if;
  return query select result_id,result_code;
end;
$$;
revoke all on function public.create_voice_bricks_room(text,text,public.game_mode,smallint,text,text,uuid) from public, anon;
grant execute on function public.create_voice_bricks_room(text,text,public.game_mode,smallint,text,text,uuid) to authenticated;
