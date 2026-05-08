import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Moon, Sun, Menu, MessageSquare, Plus, Trash2, Image as ImageIcon, Search, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { GeminiConversation, useUpdateGeminiConversation, getListGeminiConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface LayoutProps {
  children: React.ReactNode;
  conversations: GeminiConversation[];
  activeConversationId?: number;
  onNewChat: () => void;
  onDeleteChat: (id: number) => void;
  isImageMode: boolean;
  onToggleImageMode: () => void;
}

export function Layout({ 
  children, 
  conversations, 
  activeConversationId, 
  onNewChat, 
  onDeleteChat,
  isImageMode,
  onToggleImageMode
}: LayoutProps) {
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  
  const updateConversation = useUpdateGeminiConversation();
  const queryClient = useQueryClient();
  const editInputRef = useRef<HTMLInputElement>(null);

  const filteredConversations = conversations.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditStart = (id: number, title: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
  };

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleEditSave = async () => {
    if (editingId && editTitle.trim()) {
      await updateConversation.mutateAsync({ id: editingId, data: { title: editTitle.trim() } });
      queryClient.invalidateQueries({ queryKey: getListGeminiConversationsQueryKey() });
    }
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div 
        className={cn(
          "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out z-20",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <div className="p-4 flex items-center justify-between">
          <span className="font-semibold text-lg gemini-gradient-text px-2 whitespace-nowrap">Conversations</span>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="md:hidden shrink-0">
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="px-3 pb-3 flex gap-2">
          <Button onClick={onNewChat} className="flex-1 justify-start rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
          <Button 
            variant={location === "/image-studio" ? "default" : "outline"}
            size="icon" 
            className="rounded-full shrink-0" 
            onClick={() => setLocation(location === "/image-studio" ? "/" : "/image-studio")}
            title="Image Studio"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-background/50 border-sidebar-border/50 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 no-scrollbar">
          {filteredConversations.map((conv) => (
            <div 
              key={conv.id}
              className={cn(
                "group flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer",
                activeConversationId === conv.id && !isImageMode
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              {editingId === conv.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <Input
                    ref={editInputRef}
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSave();
                      if (e.key === 'Escape') handleEditCancel();
                    }}
                    onBlur={handleEditSave}
                    className="h-7 text-sm px-2 bg-background"
                  />
                </div>
              ) : (
                <Link href={`/chat/${conv.id}`} className="flex-1 flex items-center gap-3 truncate" onClick={() => { if(isImageMode) onToggleImageMode(); }}>
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate">{conv.title}</span>
                </Link>
              )}
              
              {editingId !== conv.id && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={(e) => handleEditStart(conv.id, conv.title, e)}
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            Toggle Theme
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="absolute top-4 left-4 z-10">
          {!sidebarOpen && (
            <Button variant="outline" size="icon" onClick={() => setSidebarOpen(true)} className="rounded-full shadow-sm bg-background/80 backdrop-blur-md">
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}