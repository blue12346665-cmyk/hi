import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  Gamepad2,
  Loader2,
  Play,
  Search,
  Star,
  Trophy,
  Upload,
  Users,
  Video,
  X,
  Eye,
  TrendingUp,
  Clock,
  Send,
  Crown,
  Sparkles,
} from 'lucide-react';
import { supabase, type Clip, type Rating } from './lib/supabase';

type ClipWithStats = Clip & {
  rating_count: number;
  avg_score: number;
};

type SortMode = 'latest' | 'top' | 'trending';
type GameFilter = 'all' | string;

const GAME_OPTIONS = [
  'Valorant',
  'Counter-Strike 2',
  'Fortnite',
  'Apex Legends',
  'Call of Duty',
  'League of Legends',
  'Overwatch 2',
  'Rocket League',
  'Minecraft',
  'Grand Theft Auto V',
  'Other',
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function gradientFor(seed: string): string {
  const palettes = [
    'from-fuchsia-500 to-cyan-400',
    'from-emerald-400 to-blue-500',
    'from-orange-500 to-rose-500',
    'from-violet-500 to-emerald-400',
    'from-amber-400 to-pink-500',
    'from-cyan-400 to-indigo-500',
    'from-rose-500 to-amber-400',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

export default function App() {
  const [clips, setClips] = useState<ClipWithStats[]>([]);
  const [ratingsByClip, setRatingsByClip] = useState<Record<string, Rating[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeClip, setActiveClip] = useState<ClipWithStats | null>(null);
  const [sort, setSort] = useState<SortMode>('latest');
  const [gameFilter, setGameFilter] = useState<GameFilter>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const fetchClips = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clips')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const clipsData = (data ?? []) as Clip[];
    const clipIds = clipsData.map((c) => c.id);
    if (clipIds.length === 0) {
      setClips([]);
      setLoading(false);
      return;
    }
    const { data: ratingsData } = await supabase
      .from('ratings')
      .select('*')
      .in('clip_id', clipIds)
      .order('created_at', { ascending: false });
    const ratings = (ratingsData ?? []) as Rating[];
    const byClip: Record<string, Rating[]> = {};
    const stats: Record<string, { count: number; sum: number }> = {};
    for (const r of ratings) {
      byClip[r.clip_id] = byClip[r.clip_id] ? [...byClip[r.clip_id], r] : [r];
      stats[r.clip_id] = stats[r.clip_id] || { count: 0, sum: 0 };
      stats[r.clip_id].count += 1;
      stats[r.clip_id].sum += r.score;
    }
    setRatingsByClip(byClip);
    setClips(
      clipsData.map((c) => ({
        ...c,
        rating_count: stats[c.id]?.count ?? 0,
        avg_score: stats[c.id] ? stats[c.id].sum / stats[c.id].count : 0,
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClips();
  }, [fetchClips]);

  const gamesInFeed = useMemo(() => {
    const set = new Set<string>();
    clips.forEach((c) => set.add(c.game));
    return Array.from(set).sort();
  }, [clips]);

  const filtered = useMemo(() => {
    let list = clips.slice();
    if (gameFilter !== 'all') list = list.filter((c) => c.game === gameFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.author_name.toLowerCase().includes(q) ||
          c.game.toLowerCase().includes(q),
      );
    }
    if (sort === 'latest') list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === 'top')
      list.sort((a, b) => b.avg_score - a.avg_score || b.rating_count - a.rating_count);
    else if (sort === 'trending')
      list.sort((a, b) => b.views - a.views || b.rating_count - a.rating_count);
    return list;
  }, [clips, sort, gameFilter, search]);

  const topCreators = useMemo(() => {
    const map: Record<string, { total: number; count: number; views: number }> = {};
    clips.forEach((c) => {
      map[c.author_name] = map[c.author_name] || { total: 0, count: 0, views: 0 };
      map[c.author_name].total += c.avg_score * c.rating_count;
      map[c.author_name].count += c.rating_count;
      map[c.author_name].views += c.views;
    });
    return Object.entries(map)
      .map(([name, v]) => ({
        name,
        avg: v.count ? v.total / v.count : 0,
        count: v.count,
        views: v.views,
      }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 5);
  }, [clips]);

  const handleView = useCallback(async (clip: ClipWithStats) => {
    setActiveClip(clip);
    const { error } = await supabase
      .from('clips')
      .update({ views: clip.views + 1 })
      .eq('id', clip.id);
    if (!error) {
      setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, views: c.views + 1 } : c)));
    }
  }, []);

  const handleNewRating = (clipId: string, rating: Rating) => {
    setRatingsByClip((prev) => ({
      ...prev,
      [clipId]: [rating, ...(prev[clipId] ?? [])],
    }));
    setClips((prev) =>
      prev.map((c) => {
        if (c.id !== clipId) return c;
        const newCount = c.rating_count + 1;
        const newAvg = (c.avg_score * c.rating_count + rating.score) / newCount;
        return { ...c, rating_count: newCount, avg_score: newAvg };
      }),
    );
    if (activeClip?.id === clipId) {
      setActiveClip((prev) =>
        prev
          ? {
              ...prev,
              rating_count: prev.rating_count + 1,
              avg_score: (prev.avg_score * prev.rating_count + rating.score) / (prev.rating_count + 1),
            }
          : prev,
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#07060d] text-zinc-100 font-sans relative overflow-x-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 w-[40rem] h-[40rem] rounded-full bg-fuchsia-600/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[36rem] h-[36rem] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[30rem] h-[30rem] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#07060d]/70 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
                <Gamepad2 className="w-5 h-5 text-black" />
              </div>
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 blur opacity-40 -z-10" />
            </div>
            <div className="leading-none">
              <div className="font-extrabold tracking-tight text-lg">
                CLIP<span className="text-fuchsia-400">ARENA</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Rate · Compete · Dominate
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-xl mx-auto hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clips, players, games..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-500/50 focus:bg-white/[0.07] transition"
              />
            </div>
          </div>

          <button
            onClick={() => setUploadOpen(true)}
            className="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-bold text-sm shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 hover:scale-[1.02] active:scale-95 transition"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload Clip</span>
          </button>
        </div>

        {/* mobile search */}
        <div className="sm:hidden px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clips..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-500/50"
            />
          </div>
        </div>
      </header>

      {/* Hero stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<Video className="w-5 h-5" />}
            label="Total Clips"
            value={clips.length}
            gradient="from-fuchsia-500/20 to-pink-500/10"
            accent="text-fuchsia-400"
          />
          <StatCard
            icon={<Star className="w-5 h-5" />}
            label="Total Ratings"
            value={Object.values(ratingsByClip).reduce((a, r) => a + r.length, 0)}
            gradient="from-amber-500/20 to-orange-500/10"
            accent="text-amber-400"
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Active Creators"
            value={new Set(clips.map((c) => c.author_name)).size}
            gradient="from-cyan-500/20 to-blue-500/10"
            accent="text-cyan-400"
          />
          <StatCard
            icon={<Eye className="w-5 h-5" />}
            label="Total Views"
            value={clips.reduce((a, c) => a + c.views, 0)}
            gradient="from-emerald-500/20 to-teal-500/10"
            accent="text-emerald-400"
          />
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Feed */}
        <div>
          {/* Sort tabs */}
          <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
            <SortTab active={sort === 'latest'} onClick={() => setSort('latest')} icon={<Clock className="w-4 h-4" />}>
              Latest
            </SortTab>
            <SortTab active={sort === 'top'} onClick={() => setSort('top')} icon={<Trophy className="w-4 h-4" />}>
              Top Rated
            </SortTab>
            <SortTab active={sort === 'trending'} onClick={() => setSort('trending')} icon={<TrendingUp className="w-4 h-4" />}>
              Trending
            </SortTab>
          </div>

          {/* Game filter chips */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
            <FilterChip active={gameFilter === 'all'} onClick={() => setGameFilter('all')}>
              All Games
            </FilterChip>
            {gamesInFeed.map((g) => (
              <FilterChip key={g} active={gameFilter === g} onClick={() => setGameFilter(g)}>
                {g}
              </FilterChip>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
              <p className="mt-3 text-sm">Loading the arena...</p>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onUpload={() => setUploadOpen(true)} hasFilter={!!search || gameFilter !== 'all'} />
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  ratingCount={clip.rating_count}
                  avgScore={clip.avg_score}
                  onView={() => handleView(clip)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard sidebar */}
        <aside className="lg:sticky lg:top-24 h-fit space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-amber-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider">Top Creators</h2>
            </div>
            {topCreators.length === 0 ? (
              <p className="text-sm text-zinc-500">No creators yet. Be the first!</p>
            ) : (
              <ol className="space-y-3">
                {topCreators.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-bold ${
                        i === 0
                          ? 'bg-amber-400/20 text-amber-300'
                          : i === 1
                          ? 'bg-zinc-300/20 text-zinc-200'
                          : i === 2
                          ? 'bg-orange-700/30 text-orange-300'
                          : 'bg-white/5 text-zinc-400'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      <div className="text-xs text-zinc-500">
                        {c.count} ratings · {c.views} views
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      {c.avg.toFixed(1)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-fuchsia-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider">Pro Tip</h2>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Clips with thumbnails and a clear title get up to <span className="text-fuchsia-400 font-bold">3x more ratings</span>. Share your clip link to climb the leaderboard!
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-400" />
              <h2 className="font-bold text-sm uppercase tracking-wider">How It Works</h2>
            </div>
            <ol className="space-y-2.5 text-sm text-zinc-400">
              <li><span className="text-zinc-200 font-semibold">1.</span> Upload your best gameplay clip</li>
              <li><span className="text-zinc-200 font-semibold">2.</span> The community rates it 1–5 stars</li>
              <li><span className="text-zinc-200 font-semibold">3.</span> Climb the leaderboard with top ratings</li>
            </ol>
          </div>
        </aside>
      </main>

      <footer className="border-t border-white/5 mt-10">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-xs text-zinc-600">
          CLIPARENA · Built for gamers, by gamers · {new Date().getFullYear()}
        </div>
      </footer>

      {/* Upload modal */}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            fetchClips();
            showToast('Clip uploaded! Time to climb the ranks.');
          }}
        />
      )}

      {/* Clip detail modal */}
      {activeClip && (
        <ClipModal
          clip={activeClip}
          ratings={ratingsByClip[activeClip.id] ?? []}
          onClose={() => setActiveClip(null)}
          onRated={(r) => handleNewRating(activeClip.id, r)}
          onToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl bg-zinc-900 border border-fuchsia-500/40 text-sm font-medium shadow-2xl shadow-fuchsia-500/20 animate-[fadeIn_0.2s_ease]">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  gradient,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  gradient: string;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${gradient} p-4`}>
      <div className={`${accent} mb-2`}>{icon}</div>
      <div className="text-2xl font-extrabold tabular-nums">{value.toLocaleString()}</div>
      <div className="text-xs text-zinc-400 mt-0.5">{label}</div>
    </div>
  );
}

function SortTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
        active
          ? 'bg-white/10 text-white border border-white/20'
          : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
        active
          ? 'bg-fuchsia-500 text-black'
          : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10'
      }`}
    >
      {children}
    </button>
  );
}

function ClipCard({
  clip,
  ratingCount,
  avgScore,
  onView,
}: {
  clip: ClipWithStats;
  ratingCount: number;
  avgScore: number;
  onView: () => void;
}) {
  return (
    <button
      onClick={onView}
      className="group text-left rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05] transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-fuchsia-500/10"
    >
      <div className="relative aspect-video overflow-hidden bg-black">
        <video
          src={clip.video_url}
          poster={clip.thumbnail_url ?? undefined}
          muted
          playsInline
          preload="metadata"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
            <Play className="w-6 h-6 text-white fill-white ml-0.5" />
          </div>
        </div>
        <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-semibold border border-white/10">
          {clip.game}
        </div>
        <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-semibold border border-white/10 flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {clip.views}
        </div>
        {avgScore > 0 && (
          <div className="absolute bottom-2.5 right-2.5 px-2 py-1 rounded-lg bg-amber-500/90 text-black text-[11px] font-bold flex items-center gap-1">
            <Star className="w-3 h-3 fill-black" />
            {avgScore.toFixed(1)}
          </div>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="font-bold text-sm leading-snug line-clamp-1">{clip.title}</h3>
        <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${gradientFor(clip.author_name)} flex items-center justify-center text-[10px] font-bold text-black`}>
              {clip.author_name.charAt(0).toUpperCase()}
            </span>
            <span className="truncate max-w-[8rem]">{clip.author_name}</span>
          </span>
          <span className="flex items-center gap-1 text-zinc-500">
            <Star className="w-3 h-3" />
            {ratingCount}
          </span>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onUpload, hasFilter }: { onUpload: () => void; hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center mb-5">
        <Video className="w-10 h-10 text-fuchsia-400" />
      </div>
      <h3 className="text-xl font-bold mb-1.5">
        {hasFilter ? 'No clips match your filters' : 'The arena is empty'}
      </h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-5">
        {hasFilter
          ? 'Try a different game or clear your search.'
          : 'Be the first to upload a clip and start the competition.'}
      </p>
      {!hasFilter && (
        <button
          onClick={onUpload}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-bold text-sm shadow-lg shadow-fuchsia-500/30 hover:scale-[1.02] active:scale-95 transition"
        >
          <Upload className="w-4 h-4" />
          Upload Your First Clip
        </button>
      )}
    </div>
  );
}

function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [game, setGame] = useState(GAME_OPTIONS[0]);
  const [author, setAuthor] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      setError('Please choose a video file.');
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setError('Max file size is 100MB.');
      return;
    }
    setError(null);
    setFile(f);
  };

  const submit = async () => {
    if (!file) {
      setError('Choose a video file to upload.');
      return;
    }
    if (!title.trim() || !author.trim()) {
      setError('Title and your name are required.');
      return;
    }
    setUploading(true);
    setError(null);
    setProgress(0);
    try {
      const ext = file.name.split('.').pop() ?? 'mp4';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('clips')
        .upload(path, file, {
          contentType: file.type || 'video/mp4',
          upsert: false,
        });
      if (upErr) throw upErr;
      setProgress(70);
      const { data: pub } = supabase.storage.from('clips').getPublicUrl(path);
      const videoUrl = pub.publicUrl;
      const { error: insertErr } = await supabase.from('clips').insert({
        title: title.trim(),
        description: description.trim() || null,
        game,
        author_name: author.trim(),
        video_url: videoUrl,
      });
      if (insertErr) throw insertErr;
      setProgress(100);
      onUploaded();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Upload failed. Try again.');
      setUploading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Upload Your Clip" icon={<Upload className="w-5 h-5 text-fuchsia-400" />}>
      <div className="space-y-4">
        {/* Dropzone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`cursor-pointer rounded-xl border-2 border-dashed transition p-6 text-center ${
            file
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-white/15 hover:border-fuchsia-500/50 hover:bg-white/[0.03]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Video className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold truncate max-w-[14rem]">{file.name}</div>
                <div className="text-xs text-zinc-500">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                <Upload className="w-5 h-5 text-zinc-400" />
              </div>
              <div className="text-sm font-medium">Drop your video here or click to browse</div>
              <div className="text-xs text-zinc-500">MP4, WebM up to 100MB</div>
            </div>
          )}
        </div>

        <Field label="Clip Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Insane 1v5 clutch on Haven"
            className="input"
          />
        </Field>

        <Field label="Your Gamer Tag">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={40}
            placeholder="ShadowSlayer"
            className="input"
          />
        </Field>

        <Field label="Game">
          <select value={game} onChange={(e) => setGame(e.target.value)} className="input">
            {GAME_OPTIONS.map((g) => (
              <option key={g} value={g} className="bg-zinc-900">
                {g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Tell the arena what makes this clip special..."
            className="input resize-none"
          />
        </Field>

        {error && (
          <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {uploading && (
          <div className="space-y-1.5">
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-zinc-500 text-center">
              {progress < 70 ? 'Uploading video...' : progress < 100 ? 'Saving to arena...' : 'Done!'}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold hover:bg-white/10 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={uploading}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-bold text-sm hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100 transition inline-flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Publish Clip'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ClipModal({
  clip,
  ratings,
  onClose,
  onRated,
  onToast,
}: {
  clip: ClipWithStats;
  ratings: Rating[];
  onClose: () => void;
  onRated: (r: Rating) => void;
  onToast: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Enter your gamer tag to rate.');
      return;
    }
    if (score < 1 || score > 5) {
      setError('Pick a star rating.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase
      .from('ratings')
      .insert({
        clip_id: clip.id,
        rater_name: name.trim(),
        score,
        comment: comment.trim() || null,
      })
      .select('*')
      .single();
    setSubmitting(false);
    if (error || !data) {
      setError(error?.message ?? 'Failed to submit rating.');
      return;
    }
    onRated(data as Rating);
    onToast('Rating submitted!');
    setName('');
    setScore(0);
    setComment('');
  };

  return (
    <ModalShell onClose={onClose} title={clip.title} compact>
      <div className="space-y-5">
        <div className="rounded-xl overflow-hidden bg-black border border-white/10">
          <video src={clip.video_url} poster={clip.thumbnail_url ?? undefined} controls autoPlay playsInline className="w-full aspect-video" />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="px-2.5 py-1 rounded-lg bg-fuchsia-500/15 text-fuchsia-300 font-semibold border border-fuchsia-500/20">
            {clip.game}
          </span>
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${gradientFor(clip.author_name)} flex items-center justify-center text-[10px] font-bold text-black`}>
              {clip.author_name.charAt(0).toUpperCase()}
            </span>
            <span className="font-semibold text-zinc-200">{clip.author_name}</span>
          </span>
          <span className="flex items-center gap-1 text-zinc-500">
            <Eye className="w-3.5 h-3.5" /> {clip.views}
          </span>
          <span className="flex items-center gap-1 text-amber-400 font-bold">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            {clip.avg_score.toFixed(1)}
            <span className="text-zinc-500 font-normal">({clip.rating_count})</span>
          </span>
          <span className="text-zinc-500 ml-auto">{timeAgo(clip.created_at)}</span>
        </div>

        {clip.description && (
          <p className="text-sm text-zinc-300 leading-relaxed">{clip.description}</p>
        )}

        {/* Rate form */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" />
            Rate this clip
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setScore(s)}
                  className="p-1 transition hover:scale-110"
                  aria-label={`Rate ${s} stars`}
                >
                  <Star
                    className={`w-7 h-7 transition ${
                      (hover || score) >= s ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'
                    }`}
                  />
                </button>
              ))}
              {score > 0 && (
                <span className="ml-2 text-sm font-bold text-amber-400">{score}.0</span>
              )}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Your gamer tag"
              className="input"
            />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={240}
              rows={2}
              placeholder="Leave a comment (optional)"
              className="input resize-none"
            />
            {error && (
              <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-bold text-sm hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </div>

        {/* Ratings list */}
        <div>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            Community Ratings ({ratings.length})
          </h3>
          {ratings.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">No ratings yet. Be the first to judge!</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {ratings.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradientFor(r.rater_name)} flex items-center justify-center text-[10px] font-bold text-black`}>
                        {r.rater_name.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-semibold text-sm">{r.rater_name}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= r.score ? 'fill-amber-400 text-amber-400' : 'text-zinc-700'}`}
                        />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-zinc-300 pl-8">{r.comment}</p>}
                  <div className="text-[11px] text-zinc-600 pl-8 mt-1">{timeAgo(r.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  onClose,
  title,
  icon,
  children,
  compact,
}: {
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  compact?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease]" onClick={onClose} />
      <div
        className={`relative w-full ${compact ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10 bg-[#0c0a14] shadow-2xl animate-[slideUp_0.25s_ease]`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-[#0c0a14]/95 backdrop-blur">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon}
            <h2 className="font-bold text-base truncate">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">{label}</span>
      {children}
    </label>
  );
}
