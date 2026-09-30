alter table public.works
add column if not exists share_payload jsonb;

alter table public.works
add constraint works_share_payload_object
check (share_payload is null or jsonb_typeof(share_payload) = 'object');
