-- API rate limiting was split into 202609080011_api_limits.sql for independent deployment.

-- Published work metadata is written through authenticated server routes only.
drop policy if exists works_insert_host on public.works;
drop policy if exists works_update_host on public.works;
revoke insert, update, delete on public.works from anon, authenticated;

-- Earlier migrations granted authenticated access but left the default PUBLIC grant.
revoke execute on function public.reorder_voice_bricks(uuid, uuid[]) from public, anon;
revoke execute on function public.final_edit_voice_brick(uuid, uuid, text, numeric) from public, anon;
revoke execute on function public.finish_voice_bricks_assembly(uuid) from public, anon;

-- Preview access moved to 202609080015_shared_block_preview.sql.
