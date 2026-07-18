/*
# Create clips and ratings tables (single-tenant, public)

1. New Tables
- `clips`
  - `id` (uuid, primary key)
  - `title` (text, not null) - title of the clip
  - `description` (text) - optional description
  - `game` (text, not null) - game name (e.g. Valorant, Fortnite)
  - `author_name` (text, not null) - display name of uploader
  - `video_url` (text, not null) - public URL to the uploaded video in Supabase Storage
  - `thumbnail_url` (text) - optional poster image
  - `views` (integer, default 0) - view counter
  - `created_at` (timestamptz, default now())
- `ratings`
  - `id` (uuid, primary key)
  - `clip_id` (uuid, foreign key to clips.id, on delete cascade)
  - `rater_name` (text, not null) - display name of rater
  - `score` (integer, not null, check 1-5) - star rating
  - `comment` (text) - optional comment
  - `created_at` (timestamptz, default now())

2. Indexes
- Index on `ratings(clip_id)` for fast lookup of a clip's ratings.
- Index on `clips(created_at desc)` for the feed.

3. Security
- Enable RLS on both tables.
- Public read/write for anon + authenticated (intentionally shared, no sign-in).
- Storage bucket `clips` created as public for video hosting.

4. Important Notes
1. This is a single-tenant public app: no sign-in, no user_id, no auth.uid().
2. Anyone can upload a clip and anyone can rate any clip.
3. The `clips` storage bucket is public so videos can be streamed by the anon client.
*/

CREATE TABLE IF NOT EXISTS clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  game text NOT NULL,
  author_name text NOT NULL,
  video_url text NOT NULL,
  thumbnail_url text,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clips_created_at ON clips (created_at DESC);

CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  rater_name text NOT NULL,
  score integer NOT NULL CHECK (score >= 1 AND score <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ratings_clip_id ON ratings (clip_id);

ALTER TABLE clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- clips policies (public shared data)
DROP POLICY IF EXISTS "anon_select_clips" ON clips;
CREATE POLICY "anon_select_clips" ON clips FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_clips" ON clips;
CREATE POLICY "anon_insert_clips" ON clips FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_clips" ON clips;
CREATE POLICY "anon_update_clips" ON clips FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_clips" ON clips;
CREATE POLICY "anon_delete_clips" ON clips FOR DELETE
  TO anon, authenticated USING (true);

-- ratings policies (public shared data)
DROP POLICY IF EXISTS "anon_select_ratings" ON ratings;
CREATE POLICY "anon_select_ratings" ON ratings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ratings" ON ratings;
CREATE POLICY "anon_insert_ratings" ON ratings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ratings" ON ratings;
CREATE POLICY "anon_delete_ratings" ON ratings FOR DELETE
  TO anon, authenticated USING (true);

-- Public storage bucket for clip videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('clips', 'clips', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload/read files in the clips bucket
DROP POLICY IF EXISTS "anon_upload_clips_bucket" ON storage.objects;
CREATE POLICY "anon_upload_clips_bucket" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'clips');

DROP POLICY IF EXISTS "anon_read_clips_bucket" ON storage.objects;
CREATE POLICY "anon_read_clips_bucket" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'clips');
