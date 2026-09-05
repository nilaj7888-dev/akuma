"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Send, MessageSquare, Check, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Message = {
  role: "CUSTOMER" | "MERCHANT" | "AI";
  content: string;
  timestamp: string;
  suggestedPrice?: number;
};

type Negotiation = {
  id: string;
  productId: string;
  quantity: number;
  originalPrice: number;
  requestedPrice?: number;
  approvedPrice?: number;
  status: string;
  product?: { name: string; price: number };
  merchant?: { name: string };
};

export default function NegotiationChatPage() {
  const params = useParams();
  const router = useRouter();
  const negotiationId = params?.id as string;

  const [negotiation, setNegotiation] = useState<Negotiation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [userRole, setUserRole] = useState<"CUSTOMER" | "MERCHANT" | null>(
    null
  );
  const [customerAccepted, setCustomerAccepted] = useState(false);
  const [merchantAccepted, setMerchantAccepted] = useState(false);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);

  const fetchNegotiation = async () => {
    try {
      const res = await fetch(`/api/negotiation/${negotiationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setNegotiation(data.negotiation);
        setUserRole(data.userRole);
        setMessages(data.messages || []);

        // Find latest suggested price
        const latestSuggestion = [...(data.messages || [])]
          .reverse()
          .find((m: Message) => m.suggestedPrice);
        if (latestSuggestion) {
          setSuggestedPrice(latestSuggestion.suggestedPrice);
        }
      }
    } catch (error) {
      console.error("Failed to fetch negotiation:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!negotiationId) return;
    fetchNegotiation();
    const interval = setInterval(fetchNegotiation, 2000);
    return () => clearInterval(interval);
  }, [negotiationId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || sending || !negotiationId) return;

    setSending(true);
    const messageContent = inputValue;
    setInputValue("");

    try {
      const res = await fetch(
        `/api/negotiation/${negotiationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: messageContent }),
        }
      );

      if (res.ok) {
        await fetchNegotiation();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleAcceptPrice = async () => {
    if (!suggestedPrice || !negotiationId) return;

    try {
      const res = await fetch(`/api/negotiation/${negotiationId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestedPrice,
          role: userRole,
        }),
      });

      if (res.ok) {
        if (userRole === "CUSTOMER") {
          setCustomerAccepted(true);
        } else {
          setMerchantAccepted(true);
        }
        await fetchNegotiation();
      }
    } catch (error) {
      console.error("Failed to accept price:", error);
    }
  };

  if (loading) {
    return (
      <section className="content">
        <p style={{ textAlign: "center", padding: "40px" }}>
          Loading negotiation...
        </p>
      </section>
    );
  }

  if (!negotiation) {
    return (
      <section className="content">
        <p style={{ textAlign: "center", padding: "40px" }}>
          Negotiation not found
        </p>
      </section>
    );
  }

  const isDealboth =
    negotiation.status === "APPROVED" || (customerAccepted && merchantAccepted);
  const listPrice = negotiation.originalPrice / 100;
  const canAccept = suggestedPrice && !isDealboth;

  return (
    <section className="content">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <Link href={userRole === "MERCHANT" ? "/dashboard/negotiations" : "/shop/cart"}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "none",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
        </Link>
        <h1 style={{ margin: "0" }}>Price Negotiation</h1>
        <div style={{ width: "60px" }} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "24px",
          height: "calc(100vh - 200px)",
        }}
      >
        {/* Chat Area */}
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {messages.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 20px",
                  color: "var(--muted)",
                }}
              >
                <MessageSquare size={48} style={{ margin: "0 auto 16px" }} />
                <p>Start the negotiation by entering a price offer</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent:
                    msg.role === "CUSTOMER" ? "flex-end" : "flex-start",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background:
                      msg.role === "CUSTOMER"
                        ? "var(--accent)"
                        : msg.role === "AI"
                          ? "var(--base)"
                          : "var(--amber-light)",
                    color:
                      msg.role === "CUSTOMER"
                        ? "white"
                        : msg.role === "AI"
                          ? "var(--text)"
                          : "var(--ink)",
                    fontSize: "13px",
                    lineHeight: "1.5",
                  }}
                >
                  <strong style={{ display: "block", marginBottom: "4px", fontSize: "11px" }}>
                    {msg.role === "CUSTOMER"
                      ? "You"
                      : msg.role === "AI"
                        ? "AKUMA Bot"
                        : "Merchant"}
                  </strong>
                  {msg.content}
                  {msg.suggestedPrice && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "8px",
                        background:
                          msg.role === "AI"
                            ? "var(--green-light)"
                            : "rgba(255,255,255,0.2)",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      💰 Suggested Price: ₹{(msg.suggestedPrice / 100).toLocaleString()}/unit
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div
            style={{
              padding: "16px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Enter your message..."
              disabled={sending || isDealboth}
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                fontSize: "13px",
              }}
            />
            <button
              onClick={handleSendMessage}
              disabled={sending || !inputValue.trim() || isDealboth}
              style={{
                padding: "10px 16px",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: "600",
                opacity: sending || !inputValue.trim() || isDealboth ? 0.5 : 1,
              }}
            >
              <Send size={14} /> Send
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Product Info */}
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "16px",
              background: "var(--base)",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "var(--muted)", fontWeight: "600", textTransform: "uppercase" }}>
              Product
            </p>
            <p style={{ margin: "0 0 12px 0", fontWeight: "600" }}>
              {negotiation.product?.name}
            </p>
            <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>Quantity:</span>
                <strong>{negotiation.quantity} units</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted)" }}>List Price:</span>
                <strong>₹{listPrice.toLocaleString()}</strong>
              </div>
              {suggestedPrice && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "8px",
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>Offered:</span>
                  <strong style={{ color: "var(--accent)" }}>
                    ₹{(suggestedPrice / 100).toLocaleString()}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Accept Button */}
          {canAccept && (
            <button
              onClick={handleAcceptPrice}
              style={{
                padding: "12px 16px",
                background: "var(--green)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "600",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <Check size={16} /> Accept Price
            </button>
          )}

          {/* Status */}
          {isDealboth && (
            <div
              style={{
                padding: "12px",
                background: "var(--green-light)",
                color: "var(--green)",
                borderRadius: "6px",
                textAlign: "center",
                fontWeight: "600",
                fontSize: "13px",
              }}
            >
              ✅ Deal Confirmed!
            </div>
          )}

          {/* Parties Status */}
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: "8px",
              padding: "12px",
              background: "var(--base)",
              fontSize: "12px",
            }}
          >
            <p style={{ margin: "0 0 8px 0", fontWeight: "600", color: "var(--muted)" }}>
              Status
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: customerAccepted ? "var(--green)" : "var(--muted)",
                }}
              />
              <span>Customer {customerAccepted ? "✓ Accepted" : "Pending"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: merchantAccepted ? "var(--green)" : "var(--muted)",
                }}
              />
              <span>Merchant {merchantAccepted ? "✓ Accepted" : "Pending"}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
