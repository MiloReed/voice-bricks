create or replace function public.claim_voice_brick_preview(candidate_block_id uuid)
returns table (
  preview_room_id uuid,
  preview_voice_id text,
  preview_text text,
  existing_audio_url text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_block public.blocks%rowtype;
  target_room public.rooms%rowtype;
  target_player public.room_players%rowtype;
begin
  select b.* into target_block from public.blocks b where b.id = candidate_block_id;
  if target_block.id is null then raise exception 'Block not found'; end if;
  select r.* into target_room from public.rooms r where r.id = target_block.room_id;
  select rp.* into target_player from public.room_players rp where rp.id = target_block.player_id;

  if target_player.user_id <> auth.uid() and target_room.host_user_id <> auth.uid() then
    raise exception 'Block owner or host required';
  end if;

  return query select target_room.id, target_room.voice_id, target_block.text, target_block.preview_audio_url;
end;
$$;

grant execute on function public.claim_voice_brick_preview(uuid) to authenticated;
revoke execute on function public.claim_voice_brick_preview(uuid) from public, anon;
