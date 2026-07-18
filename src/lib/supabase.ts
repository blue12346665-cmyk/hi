import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Clip = {
  id: string;
  title: string;
  description: string | null;
  game: string;
  author_name: string;
  video_url: string;
  thumbnail_url: string | null;
  views: number;
  created_at: string;
};

export type Rating = {
  id: string;
  clip_id: string;
  rater_name: string;
  score: number;
  comment: string | null;
  created_at: string;
};

export type ClipWithStats = Clip & {
  rating_count: number;
  avg_score: number;
};
