import React, { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListGeminiConversations, 
  useCreateGeminiConversation, 
  useGetGeminiConversation,
  useDeleteGeminiConversation,
  useGenerateGeminiImage,
  getGetGeminiConversationQueryKey,
  getListGeminiConversationsQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Image as ImageIcon, Sparkles, Loader2, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: number | string;
  role: "user" | "assistant";
  content: string;
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
  
  const { data: conversations = [] } = useListGeminiConversations();
  const createConversation = useCreateGeminiConversation();
  const deleteConversation = useDeleteGeminiConversation();
  const generateImage = useGenerateGeminiImage();
  
  const { data: activeConversation, isLoading: isLoadingChat } = useGetGeminiConversation(
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

  // Sync server messages to local state
  useEffect(() => {
    if (activeConversation?.messages) {
      setLocalMessages(activeConversation.messages);
    } else {
      setLocalMessages([]);
    }
  }, [activeConversation]);

  // Scroll to bottom
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
    setLocation("/");
  };

  const handleDeleteChat = async (id: number) => {
    await deleteConversation.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
    if (id === conversationId) {
      setLocation("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || generateImage.isPending) return;

    const userMessage = input.trim();
    setInput("");

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

    if (!targetId) {
      // Create new conversation
      const newConv = await createConversation.mutateAsync({ data: { title: userMessage.slice(0, 50) } });
      targetId = newConv.id;
      queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
      setLocation(`/chat/${targetId}`);
      // Don't return here, continue to send the first message
    }

    // Optimistically add user message
    const tempUserId = Date.now().toString();
    setLocalMessages(prev => [...prev, { id: tempUserId, role: "user", content: userMessage }]);
    setIsStreaming(true);
    setStreamedContent("");

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/gemini/conversations/${targetId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage }),
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
              if (data.done) {
                break;
              }
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

      // Once done, invalidate the conversation to get the real messages from DB
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
        
        {/* Header / Mode Indicator */}
        <div className="flex-shrink-0 h-16 flex items-center justify-center border-b border-border/10 bg-background/50 backdrop-blur-sm z-10">
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

        {/* Chat Area */}
        <ScrollArea className="flex-1 p-4 md:p-8">
          <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-8">
            
            {!isImageMode && !conversationId && localMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-xl">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold gemini-gradient-text tracking-tight">How can I help you today?</h1>
                <p className="text-muted-foreground max-w-md">
                  I can answer questions, help you write, or explore ideas together.
                </p>
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
                  "flex gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
              >
                {msg.role === "assistant" && (
                  <Avatar className="w-8 h-8 border border-primary/20 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Sparkles className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div 
                  className={cn(
                    "px-5 py-3.5 rounded-2xl max-w-[85%] text-[15px] leading-relaxed shadow-sm",
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground rounded-br-sm" 
                      : "bg-card border border-border/50 rounded-bl-sm"
                  )}
                >
                  {msg.role === "user" ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                      {msg.content}
                    </div>
                  )}
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
                      {streamedContent}
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
            <div className="relative flex items-end rounded-3xl bg-card border-2 border-input focus-within:border-primary transition-colors shadow-sm overflow-hidden">
              <Textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isImageMode ? "Describe the image you want to generate..." : "Ask anything..."}
                className="min-h-[56px] max-h-[200px] w-full resize-none border-0 focus-visible:ring-0 rounded-none bg-transparent py-4 px-5 no-scrollbar text-[15px]"
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
                      input.trim() ? "bg-primary text-primary-foreground hover:scale-105" : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                    )}
                    disabled={!input.trim() || generateImage.isPending}
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
