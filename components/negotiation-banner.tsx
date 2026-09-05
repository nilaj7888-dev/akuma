"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/toast";

type Negotiation = {
  id: string;
  productId: string;
  quantity: number;
  originalPrice: number;
  requestedPrice: number;
  approvedPrice: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  product: {
    name: string;
    category: string;
    imageUrl: string | null;
  };
};

export function NegotiationBanner({ role }: { role: "MERCHANT" | "CONSUMER" }) {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    // Poll for active negotiations every 3 seconds
    const poll = async () => {
      try {
        const res = await fetch("/api/negotiation/active");
        if (res.ok) {
          const data = await res.json();
          setNegotiations(data);
        }
      } catch (error) {
        console.error("Failed to fetch negotiations:", error);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleResponse = async (negotiationId: string, action: "ACCEPT" | "DECLINE" | "COUNTER", counterPrice?: number) => {
    setResponding(negotiationId);
    try {
      const endpoint = role === "MERCHANT"
        ? `/api/negotiation/${negotiationId}/merchant-respond`
        : `/api/negotiation/${negotiationId}/consumer-respond`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, counterPrice }),
      });

      const result = await res.json();
      if (res.ok) {
        // Refresh negotiations
        const refreshRes = await fetch("/api/negotiation/active");
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setNegotiations(data);
        }
        showToast(result.message || "Response sent.", "success");
      } else {
        showToast(result.error?.message || "Failed to respond", "error");
      }
    } catch (error) {
      console.error("Response error:", error);
      showToast("Failed to respond to negotiation", "error");
    } finally {
      setResponding(null);
    }
  };

  if (negotiations.length === 0) return null;

  return (
    <div className="negotiation-banner-container">
      {negotiations.map((neg) => {
        const isWaitingForMe =
          (role === "MERCHANT" && (neg.status === "OPEN" || neg.status === "CUSTOMER_OFFER")) ||
          (role === "CONSUMER" && neg.status === "MERCHANT_COUNTER");

        return (
          <div key={neg.id} className="negotiation-banner">
            <div className="negotiation-banner-icon">
              <AlertCircle size={20} />
            </div>
            <div className="negotiation-banner-content">
              <div className="negotiation-banner-header">
                <strong>{neg.product.name}</strong>
                <span className="negotiation-status">{neg.status.replace(/_/g, " ")}</span>
              </div>
              <div className="negotiation-banner-details">
                {role === "MERCHANT" ? (
                  <>
                    <span>Customer wants {neg.quantity}x at ₹{(neg.requestedPrice / 100).toLocaleString()}/unit</span>
                    <span className="muted">Listed: ₹{(neg.originalPrice / 100).toLocaleString()}/unit</span>
                    {neg.quantity >= 5 && (
                      <span className="bulk-info">
                        {neg.quantity >= 10 ? "📦 Bulk order (10+): Up to 30% off" : "📦 Bulk order (5-9): Up to 10% off"}
                      </span>
                    )}
                    <span className="total-info">
                      Total: ₹{((neg.requestedPrice * neg.quantity) / 100).toLocaleString()} vs ₹{((neg.originalPrice * neg.quantity) / 100).toLocaleString()}
                    </span>
                  </>
                ) : (
                  <>
                    {neg.status === "MERCHANT_COUNTER" ? (
                      <>
                        <span>Merchant offers ₹{((neg.approvedPrice || 0) / 100).toLocaleString()}/unit</span>
                        <span className="muted">You requested: ₹{(neg.requestedPrice / 100).toLocaleString()}/unit</span>
                        <span className="total-info">Total for {neg.quantity}x: ₹{(((neg.approvedPrice || 0) * neg.quantity) / 100).toLocaleString()}</span>
                      </>
                    ) : (
                      <>
                        <span>Waiting for merchant response...</span>
                        <span className="muted">Your offer: ₹{(neg.requestedPrice / 100).toLocaleString()}/unit ({neg.quantity}x = ₹{((neg.requestedPrice * neg.quantity) / 100).toLocaleString()})</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            {isWaitingForMe && (
              <div className="negotiation-banner-actions">
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Check size={14} />}
                  onClick={() => handleResponse(neg.id, "ACCEPT")}
                  disabled={responding === neg.id}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<X size={14} />}
                  onClick={() => handleResponse(neg.id, "DECLINE")}
                  disabled={responding === neg.id}
                >
                  Decline
                </Button>
                {role === "MERCHANT" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const counter = prompt(`Counter-offer price (current: ₹${neg.requestedPrice / 100}):`);
                      if (counter) {
                        const counterInPaise = Math.round(parseFloat(counter) * 100);
                        handleResponse(neg.id, "COUNTER", counterInPaise);
                      }
                    }}
                    disabled={responding === neg.id}
                  >
                    Counter
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <style jsx>{`
        .negotiation-banner-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 450px;
          max-height: 400px;
          overflow-y: auto;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .negotiation-banner {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          gap: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .negotiation-banner-icon {
          color: var(--amber);
          flex-shrink: 0;
        }
        .negotiation-banner-content {
          flex: 1;
          min-width: 0;
        }
        .negotiation-banner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .negotiation-banner-header strong {
          font-size: 14px;
          color: var(--text);
        }
        .negotiation-status {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
        }
        .negotiation-banner-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 13px;
        }
        .negotiation-banner-details .muted {
          color: var(--muted);
          font-size: 12px;
        }
        .bulk-info {
          color: var(--green);
          font-size: 11px;
          font-weight: 600;
        }
        .total-info {
          font-weight: 600;
          font-size: 12px;
          color: var(--accent);
        }
        .negotiation-banner-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
