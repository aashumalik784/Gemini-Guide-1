import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListGeminiConversations, 
  useCreateGeminiConversation, 
  useGetGeminiConversation,
  useDeleteGeminiConversation,
  useGenerateGeminiImage,
  useListGeminiModels,
  useAutoTitleGeminiConversation,
  getGetGeminiConversationQueryKey,
  getListGeminiConversationsQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Send, Image as ImageIcon, Sparkles, Loader2, StopCircle, 
  Paperclip, Copy, Check, RefreshCw, Wand2, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface ChatMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  imageData?: string | null;
  imageMimeType?: string | null;
}

const PERSONAS = [
  { id: "default", name: "Default Assistant", prompt: "" },
  { id: "coder", name: "Expert Coder", prompt: "You are an expert software engineer. Provide precise, efficient code with explanations." },
  { id: "writer", name: "Creative Writer", prompt: "You are a creative writer. Use vivid language, metaphors, and engaging storytelling." },
  { id: "analyst", name: "Research Analyst", prompt: "You are a research analyst. Provide thorough, balanced analysis with sources where possible." },
  { id: "teacher", name: "Language Teacher", prompt: "You are a patient language teacher. Explain grammar, vocabulary, and provide examples." },
  { id: "data", name: "Data Scientist", prompt: "You are a data scientist. Help with statistics, ML concepts, and data analysis." },
];

const SUGGESTED_PROMPTS = [
  "Explain quantum computing in simple terms",
  "Write a Python function to sort a list",
  "What are the best practices for React in 2025?",
  "Create a short story about an AI discovering emotions"
];

function CodeBlock({ node, inline, className, children, ...props }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";

  const onCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="rounded-md overflow-hidden my-4 border border-border/50">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/80 text-muted-foreground text-xs">
          <span className="font-mono">{language}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopy}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <div className="p-4 bg-zinc-950 text-zinc-50 overflow-x-auto text-sm">
          <code className={className} {...props}>
            {children}
          </code>
        </div>
      </div>
    );
  }
  return (
    <code className="bg-muted/50 rounded px-1.5 py-0.5 text-sm font-mono" {...props}>
      {children}
    </code>
  );
}

export default function ChatPage() {
  const [location, setLocation] = useLocation();
  const params = useParams();
  const idStr = params.id;
  const conversationId = idStr ? parseInt(idStr, 10) : undefined;
  
  const queryClient = useQueryClient();
  const [isImageMode, setIsImageMode] = useState(false);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [uploadImage, setUploadImage] = useState<{ data: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [] } = useListGeminiConversations();
  const { data: models = [] } = useListGeminiModels();
  const createConversation = useCreateGeminiConversation();
  const deleteConversation = useDeleteGeminiConversation();
  const generateImage = useGenerateGeminiImage();
  const autoTitle = useAutoTitleGeminiConversation();
  
  const { data: activeConversation } = useGetGeminiConversation(
    conversationId as number, 
    { 
      query: { 
        enabled: !!conversationId && !isImageMode, 
        queryKey: getGetGeminiConversationQueryKey(conversationId as number) 
      } 
    }
  );

  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | number | null>(null);

  // Sync server messages to local state
  useEffect(() => {
    if (activeConversation?.messages) {
      setLocalMessages(activeConversation.messages);
    } else {
      setLocalMessages([]);
    }
  }, [activeConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, streamedContent, generatedImage]);

  const handleNewChat = () => {
    setIsImageMode(false);
    setGeneratedImage(null);
    setInput("");
    setUploadImage(null);
    setLocation("/");
  };

  const handleDeleteChat = async (id: number) => {
    await deleteConversation.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
    if (id === conversationId) {
      setLocation("/");
    }
  };

  const handleCopyMessage = (id: string | number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      const base64Data = base64Url.split(",")[1];
      setUploadImage({ data: base64Data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendPrompt = async (userMessage: string, modelToUse: string = selectedModel) => {
    if (isImageMode) {
      setGeneratedImage(null);
      try {
        const res = await generateImage.mutateAsync({ data: { prompt: userMessage } });
        setGeneratedImage(`data:${res.mimeType};base64,${res.b64_json}`);
      } catch (error) {
        console.error("Image generation failed:", error);
      }
      return;
    }

    let targetId = conversationId;
    let isFirstMessage = false;

    if (!targetId) {
      isFirstMessage = true;
      const newConv = await createConversation.mutateAsync({ data: { title: "New Conversation" } });
      targetId = newConv.id;
      queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
      setLocation(`/chat/${targetId}`);
    } else {
      isFirstMessage = localMessages.length === 0;
    }

    const tempUserId = Date.now().toString();
    const newUserMsg: ChatMessage = { 
      id: tempUserId, 
      role: "user", 
      content: userMessage,
      imageData: uploadImage?.data,
      imageMimeType: uploadImage?.mimeType
    };
    
    setLocalMessages(prev => [...prev, newUserMsg]);
    setIsStreaming(true);
    setStreamedContent("");

    const currentUpload = uploadImage;
    setUploadImage(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/gemini/conversations/${targetId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          content: userMessage,
          model: modelToUse,
          systemPrompt: selectedPersona.prompt || undefined,
          imageData: currentUpload?.data,
          imageMimeType: currentUpload?.mimeType
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error("Failed to send message");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (!dataStr) continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.done) break;
              if (data.content) {
                fullContent += data.content;
                setStreamedContent(fullContent);
              }
            } catch (err) {
              console.error("Error parsing SSE data", err);
            }
          }
        }
      }

      if (isFirstMessage) {
        await autoTitle.mutateAsync({ id: targetId });
      }

      queryClient.invalidateQueries({ queryKey: getGetGeminiConversationQueryKey(targetId) });
      queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });

    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Chat error:", error);
      }
    } finally {
      setIsStreaming(false);
      setStreamedContent("");
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || generateImage.isPending) return;
    const msg = input.trim();
    setInput("");
    sendPrompt(msg);
  };

  const handleRegenerate = async () => {
    if (localMessages.length < 2 || isStreaming) return;
    
    // Find last user message
    let lastUserMsgIndex = -1;
    for (let i = localMessages.length - 1; i >= 0; i--) {
      if (localMessages[i].role === "user") {
        lastUserMsgIndex = i;
        break;
      }
    }

    if (lastUserMsgIndex === -1) return;
    
    const lastUserMsg = localMessages[lastUserMsgIndex];
    
    // Optimistically remove everything after the user message
    setLocalMessages(prev => prev.slice(0, lastUserMsgIndex));
    
    // Re-send
    sendPrompt(lastUserMsg.content);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const currentModelObj = models.find(m => m.id === selectedModel);

  return (
    <Layout 
      conversations={conversations} 
      activeConversationId={conversationId} 
      onNewChat={handleNewChat}
      onDeleteChat={handleDeleteChat}
      isImageMode={isImageMode}
      onToggleImageMode={() => {
        setIsImageMode(true);
        setLocation("/");
      }}
    >
      <div className="flex flex-col h-full w-full max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex-shrink-0 h-16 flex items-center justify-between px-4 border-b border-border/10 bg-background/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2">
            {isImageMode ? (
              <div className="flex items-center text-primary gap-2 font-medium">
                <Sparkles className="w-5 h-5" />
                <span>Image Studio</span>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm font-medium">
                {activeConversation?.title || "New Chat"}
              </div>
            )}
          </div>
          
          {/* Top Controls */}
          {!isImageMode && (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-full">
                    {currentModelObj?.name || "Select Model"}
                    {currentModelObj?.badge && <Badge variant="secondary" className="ml-2 px-1 text-[10px]">{currentModelObj.badge}</Badge>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>AI Models</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {models.map(model => (
                    <DropdownMenuItem 
                      key={model.id} 
                      onClick={() => setSelectedModel(model.id)}
                      className={cn("flex flex-col items-start p-2", selectedModel === model.id && "bg-accent")}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{model.name}</span>
                        {model.badge && <Badge variant="secondary" className="px-1 text-[10px]">{model.badge}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">{model.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 rounded-full">
                    <Wand2 className="w-3.5 h-3.5 mr-2 text-primary" />
                    {selectedPersona.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Persona</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PERSONAS.map(p => (
                    <DropdownMenuItem 
                      key={p.id} 
                      onClick={() => setSelectedPersona(p)}
                      className={cn(selectedPersona.id === p.id && "bg-accent font-medium")}
                    >
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Chat Area */}
        <ScrollArea className="flex-1 p-4 md:p-8">
          <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-8">
            
            {!isImageMode && !conversationId && localMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-xl">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h1 className="text-4xl font-bold gemini-gradient-text tracking-tight">How can I help you today?</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(prompt)}
                      className="p-4 rounded-xl border border-border/50 bg-card hover:bg-accent hover:border-accent transition-all text-left text-sm text-card-foreground shadow-sm flex flex-col justify-between h-full"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isImageMode && !generatedImage && !generateImage.isPending && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-xl">
                  <ImageIcon className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold gemini-gradient-text tracking-tight">Create an Image</h1>
                <p className="text-muted-foreground max-w-md">
                  Describe what you want to see, and I will generate it for you.
                </p>
              </div>
            )}

            {isImageMode && generateImage.isPending && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Generating your masterpiece...</p>
              </div>
            )}

            {isImageMode && generatedImage && (
              <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-xl overflow-hidden border shadow-2xl bg-card">
                  <img src={generatedImage} alt="Generated result" className="max-w-full h-auto max-h-[60vh] object-contain" />
                </div>
                <p className="text-sm text-muted-foreground bg-muted px-4 py-2 rounded-full">
                  Image generated successfully
                </p>
              </div>
            )}

            {!isImageMode && localMessages.map((msg, index) => (
              <div 
                key={msg.id} 
                className={cn(
                  "group flex gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <Avatar className="w-8 h-8 border border-primary/20 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Sparkles className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className={cn("flex flex-col gap-1 max-w-[85%]", msg.role === "user" ? "items-end" : "items-start")}>
                  <div 
                    className={cn(
                      "px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm w-full",
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-br-sm" 
                        : "bg-card border border-border/50 rounded-bl-sm"
                    )}
                  >
                    {msg.imageData && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-white/20 inline-block max-w-[200px]">
                        <img 
                          src={`data:${msg.imageMimeType};base64,${msg.imageData}`} 
                          alt="Uploaded" 
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    )}
                    
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none break-words">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{ code: CodeBlock }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  
                  {/* Message Actions */}
                  <div className={cn("flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity", msg.role === "user" && "flex-row-reverse")}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyMessage(msg.id, msg.content)}
                      title="Copy text"
                    >
                      {copiedMessageId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    {msg.role === "assistant" && index === localMessages.length - 1 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={handleRegenerate}
                        title="Regenerate response"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {msg.role === "user" && (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-4 w-full justify-start animate-in fade-in slide-in-from-bottom-2">
                <Avatar className="w-8 h-8 border border-primary/20 shrink-0 gemini-thinking">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Sparkles className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="px-5 py-3.5 rounded-2xl max-w-[85%] text-[15px] leading-relaxed shadow-sm bg-card border border-border/50 rounded-bl-sm">
                  {streamedContent ? (
                    <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{ code: CodeBlock }}
                      >
                        {streamedContent}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 h-6">
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                      <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="flex-shrink-0 p-4 bg-background/80 backdrop-blur-md border-t border-border/40">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative group">
            
            {/* Image Upload Preview */}
            {uploadImage && (
              <div className="absolute -top-16 left-4 border bg-card p-1 rounded-lg shadow-sm animate-in fade-in slide-in-from-bottom-2 z-10 flex items-start gap-1">
                <img 
                  src={`data:${uploadImage.mimeType};base64,${uploadImage.data}`} 
                  alt="Upload preview" 
                  className="w-12 h-12 object-cover rounded-md"
                />
                <button 
                  type="button" 
                  onClick={() => setUploadImage(null)}
                  className="bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="relative flex items-end rounded-3xl bg-card border-2 border-input focus-within:border-primary transition-colors shadow-sm overflow-visible">
              
              {!isImageMode && (
                <div className="p-2 shrink-0">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full w-10 h-10 text-muted-foreground hover:text-foreground"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach image"
                  >
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </div>
              )}
              
              <Textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isImageMode ? "Describe the image you want to generate..." : "Ask anything..."}
                className="min-h-[56px] max-h-[200px] w-full resize-none border-0 focus-visible:ring-0 rounded-none bg-transparent py-4 px-3 no-scrollbar text-[15px]"
                rows={1}
                disabled={generateImage.isPending}
              />
              
              <div className="p-2 shrink-0">
                {isStreaming ? (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon" 
                    className="rounded-full w-10 h-10 shadow-md"
                    onClick={handleStop}
                  >
                    <StopCircle className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    size="icon" 
                    className={cn(
                      "rounded-full w-10 h-10 shadow-md transition-all duration-300",
                      input.trim() || uploadImage ? "bg-primary text-primary-foreground hover:scale-105" : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                    )}
                    disabled={(!input.trim() && !uploadImage) || generateImage.isPending}
                  >
                    {generateImage.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 ml-0.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="text-center mt-2 text-xs text-muted-foreground">
              AI can make mistakes. Consider verifying important information.
            </div>
          </form>
        </div>

      </div>
    </Layout>
  );
}