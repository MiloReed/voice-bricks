-- Add WAV without removing support for existing Fish MP3 works.
update storage.buckets
set allowed_mime_types = array(select distinct mime from unnest(allowed_mime_types || array['audio/wav']) as mime)
where id = 'voice-bricks-audio' and allowed_mime_types is not null;
