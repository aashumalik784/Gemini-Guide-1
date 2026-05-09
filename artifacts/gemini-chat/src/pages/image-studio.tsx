import React, { useState, useRef } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  useListGeminiConversations,
  useGenerateGeminiImage,
} from "@/api-client-react";
import { useLocation } from "wouter";
import {
  Loader2,
  Download,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
  Wand2,
  Copy,
  Check,
  UserCircle2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { getListGeminiConversationsQueryKey } from "@/api-client-react";

const STYLES = [
  { id: "none", label: "None", suffix: "" },
  { id: "photorealistic", label: "Photorealistic", suffix: ", photorealistic, 8K, professional photography" },
  { id: "digital-art", label: "Digital Art", suffix: ", digital art, vibrant colors, detailed illustration" },
  { id: "watercolor", label: "Watercolor", suffix: ", watercolor painting, soft brushstrokes, artistic" },
  { id: "anime", label: "Anime", suffix: ", anime style, Studio Ghibli, detailed" },
  { id: "oil-painting", label: "Oil Painting", suffix: ", oil painting, classical art, textured canvas" },
  { id: "3d-render", label: "3D Render", suffix: ", 3D render, Blender, ray tracing, studio lighting" },
  { id: "sketch", label: "Pencil Sketch", suffix: ", pencil sketch, detailed line art, black and white" },
  { id: "cinematic", label: "Cinematic", suffix: ", cinematic, movie still, dramatic lighting, film grain" },
];

const SUGGESTED = [
  "A futuristic city at sunset with flying cars",
  "A serene mountain lake surrounded by autumn trees",
  "A cute robot reading a book in a cozy library",
  "An astronaut exploring an alien jungle planet",
  "A magical forest with glowing mushrooms at night",
  "A detailed portrait of a wise old wizard",
];

interface GeneratedItem {
  id: string;
  prompt: string;
  style: string;
  src: string;
}

type Tab = "generate" | "faceswap";

function UploadBox({
  label,
  image,
  onUpload,
  onClear,
}: {
  label: string;
  image: { data: string; mimeType: string } | null;
  onUpload: (img: { data: string; mimeType: string }) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const b64url = ev.target?.result as string;
      onUpload({ data: b64url.split(",")[1], mimeType: file.type });
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {image ? (
        <div className="relative rounded-xl overflow-hidden border border-border/50 bg-card">
          <img
            src={`data:${image.mimeType};base64,${image.data}`}
            alt={label}
            className="w-full h-40 object-cover"
          />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full h-40 rounded-xl border-2 border-dashed border-border/60 bg-card hover:bg-accent hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Upload className="w-8 h-8" />
          <span className="text-sm">Click to upload</span>
          <span className="text-xs">PNG, JPG, WEBP</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

export default function ImageStudio() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("generate");

  // Image generation state
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [history, setHistory] = useState<GeneratedItem[]>([]);
  const [activeItem, setActiveItem] = useState<GeneratedItem | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Face swap state
  const [sourceImage, setSourceImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [targetImage, setTargetImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [swapResult, setSwapResult] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  const { data: conversations = [] } = useListGeminiConversations();
  const generateImage = useGenerateGeminiImage();

  // --- Image Generation ---
  const handleGenerate = async (customPrompt?: string) => {
    const base = (customPrompt ?? prompt).trim();
    if (!base) return;

    const fullPrompt = base + selectedStyle.suffix;
    try {
      const res = await generateImage.mutateAsync({ data: { prompt: fullPrompt } });
      const src = `data:${res.mimeType};base64,${res.b64_json}`;
      const item: GeneratedItem = { id: Date.now().toString(), prompt: base, style: selectedStyle.label, src };
      setHistory(prev => [item, ...prev]);
      setActiveItem(item);
      if (customPrompt) setPrompt(customPrompt);
    } catch {}
  };

  const handleDownload = (src: string, id: string) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = `image-${id}.png`;
    a.click();
  };

  const handleCopyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !generateImage.isPending) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // --- Face Swap ---
  const handleFaceSwap = async () => {
    if (!sourceImage || !targetImage) return;
    setIsSwapping(true);
    setSwapError(null);
    setSwapResult(null);

    try {
      const response = await fetch("/api/gemini/face-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImage, targetImage }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Face swap failed");
      }

      const data = await response.json();
      setSwapResult(`data:${data.mimeType};base64,${data.b64_json}`);
    } catch (err: any) {
      setSwapError(err.message || "Face swap failed. Please try again.");
    } finally {
      setIsSwapping(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "generate", label: "Image Generation", icon: <ImageIcon className="w-4 h-4" /> },
    { id: "faceswap", label: "Face Swap", icon: <UserCircle2 className="w-4 h-4" /> },
  ];

  return (
    <Layout
      conversations={conversations}
      activeConversationId={undefined}
      onNewChat={() => setLocation("/")}
      onDeleteChat={async () => {
        queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
      }}
      isImageMode={true}
      onToggleImageMode={() => setLocation("/")}
    >
      <div className="flex flex-col h-full w-full max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex-shrink-0 h-16 flex items-center px-6 border-b border-border/10 bg-background/50 backdrop-blur-sm gap-4">
          <div className="flex items-center gap-2 text-primary font-semibold text-lg">
            <Wand2 className="w-5 h-5" />
            <span>Image Studio</span>
          </div>
          <Badge variant="secondary" className="text-xs">Powered by Gemini</Badge>

          {/* Tabs */}
          <div className="ml-auto flex gap-1 p-1 rounded-xl bg-muted">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ========= IMAGE GENERATION TAB ========= */}
        {activeTab === "generate" && (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-col w-full md:w-[420px] shrink-0 border-r border-border/20 p-6 gap-5 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-medium">Prompt</label>
                <Textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe what you want to create..."
                  className="min-h-[100px] resize-none text-[15px] rounded-xl"
                  disabled={generateImage.isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Style</label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStyle(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        selectedStyle.id === s.id
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || generateImage.isPending}
                className="w-full rounded-xl h-11 text-base font-semibold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 shadow-md"
              >
                {generateImage.isPending ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
                ) : (
                  <><Sparkles className="w-5 h-5 mr-2" />Generate Image</>
                )}
              </Button>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try these prompts</label>
                <div className="space-y-1.5">
                  {SUGGESTED.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleGenerate(s)}
                      disabled={generateImage.isPending}
                      className="w-full text-left text-sm px-3 py-2 rounded-lg border border-border/50 bg-card hover:bg-accent hover:border-accent transition-all text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 flex flex-col gap-8">
                {generateImage.isPending && (
                  <div className="flex flex-col items-center justify-center h-72 gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 animate-pulse">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">Creating your image...</p>
                  </div>
                )}

                {activeItem && !generateImage.isPending && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate max-w-[70%]">{activeItem.prompt}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{activeItem.style}</Badge>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyPrompt(activeItem.prompt)}>
                          {copiedPrompt ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGenerate(activeItem.prompt)} disabled={generateImage.isPending}>
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => handleDownload(activeItem.src, activeItem.id)}>
                          <Download className="w-3.5 h-3.5 mr-1.5" />Download
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-border/40 shadow-xl bg-card">
                      <img src={activeItem.src} alt={activeItem.prompt} className="w-full h-auto object-cover" />
                    </div>
                  </div>
                )}

                {!activeItem && !generateImage.isPending && (
                  <div className="flex flex-col items-center justify-center h-72 text-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
                      <ImageIcon className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold gemini-gradient-text">Create an Image</h2>
                      <p className="text-muted-foreground mt-2 text-sm max-w-xs">Write a description, choose a style, and hit Generate.</p>
                    </div>
                  </div>
                )}

                {history.length > 1 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Previous Generations</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {history.slice(1).map(item => (
                        <div
                          key={item.id}
                          className="group relative rounded-xl overflow-hidden border border-border/40 bg-card cursor-pointer hover:border-primary/40 transition-all shadow-sm"
                          onClick={() => setActiveItem(item)}
                        >
                          <img src={item.src} alt={item.prompt} className="w-full h-40 object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 gap-2">
                            <p className="text-white text-xs line-clamp-2">{item.prompt}</p>
                            <Button size="sm" variant="secondary" className="h-7 text-xs rounded-full" onClick={e => { e.stopPropagation(); handleDownload(item.src, item.id); }}>
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
        )}

        {/* ========= FACE SWAP TAB ========= */}
        {activeTab === "faceswap" && (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-col w-full md:w-[420px] shrink-0 border-r border-border/20 p-6 gap-5 overflow-y-auto">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">How it works</h3>
                <p className="text-xs text-muted-foreground">Upload a source image (the face you want to use) and a target image (the body/scene). AI will swap the face and generate a new combined image.</p>
              </div>

              <UploadBox
                label="Source Image (Face)"
                image={sourceImage}
                onUpload={setSourceImage}
                onClear={() => setSourceImage(null)}
              />

              <UploadBox
                label="Target Image (Body / Scene)"
                image={targetImage}
                onUpload={setTargetImage}
                onClear={() => setTargetImage(null)}
              />

              <Button
                onClick={handleFaceSwap}
                disabled={!sourceImage || !targetImage || isSwapping}
                className="w-full rounded-xl h-11 text-base font-semibold bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90 shadow-md"
              >
                {isSwapping ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Swapping Faces...</>
                ) : (
                  <><UserCircle2 className="w-5 h-5 mr-2" />Swap Faces</>
                )}
              </Button>

              {swapError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                  {swapError}
                </div>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 flex flex-col gap-6 min-h-full">
                {isSwapping && (
                  <div className="flex flex-col items-center justify-center h-72 gap-4 rounded-2xl border-2 border-dashed border-pink-400/30 bg-pink-500/5 animate-pulse">
                    <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
                    <p className="text-muted-foreground font-medium">Generating face swap...</p>
                    <p className="text-xs text-muted-foreground">This may take 10–30 seconds</p>
                  </div>
                )}

                {swapResult && !isSwapping && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">Face Swap Result</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full"
                        onClick={() => handleDownload(swapResult, "faceswap-" + Date.now())}
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />Download
                      </Button>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-border/40 shadow-xl bg-card">
                      <img src={swapResult} alt="Face swap result" className="w-full h-auto object-cover" />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => { setSwapResult(null); setSourceImage(null); setTargetImage(null); }}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />Try Another Swap
                    </Button>
                  </div>
                )}

                {!swapResult && !isSwapping && (
                  <div className="flex flex-col items-center justify-center h-72 text-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-xl">
                      <UserCircle2 className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold gemini-gradient-text">Face Swap</h2>
                      <p className="text-muted-foreground mt-2 text-sm max-w-xs">
                        Upload two images on the left and AI will swap the face for you.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </Layout>
  );
}
