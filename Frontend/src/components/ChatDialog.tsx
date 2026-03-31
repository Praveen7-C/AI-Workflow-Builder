import React, { useState, useRef, useEffect } from "react";
import { SendHorizontal, X, User, Bot, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/auth";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface Source {
  id: number;
  source_file: string;
  page_number: number;
  excerpt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: Source[];
}

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
}

const ChatDialog = ({ open, onOpenChange, workflowId }: ChatDialogProps) => {
  const [inputMessage, setInputMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [chatHistory]);

  // Load chat history from backend when dialog opens
  useEffect(() => {
    if (!open || !workflowId) return;
    const loadHistory = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const resp = await fetch(`${BACKEND_URL}/api/chat-history/${workflowId}`, { headers });
        if (!resp.ok) return;
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          setChatHistory(
            data.map((d: any) => ({
              role: d.role === "user" ? "user" : "assistant",
              content: d.message,
              timestamp: d.timestamp,
              sources: [],
            }))
          );
        }
      } catch (e) {
        console.warn("Could not load chat history:", e);
      }
    };
    loadHistory();
  }, [open, workflowId]);

  const toggleCitation = (index: number) => {
    setExpandedCitations((prev) => {
      const n = new Set(prev);
      n.has(index) ? n.delete(index) : n.add(index);
      return n;
    });
  };

  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage) return;
    setIsLoading(true);
    setInputMessage("");

    const userMsg: ChatMessage = {
      role: "user",
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
      sources: [],
    };
    setChatHistory((prev) => [...prev, userMsg]);

    const conversationHistory = chatHistory.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

      const resp = await fetch(`${BACKEND_URL}/api/execute`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          user_query: trimmedMessage,
          workflow_id: workflowId,
          conversation_history: conversationHistory,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `Request failed (${resp.status})`);
      }

      const data = await resp.json();
      const assistantResponse = data.workflow_response?.final_response || "No response generated";
      const sources = data.workflow_response?.sources || [];

      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: assistantResponse, timestamp: new Date().toISOString(), sources },
      ]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${err.message || "Error calling AI. Try again."}`, timestamp: new Date().toISOString(), sources: [] },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const formatTimestamp = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const renderCitations = (sources: Source[]) => {
    if (!sources || sources.length === 0) return null;
    return (
      <div className="mt-3 border-t pt-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2"><span>Sources:</span></div>
        <div className="space-y-2">
          {sources.map((source, index) => (
            <div key={index} className="bg-muted/50 rounded-md overflow-hidden">
              <button onClick={() => toggleCitation(index)} className="w-full flex items-center justify-between p-2 text-left hover:bg-muted transition-colors">
                <span className="text-sm">
                  <span className="text-blue-600 font-medium">[{source.id}]</span>{" "}
                  <span className="text-foreground">{source.source_file}</span>
                  {source.page_number > 0 && <span className="text-muted-foreground"> - Page {source.page_number}</span>}
                </span>
                {expandedCitations.has(index) ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedCitations.has(index) && (
                <div className="px-3 pb-2 text-xs text-muted-foreground">
                  <div className="bg-background p-2 rounded border">{source.excerpt}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-2xl h-3/4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-muted rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-[10px] leading-none lowercase tracking-tighter">ai</span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Chat with Stack</h3>
              <p className="text-sm text-muted-foreground">AI Workflow Assistant</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="p-2 hover:bg-accent rounded-full transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <p className="font-medium">Chat with Stack</p>
              <p className="text-sm text-muted-foreground">Send a message to test your workflow</p>
            </div>
          ) : (
            <>
              {chatHistory.map((msg, index) => (
                <div key={index} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] px-4 py-2 rounded-lg ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.sources && msg.sources.length > 0 && renderCitations(msg.sources)}
                    <p className={`text-xs mt-1 ${msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatTimestamp(msg.timestamp)}
                    </p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                      <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t bg-muted">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Send a message..."
              className="flex-1 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-background text-foreground"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <SendHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatDialog;
