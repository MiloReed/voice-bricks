-- Every member may preview shared assembly blocks, but blind drafts remain private.
create or replace function public.claim_voice_brick_preview(candidate_block_id uuid)
returns table (preview_room_id uuid, preview_voice_id text, preview_text text, existing_audio_url text)
language plpgsql security definer set search_path = public, auth
as $$
declare
  target_block public.blocks%rowtype;
  target_room public.rooms%rowtype;
  owner_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target_block from public.blocks where id = candidate_block_id;
  if target_block.id is null then raise exception 'Block not found'; end if;
  select * into target_room from public.rooms where id = target_block.room_id;
  if not public.is_room_member(target_room.id) then raise exception 'Block preview is private'; end if;
  select user_id into owner_id from public.room_players where id = target_block.player_id;
  if owner_id is distinct from auth.uid()
    and (target_room.mode = 'chaos' and target_room.status in ('lobby', 'playing')) then
    raise exception 'Block preview is private';
  end if;
  return query select target_room.id, target_room.voice_id, target_block.text, target_block.preview_audio_url;
end;
$$;
revoke all on function public.claim_voice_brick_preview(uuid) from public, anon;
grant execute on function public.claim_voice_brick_preview(uuid) to authenticated;
