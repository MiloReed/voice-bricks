insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-bricks-share',
  'voice-bricks-share',
  true,
  104857600,
  array['image/png', 'video/mp4']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
