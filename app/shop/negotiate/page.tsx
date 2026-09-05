"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";

type CartItem = {
  id: string;
  productId: string;
  productName: string;
  merchantName: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
};

type AiMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function NegotiatePage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get cart items from sessionStorage
    const cartData = sessionStorage.getItem("negotiation_cart_items");
    if (cartData) {
      setCartItems(JSON.parse(cartData));

      // Initial AI message
      const items = JSON.parse(cartData);
      const cartSummary = items.map((item: CartItem) =>
        `${item.productName} x${item.quantity} (₹${(item.unitPricePaise / 100).toLocaleString()} each)`
      ).join(", ");

      const bulkDiscount = items.some((item: CartItem) => item.quantity >= 10)
        ? " You have 10+ units which qualifies for up to 30% bulk discount!"
        : items.some((item: CartItem) => item.quantity >= 5)
          ? " You have 5-9 units which qualifies for up to 10% bulk discount!"
          : "";

      setMessages([
        {
          role: "assistant",
          content: `Hi! I see you want to negotiate on: ${cartSummary}.${bulkDiscount} What price would you like to offer?`
        }
      ]);
    }
  }, []);

  const sendMessage = async () => {
    if (!inputValue.trim() || loading || cartItems.length === 0) return;

    const userMessage = inputValue;
    setInputValue("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          role: "BUYER",
          cartItems: cartItems,
          history: messages,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await res.json();

      if (data.error) {
        setError(data.error.message);
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `Error: ${data.error.message}`
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: data.content
        }]);

        // If negotiation was created, show next steps
        if (data.negotiationId) {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "The merchant has received your offer and will respond soon. Check your notifications or cart page to see their response!"
          }]);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${errorMsg}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="content">
      <header className="topbar">
        <Link href="/shop/cart" className="back-link">
          <ArrowLeft size={16} /> Back to cart
        </Link>
      </header>

      <div className="negotiate-container">
        {/* Cart Summary */}
        <div className="cart-summary">
          <h2>Your Items</h2>
          <div className="items-list">
            {cartItems.map((item) => (
              <div key={item.id} className="item">
                <div className="item-name">{item.productName}</div>
                <div className="item-details">
                  <span className="qty">x{item.quantity}</span>
                  <span className="price">₹{(item.unitPricePaise / 100).toLocaleString()}</span>
                  <span className="total">= ₹{(item.totalPaise / 100).toLocaleString()}</span>
                </div>
                {item.quantity >= 5 && (
                  <div className="bulk-badge">
                    {item.quantity >= 10 ? "Bulk: Up to 30% off" : "Bulk: Up to 10% off"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div className="chat-container">
          <div className="chat-header">
            <MessageSquare size={20} />
            <h2>Negotiate with Merchant</h2>
          </div>

          <div className="messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}
            {loading && <div className="message assistant"><div className="message-content">Thinking...</div></div>}
          </div>

          <div className="input-area">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type your offer (e.g., 'Can you do 30% off?')"
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !inputValue.trim()}>
              Send
            </button>
          </div>

          {error && <div className="error">{error}</div>}
        </div>
      </div>

      <style jsx>{`
        .content {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .topbar {
          margin-bottom: 24px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--text);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: var(--accent);
        }

        .negotiate-container {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
          height: calc(100vh - 200px);
        }

        .cart-summary {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          background: var(--surface);
          height: fit-content;
          position: sticky;
          top: 120px;
        }

        .cart-summary h2 {
          margin: 0 0 16px 0;
          font-size: 16px;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .item {
          padding: 12px;
          background: var(--bg);
          border-radius: 8px;
          font-size: 12px;
        }

        .item-name {
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--text);
        }

        .item-details {
          display: flex;
          gap: 8px;
          color: var(--muted);
          font-size: 11px;
        }

        .bulk-badge {
          margin-top: 6px;
          padding: 4px 8px;
          background: var(--green-light);
          color: var(--green);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }

        .chat-container {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          overflow: hidden;
        }

        .chat-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
        }

        .chat-header h2 {
          margin: 0;
          font-size: 14px;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .message {
          display: flex;
          justify-content: flex-start;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .message.assistant .message-content {
          background: var(--accent);
          color: white;
          border-radius: 8px 8px 8px 0;
        }

        .message.user .message-content {
          background: var(--border);
          color: var(--text);
          border-radius: 8px 8px 0 8px;
        }

        .input-area {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid var(--border);
          background: var(--bg);
        }

        .input-area input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          font-size: 13px;
          font-family: inherit;
        }

        .input-area input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .input-area button {
          padding: 10px 20px;
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          font-size: 13px;
        }

        .input-area button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error {
          padding: 12px 16px;
          background: var(--red-light);
          color: var(--red);
          font-size: 12px;
          border-radius: 6px;
          margin: 0 16px 16px 16px;
        }

        @media (max-width: 900px) {
          .negotiate-container {
            grid-template-columns: 1fr;
            height: auto;
          }

          .cart-summary {
            position: static;
          }
        }
      `}</style>
    </section>
  );
}
