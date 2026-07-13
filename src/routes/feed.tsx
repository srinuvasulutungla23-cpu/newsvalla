import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect, type TouchEvent, type WheelEvent } from "react";
import {
  Menu,
  Search,
  Share2,
  Bookmark,
  Home,
  Compass,
  User,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Newspaper,
  BookOpen,
  Sparkles,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  HelpCircle,
} from "lucide-react";
import { useNews } from "@/hooks/use-news";
import { fetchAISummary, type Article } from "@/lib/news-api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";


export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Newsvalla — Today's headlines in 60 words" },
      {
        name: "description",
        content:
          "Swipe through curated 60-word news summaries from top sources.",
      },
    ],
  }),
  component: Feed,
});

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "general", label: "General" },
  { id: "telugu", label: "Telugu" },
  { id: "technology", label: "Tech" },
  { id: "business", label: "Business" },
  { id: "sports", label: "Sports" },
  { id: "health", label: "Health" },
  { id: "science", label: "Science" },
  { id: "entertainment", label: "Entertainment" },
] as const;

/** Fallback gradients when an article has no image */
const GRADIENTS = [
  "linear-gradient(135deg, #c0392b 0%, #e74c3c 50%, #f39c12 100%)",
  "linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #2980b9 100%)",
  "linear-gradient(135deg, #16a085 0%, #1abc9c 50%, #2ecc71 100%)",
  "linear-gradient(135deg, #8e44ad 0%, #9b59b6 50%, #e91e63 100%)",
  "linear-gradient(135deg, #e67e22 0%, #f39c12 50%, #f1c40f 100%)",
  "linear-gradient(135deg, #1a237e 0%, #283593 50%, #5c6bc0 100%)",
];

// ── Main Component ─────────────────────────────────────────────────────────────

function Feed() {
  const [category, setCategory] = useState("general");
  const [index, setIndex] = useState(0);
  const [anim, setAnim] = useState<"in" | "out-up" | "out-down">("in");
  const touchStartY = useRef<number | null>(null);
  const wheelLock = useRef(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  // ── AI News Assistant State ──────────────────────────────────────────────────
  const [isAISheetOpen, setIsAISheetOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ bullets: string[]; raw: string } | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Audio / Speech Synthesis State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speakMode, setSpeakMode] = useState<"article" | "summary">("summary");
  const [speechSpeed, setSpeechSpeed] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [speechProgress, setSpeechProgress] = useState(0);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const { data: articles, isLoading, isError, error, refetch } = useNews(category);
  const stories = articles ?? [];
  const story = stories[index] as Article | undefined;

  // Load voices when component mounts
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const englishVoices = allVoices.filter(
        (v) => v.lang.startsWith("en") || v.lang.startsWith("en-")
      );
      setVoices(englishVoices.length > 0 ? englishVoices : allVoices);
      if (englishVoices.length > 0 && !selectedVoice) {
        // Try to find a premium or natural sounding voice
        const GoogleVoice = englishVoices.find((v) => v.name.includes("Google"));
        const NaturalVoice = englishVoices.find((v) => v.name.includes("Natural"));
        setSelectedVoice((GoogleVoice || NaturalVoice || englishVoices[0]).name);
      } else if (allVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(allVoices[0].name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [selectedVoice]);

  // Load summary when sheet is opened or when active story changes
  useEffect(() => {
    if (isAISheetOpen && story) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
      setIsPaused(false);
      setSpeechProgress(0);
      setAiSummary(null);

      const loadSummary = async () => {
        setIsSummaryLoading(true);
        setSummaryError(null);
        try {
          const res = await fetchAISummary({
            data: {
              id: story.id,
              headline: story.headline,
              summary: story.summary,
              category: story.category,
            },
          });
          setAiSummary(res);
        } catch (err: any) {
          setSummaryError(err.message || "Failed to generate AI summary");
        } finally {
          setIsSummaryLoading(false);
        }
      };

      loadSummary();
    }
  }, [isAISheetOpen, index, story]);

  const speakText = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;

    if (selectedVoice) {
      const voice = voices.find((v) => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
    }

    utterance.rate = speechSpeed;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setSpeechProgress(0);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setSpeechProgress(100);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    const totalLength = text.length;
    utterance.onboundary = (event) => {
      if (event.name === "word") {
        const progress = (event.charIndex / totalLength) * 100;
        setSpeechProgress(Math.min(98, Math.round(progress)));
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const togglePlay = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isPlaying) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      let textToSpeak = "";
      if (speakMode === "summary") {
        textToSpeak = `Here is the AI summary. ${aiSummary?.bullets?.join(". ") || "Generating summary, please wait."}`;
      } else {
        textToSpeak = `Reading full headline. ${story?.headline}. ${story?.summary}. Source: ${story?.source || ""}`;
      }
      speakText(textToSpeak);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setSpeechProgress(0);
    }
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsAISheetOpen(open);
    if (!open) {
      stopSpeaking();
    }
  };

  const total = stories.length;
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;


  // ── Navigation ─────────────────────────────────────────────────────────────

  const go = (dir: 1 | -1) => {
    const next = index + dir;
    if (next < 0 || next >= total) return;
    setAnim(dir === 1 ? "out-up" : "out-down");
    window.setTimeout(() => {
      setIndex(next);
      setAnim("in");
    }, 220);
  };

  const onTouchStart = (e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    touchStartY.current = null;
    if (Math.abs(dy) < 50) return;
    go(dy > 0 ? 1 : -1);
  };
  const onWheel = (e: WheelEvent) => {
    if (wheelLock.current) return;
    if (Math.abs(e.deltaY) < 30) return;
    wheelLock.current = true;
    go(e.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => (wheelLock.current = false), 500);
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setIndex(0);
    setAnim("in");
  };

  const animClass =
    anim === "in"
      ? "translate-y-0 opacity-100"
      : anim === "out-up"
        ? "-translate-y-16 opacity-0"
        : "translate-y-16 opacity-0";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="phone-shell flex flex-col bg-surface">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pt-4 pb-2 bg-surface shrink-0">
        <button className="text-primary p-1" aria-label="Menu">
          <Menu size={22} strokeWidth={2.5} />
        </button>
        <h1 className="font-display font-extrabold text-2xl text-primary">
          newsvalla
        </h1>
        <button className="text-primary p-1" aria-label="Search">
          <Search size={22} strokeWidth={2.5} />
        </button>
      </header>

      {/* ── Category Pills ──────────────────────────────────────────────── */}
      <div
        ref={categoryRef}
        className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[12px] font-label font-semibold tracking-wide transition-all duration-200 ${
              category === cat.id
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                : "bg-surface-container text-muted-foreground hover:text-ink"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Progress Bar ────────────────────────────────────────────────── */}
      <div className="h-[3px] bg-border shrink-0">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Content Area ────────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        {isLoading ? (
          <LoadingSkeleton />
        ) : isError ? (
          <ErrorState
            message={error?.message ?? "Failed to load news"}
            onRetry={() => refetch()}
          />
        ) : total === 0 ? (
          <EmptyState onRetry={() => refetch()} />
        ) : story ? (
          <article
            key={`${story.id}-${index}`}
            className={`h-full flex flex-col transition-all duration-300 ease-out ${animClass}`}
          >
            {/* Image / Gradient Fallback */}
            <div className="relative shrink-0">
              {story.image ? (
                <img
                  src={story.image}
                  alt={story.headline}
                  className="w-full aspect-[4/3] object-cover"
                  onError={(e) => {
                    // If image fails to load, replace with gradient
                    const target = e.currentTarget;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      parent.style.background =
                        GRADIENTS[index % GRADIENTS.length];
                      parent.style.aspectRatio = "4/3";
                    }
                  }}
                />
              ) : (
                <div
                  className="w-full aspect-[4/3] flex items-center justify-center"
                  style={{
                    background: GRADIENTS[index % GRADIENTS.length],
                  }}
                >
                  <Newspaper
                    size={64}
                    strokeWidth={1}
                    className="text-white/30"
                  />
                </div>
              )}
              <span className="absolute bottom-3 left-4 bg-primary text-primary-foreground font-label text-[11px] tracking-widest px-3 py-1.5 rounded-sm">
                {story.category}
              </span>
            </div>

            {/* Content */}
            <div className="px-5 pt-5 pb-4 overflow-hidden flex-1 flex flex-col justify-between">
              <div>
                <h2 className="font-display font-extrabold text-[22px] leading-[1.2] text-ink">
                  {story.headline}
                </h2>
                <p className="mt-3 text-[15px] leading-[1.55] text-muted-foreground line-clamp-4">
                  {story.summary}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3.5 py-1.5 rounded-full transition-all duration-200"
                >
                  <BookOpen size={14} />
                  Read full story
                </a>
                <button
                  onClick={() => setIsAISheetOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:opacity-90 px-3.5 py-1.5 rounded-full transition-all duration-200 shadow-md shadow-fuchsia-500/25 cursor-pointer"
                >
                  <Sparkles size={14} className="animate-pulse" />
                  AI Summary & Listen
                </button>
              </div>

            </div>

            <div className="mx-5 border-t border-border shrink-0" />

            {/* Source + Actions */}
            <div className="px-5 py-3 flex items-end justify-between shrink-0">
              <div>
                <p className="font-label text-[12px] tracking-widest font-bold text-ink">
                  {story.source}
                </p>
                <p className="font-label text-[11px] text-muted-foreground mt-1">
                  {/* Timing metadata removed as requested */}
                </p>
              </div>
              <div className="flex items-center gap-4 text-primary">
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Read full article"
                  className="hover:text-primary/70 transition-colors"
                >
                  <ExternalLink size={20} strokeWidth={2} />
                </a>
                <button aria-label="Share">
                  <Share2 size={20} strokeWidth={2} />
                </button>
                <button aria-label="Bookmark">
                  <Bookmark size={20} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Bottom indicators */}
            <div className="flex-1 flex flex-col justify-end pb-4">
              <p className="text-center italic text-sm text-primary/80">
                {index < total - 1
                  ? "Swipe up for more coverage"
                  : "You're all caught up ✓"}
              </p>

              <div className="flex items-center justify-center gap-1.5 pt-3">
                {stories.slice(0, Math.min(total, 12)).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? "w-6 bg-primary" : "w-1.5 bg-border"
                    }`}
                    aria-label={`Go to story ${i + 1}`}
                  />
                ))}
                {total > 12 && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    +{total - 12}
                  </span>
                )}
              </div>
            </div>
          </article>
        ) : null}
      </div>

      {/* ── Bottom Nav ──────────────────────────────────────────────────── */}
      <nav className="border-t border-border bg-surface grid grid-cols-4 shrink-0">
        <NavItem icon={<Home size={22} />} label="Home" active />
        <NavItem icon={<Compass size={22} />} label="Discover" />
        <NavItem icon={<Bookmark size={22} />} label="Bookmarks" />
        <NavItem icon={<User size={22} />} label="Profile" />
      </nav>

      {/* ── AI News Assistant Bottom Sheet ──────────────────────────────── */}
      <Sheet open={isAISheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[80%] max-h-[640px] rounded-t-3xl border-t border-border bg-gradient-to-b from-background to-surface p-0 flex flex-col overflow-hidden max-w-[420px] mx-auto z-50"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-fuchsia-600 rounded-lg text-white">
                  <Sparkles size={18} className="animate-pulse" />
                </div>
                <SheetTitle className="text-xl font-display font-extrabold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent">
                  AI News Assistant
                </SheetTitle>
              </div>

              {/* Animated waveform visualizer when playing */}
              {isPlaying && !isPaused && (
                <div className="flex items-end gap-[3px] h-7 px-2">
                  <div className="audio-wave-bar" />
                  <div className="audio-wave-bar" />
                  <div className="audio-wave-bar" />
                  <div className="audio-wave-bar" />
                  <div className="audio-wave-bar" />
                  <div className="audio-wave-bar" />
                  <div className="audio-wave-bar" />
                </div>
              )}
            </div>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              AI text-to-speech audio reader & key takeaways
            </SheetDescription>
          </SheetHeader>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Mode selection + TTS Controls Card */}
            <div className="bg-surface-container/60 border border-border/80 rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <span className="text-xs font-semibold text-ink/80">Reading Mode</span>
                <div className="flex bg-surface border border-border p-0.5 rounded-lg">
                  <button
                    onClick={() => {
                      setSpeakMode("summary");
                      stopSpeaking();
                    }}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      speakMode === "summary"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    AI Summary
                  </button>
                  <button
                    onClick={() => {
                      setSpeakMode("article");
                      stopSpeaking();
                    }}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                      speakMode === "article"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    Full Story
                  </button>
                </div>
              </div>

              {/* TTS Controls */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4">
                  {/* Play / Pause button */}
                  <button
                    onClick={togglePlay}
                    disabled={speakMode === "summary" && isSummaryLoading}
                    className="h-12 w-12 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-md shadow-primary/25 disabled:opacity-50 cursor-pointer"
                  >
                    {isPlaying && !isPaused ? (
                      <Pause size={20} />
                    ) : (
                      <Play size={20} className="ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                      <span>
                        {isPlaying
                          ? isPaused
                            ? "Paused"
                            : "Reading aloud..."
                          : "Ready to play"}
                      </span>
                      <span>{Math.round(speechProgress)}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${speechProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stop button */}
                  {(isPlaying || isPaused) && (
                    <button
                      onClick={stopSpeaking}
                      className="h-9 w-9 flex items-center justify-center rounded-full border border-border bg-surface text-ink hover:bg-surface-container transition-all cursor-pointer"
                    >
                      <Square size={14} className="fill-ink" />
                    </button>
                  )}
                </div>

                {/* Speed & Voice select */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Speed options */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Speed
                    </span>
                    <div className="flex bg-surface border border-border p-0.5 rounded-lg justify-between">
                      {[1, 1.25, 1.5].map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setSpeechSpeed(s);
                            if (isPlaying && !isPaused) {
                              let textToSpeak = "";
                              if (speakMode === "summary") {
                                textToSpeak = `Here is the AI summary. ${aiSummary?.bullets?.join(". ") || ""}`;
                              } else {
                                textToSpeak = `Reading full headline. ${story?.headline}. ${story?.summary}.`;
                              }
                              speakText(textToSpeak);
                            }
                          }}
                          className={`flex-1 py-1 rounded text-[10px] font-bold cursor-pointer ${
                            speechSpeed === s
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice Options */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Voice
                    </span>
                    <select
                      value={selectedVoice || ""}
                      onChange={(e) => {
                        setSelectedVoice(e.target.value);
                        if (isPlaying && !isPaused) {
                          let textToSpeak = "";
                          if (speakMode === "summary") {
                            textToSpeak = `Here is the AI summary. ${aiSummary?.bullets?.join(". ") || ""}`;
                          } else {
                            textToSpeak = `Reading full headline. ${story?.headline}. ${story?.summary}.`;
                          }
                          setTimeout(() => speakText(textToSpeak), 50);
                        }
                      }}
                      className="w-full bg-surface border border-border px-2 py-1.5 rounded-lg text-[10px] font-medium text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {voices.slice(0, 8).map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name
                            .replace("Microsoft", "")
                            .replace("Google", "")
                            .replace("Desktop", "")
                            .trim()}
                        </option>
                      ))}
                      {voices.length === 0 && <option>Default voice</option>}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Bullet points Summary Container */}
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary" />
                Key Takeaways
              </h3>

              {isSummaryLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex gap-3 bg-surface-container/30 border border-border/50 rounded-xl p-3.5 animate-pulse"
                    >
                      <div className="w-5 h-5 rounded-full bg-surface-container shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-surface-container rounded-md w-[90%]" />
                        <div className="h-3.5 bg-surface-container rounded-md w-[60%]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : summaryError ? (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
                  <AlertCircle size={24} className="text-destructive mx-auto mb-2" />
                  <p className="text-xs text-destructive font-medium">{summaryError}</p>
                </div>
              ) : aiSummary ? (
                <div className="space-y-3">
                  {aiSummary.bullets.map((bullet, idx) => {
                    const iconColor =
                      idx === 0
                        ? "bg-violet-500/10 text-violet-600"
                        : idx === 1
                          ? "bg-fuchsia-500/10 text-fuchsia-600"
                          : "bg-pink-500/10 text-pink-600";
                    return (
                      <div
                        key={idx}
                        className="flex gap-3 bg-surface border border-border/60 hover:border-primary/30 transition-all rounded-xl p-3.5 shadow-sm group"
                      >
                        <div
                          className={`w-6 h-6 rounded-full ${iconColor} flex items-center justify-center shrink-0 mt-0.5 text-xs font-extrabold font-display`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-ink leading-relaxed">
                            {bullet}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}


// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="h-full flex flex-col animate-pulse">
      {/* Image skeleton */}
      <div className="w-full aspect-[4/3] bg-surface-container shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skeleton-shimmer" />
      </div>

      {/* Text skeletons */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        <div className="h-6 bg-surface-container rounded-md w-[90%]" />
        <div className="h-6 bg-surface-container rounded-md w-[70%]" />
        <div className="h-4 bg-surface-container rounded-md w-full mt-4" />
        <div className="h-4 bg-surface-container rounded-md w-[85%]" />
        <div className="h-4 bg-surface-container rounded-md w-[60%]" />
      </div>

      <div className="mx-5 border-t border-border" />

      <div className="px-5 py-3 flex justify-between">
        <div className="space-y-2">
          <div className="h-3 bg-surface-container rounded w-24" />
        </div>
        <div className="flex gap-4">
          <div className="w-5 h-5 bg-surface-container rounded-full" />
          <div className="w-5 h-5 bg-surface-container rounded-full" />
          <div className="w-5 h-5 bg-surface-container rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
        <AlertCircle size={32} className="text-primary" />
      </div>
      <h2 className="font-display font-bold text-xl text-ink">
        Couldn't load news
      </h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xs">
        {message}
      </p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 bg-primary text-primary-foreground font-label font-semibold text-sm px-5 py-2.5 rounded-md shadow-md shadow-primary/30 hover:bg-primary/90 transition-colors"
      >
        <RefreshCw size={16} />
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-5">
        <Newspaper size={32} className="text-muted-foreground" />
      </div>
      <h2 className="font-display font-bold text-xl text-ink">
        No stories found
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Try switching to a different category.
      </p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 bg-primary text-primary-foreground font-label font-semibold text-sm px-5 py-2.5 rounded-md shadow-md shadow-primary/30 hover:bg-primary/90 transition-colors"
      >
        <RefreshCw size={16} />
        Refresh
      </button>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`flex flex-col items-center gap-1 py-3 ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-[11px] font-label font-medium">{label}</span>
    </button>
  );
}
