"use client";

import { FormEvent, useRef, useState, useEffect } from "react";
import { Bot, ChevronDown, Loader2, Send, User, WifiOff } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolActivity?: string[];
  timestamp: Date;
};

type AgentHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const TOOL_LABELS: Record<string, string> = {
  getStoreMetrics: "Reviewed store metrics",
  getTopProducts: "Analyzed top products",
  getCustomerSegments: "Checked customer segments",
  getProductAffinity: "Analyzed product relationships",
  getRevenueTrends: "Reviewed revenue trends",
  getMerchantPolicy: "Checked merchant policy",
  getProducts: "Loaded product catalog",
  searchProducts: "Searched catalog",
  simulateOffer: "Simulated offer",
  checkGuardrails: "Checked guardrails",
  proposeCampaign: "Proposed campaign",
};

export function AgentConsole({ role }: { role: "MERCHANT" | "BUYER" }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(true);
  const [provider, setProvider] = useState("Groq agent");
  const [currentTools, setCurrentTools] = useState<string[]>([]);

  useEffect(() => {
    // Verify the agent is actually live before claiming so — don't optimistically
    // show "Groq agent" until a real health check confirms it.
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/ai/health");
        const data = await res.json() as { status: "online" | "offline"; model?: string };
        setOffline(data.status !== "online");
        if (data.status === "online" && data.model) setProvider(data.model);
      } catch {
        setOffline(true);
      } finally {
        setCheckingHealth(false);
      }
    };
    void checkHealth();
  }, []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, currentTools]);

  useEffect(() => {
    // Load conversation history from sessionStorage on mount
    const stored = sessionStorage.getItem(`conversation_${role}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as ChatMessage[];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMessages(parsed);
      } catch {
        // Ignore parse errors
      }
    }
  }, [role]);

  useEffect(() => {
    // Persist conversation to sessionStorage whenever it changes
    if (messages.length > 0) {
      sessionStorage.setItem(`conversation_${role}`, JSON.stringify(messages));
    }
  }, [messages, role]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || busy) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    setOffline(false);
    setCurrentTools([]);

    // Build history from prior messages (for LLM context)
    const history: AgentHistoryMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmed, role, history }),
      });
      const result = await response.json();

      if (!response.ok) {
        setOffline(result.error?.code === "AKUMA_AI_OFFLINE");
        const errorMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          role: "assistant",
          content: result.error?.message ?? "I couldn't complete that request. Please try again.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } else {
        if (result.provider === "deterministic-fallback") setProvider("Local safe fallback");
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now()}_res`,
          role: "assistant",
          content: result.content,
          toolActivity: result.toolActivity,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_net`,
        role: "assistant",
        content: "I can't reach the server right now. Please check your connection.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setBusy(false);
    setCurrentTools([]);
    inputRef.current?.focus();
  };

  return (
    <div className="agent-console">
      <div className="agent-console-head">
        <div>
          <p className="eyebrow">LIVE INTELLIGENCE</p>
          <h2>Ask AKUMA</h2>
        </div>
        <span className={offline ? "ai-status offline" : "ai-status"}>
          {checkingHealth ? (
            <>Checking AI status...</>
          ) : offline ? (
            <>
              <WifiOff size={12} /> AI offline
            </>
          ) : (
            <>
              <span className="ai-dot" /> {provider}
            </>
          )}
        </span>
      </div>

      <p className="agent-console-copy">
        {role === "MERCHANT"
          ? "Your business agent analyzes real data, finds opportunities, and proposes policy-bounded actions."
          : "Your shopping agent searches the catalog, compares products, and helps you find the best option."}
      </p>

      <div className="agent-chat-area" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="agent-empty">
            <Bot size={24} />
            <p>
              {role === "MERCHANT"
                ? 'Ask me about your business. Try "Analyze my store" or "What products sell best?"'
                : 'Tell me what you\'re looking for. Try "I need headphones under ₹5,000."'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble ${msg.role}`}>
            <span className="bubble-avatar">
              {msg.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </span>
            <div className="bubble-content">
              <div className="bubble-text">{msg.content}</div>
              {msg.toolActivity && msg.toolActivity.length > 0 && (
                <div className="tool-trace">
                  {msg.toolActivity.map((tool, i) => (
                    <span key={i} className="tool-step">
                      ✓ {TOOL_LABELS[tool] ?? tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <div className="chat-bubble assistant thinking">
            <span className="bubble-avatar">
              <Bot size={14} />
            </span>
            <div className="bubble-content">
              <div className="thinking-indicator">
                <Loader2 size={14} className="spin" />
                <span>Investigating...</span>
              </div>
              {currentTools.length > 0 && (
                <div className="tool-trace live">
                  {currentTools.map((tool, i) => (
                    <span key={i} className="tool-step">
                      ✓ {TOOL_LABELS[tool] ?? tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <form className="agent-form" onSubmit={submit}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={role === "MERCHANT" ? "Ask about your business..." : "What are you looking for?"}
          aria-label="Ask AKUMA"
          disabled={busy}
        />
        <button title="Send message" disabled={busy || !input.trim()}>
          <Send size={15} />
        </button>
      </form>

      {messages.length > 0 && (
        <div className="chat-scroll-hint" onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}>
          <ChevronDown size={14} /> Latest
        </div>
      )}
    </div>
  );
}
