import React, { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useListGeminiConversations, getListGeminiConversationsQueryKey } from "@/api-client-react";
import { useLocation } from "wouter";
import { Loader2, Download, Sparkles, Video, RefreshCw, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const DURATIONS = [
  { value: 5, label: "5 seconds" },
  { value: 8, label: "8 seconds" },
];

const RATIOS = [
  { value: "16:9", label: "16:9 Landscape" },
  { value: "9:16", label: "9:16 Portrait" },
];

const SUGGESTED = [
  "A majestic eagle soaring over snow-capped mountains at sunrise",
  "Timelapse of a city street from day to night with neon lights",
  "A rocket launch with flames and smoke billowing into the sky",
  "Waves crashing on a tropical beach with golden sunlight",
  "A butterfly emerging from its cocoon in a garden",
  "Northern lights dancing over a frozen lake at night",
];

interface GeneratedVideo {
  id: string;
  prompt: string;
  src: string;
  mimeType: string;
}

export default function VideoStudio() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [history, setHistory] = useState<GeneratedVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<GeneratedVideo | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: conversations = [] } = useListGeminiConversations();

  const startTimer = () => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleGenerate = async (customPrompt?: string) => {
    const base = (customPrompt ?? prompt).trim();
    if (!base) return;
    if (customPrompt) setPrompt(customPrompt);

    abortRef.current = new AbortController();
    setStatus("generating");
    setStatusMessage("Initializing video generation...");
    startTimer();

    try {
      const response = await fetch("/api/gemini/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: base, durationSeconds: duration, aspectRatio }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error("Failed to start video generation");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            setStatusMessage(data.message || "");

            if (data.status === "done" && data.videoBase64) {
              stopTimer();
              const src = `data:${data.mimeType || "video/mp4"};base64,${data.videoBase64}`;
              const item: GeneratedVideo = { id: Date.now().toString(), prompt: base, src, mimeType: data.mimeType || "video/mp4" };
              setHistory(prev => [item, ...prev]);
              setActiveVideo(item);
              setStatus("done");
            } else if (data.status === "error") {
              stopTimer();
              setStatus("error");
              setStatusMessage(data.message || "Video generation failed");
            }
          } catch {}
        }
      }
    } catch (err: any) {
      stopTimer();
      if (err.name !== "AbortError") {
        setStatus("error");
        setStatusMessage("Video generation failed. Please try again.");
      } else {
        setStatus("idle");
      }
    }
  };

  const handleDownload = (video: GeneratedVideo) => {
    const a = document.createElement("a");
    a.href = video.src;
    a.download = `video-${video.id}.mp4`;
    a.click();
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    stopTimer();
    setStatus("idle");
    setStatusMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && status !== "generating") {
      e.preventDefault();
      handleGenerate();
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Layout
      conversations={conversations}
      activeConversationId={undefined}
      onNewChat={() => setLocation("/")}
      onDeleteChat={async () => {
        queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
      }}
      isImageMode={false}
      onToggleImageMode={() => setLocation("/image-studio")}
    >
      <div className="flex flex-col h-full w-full max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex-shrink-0 h-16 flex items-center px-6 border-b border-border/10 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg">
            <Video className="w-5 h-5" />
            <span>Video Studio</span>
          </div>
          <Badge variant="secondary" className="ml-3 text-xs">Powered by Veo 2</Badge>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel */}
          <div className="flex flex-col w-full md:w-[420px] shrink-0 border-r border-border/20 p-6 gap-5 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt</label>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the video you want to create..."
                className="min-h-[100px] resize-none text-[15px] rounded-xl"
                disabled={status === "generating"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration</label>
                <div className="flex flex-col gap-1.5">
                  {DURATIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm border transition-all text-left",
                        duration === d.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Aspect Ratio</label>
                <div className="flex flex-col gap-1.5">
                  {RATIOS.map(r => (
                    <button
                      key={r.value}
                      onClick={() => setAspectRatio(r.value)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm border transition-all text-left",
                        aspectRatio === r.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50"
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {status === "generating" ? (
              <Button
                variant="destructive"
                onClick={handleCancel}
                className="w-full rounded-xl h-11"
              >
                Cancel Generation
              </Button>
            ) : (
              <Button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim()}
                className="w-full rounded-xl h-11 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 shadow-md"
              >
                <Video className="w-5 h-5 mr-2" />
                Generate Video
              </Button>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try these prompts</label>
              <div className="space-y-1.5">
                {SUGGESTED.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleGenerate(s)}
                    disabled={status === "generating"}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg border border-border/50 bg-card hover:bg-accent hover:border-accent transition-all text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Canvas */}
          <ScrollArea className="flex-1">
            <div className="p-6 flex flex-col gap-6 min-h-full">

              {/* Generating state */}
              {status === "generating" && (
                <div className="flex flex-col items-center justify-center h-72 gap-6 rounded-2xl border-2 border-dashed border-blue-400/40 bg-blue-500/5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-blue-200/30 border-t-blue-500 animate-spin" />
                    <Video className="absolute inset-0 m-auto w-8 h-8 text-blue-500" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium text-foreground">{statusMessage || "Generating..."}</p>
                    <p className="text-sm text-muted-foreground">Elapsed: {formatTime(elapsedSeconds)}</p>
                    <p className="text-xs text-muted-foreground">Video generation typically takes 2–4 minutes</p>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="w-2 h-8 rounded-full bg-blue-500/40 animate-pulse"
                        style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Error state */}
              {status === "error" && (
                <div className="flex flex-col items-center justify-center h-72 gap-4 rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive/5">
                  <p className="text-destructive font-medium text-center px-4">{statusMessage}</p>
                  <Button variant="outline" onClick={() => { setStatus("idle"); setStatusMessage(""); }}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              )}

              {/* Active video */}
              {status === "done" && activeVideo && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate max-w-[60%]">{activeVideo.prompt}</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleGenerate(activeVideo.prompt)}
                        title="Regenerate"
                        disabled={status === "generating"}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full"
                        onClick={() => handleDownload(activeVideo)}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-border/40 shadow-xl bg-black">
                    <video
                      src={activeVideo.src}
                      controls
                      autoPlay
                      loop
                      className="w-full h-auto max-h-[60vh]"
                    />
                  </div>
                </div>
              )}

              {/* Empty state */}
              {status === "idle" && !activeVideo && (
                <div className="flex flex-col items-center justify-center h-72 text-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-xl">
                    <Play className="w-10 h-10 text-white ml-1" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold gemini-gradient-text">Create a Video</h2>
                    <p className="text-muted-foreground mt-2 text-sm max-w-xs">
                      Describe a scene and Veo 2 will generate a short video clip for you.
                    </p>
                  </div>
                </div>
              )}

              {/* History */}
              {history.length > 1 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Previous Videos</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {history.slice(1).map(item => (
                      <div
                        key={item.id}
                        className="group relative rounded-xl overflow-hidden border border-border/40 bg-black cursor-pointer hover:border-primary/40 transition-all shadow-sm"
                        onClick={() => setActiveVideo(item)}
                      >
                        <video src={item.src} className="w-full h-36 object-cover" muted />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                          <p className="text-white text-xs line-clamp-2">{item.prompt}</p>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs rounded-full"
                            onClick={e => { e.stopPropagation(); handleDownload(item); }}
                          >
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </Layout>
  );
}
