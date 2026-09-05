"use client";

import { useEffect, useState } from "react";
import { MessageSquare, DollarSign, Package, Clock, Check, X, ArrowRight } from "lucide-react";

type NegotiationRequest = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  originalPricePaise: number;
  originalPriceDisplay: string;
  requestedPricePaise: number | null;
  requestedPriceDisplay: string | null;
  discountPercent: number;
  totalValuePaise: number;
  totalValueDisplay: string;
  status: string;
  createdAt: string;
  policy: {
    maxDiscountPercent: number;
    minimumMarginPercent: number;
  };
};

export default function RequestsPage() {
  const [negotiations, setNegotiations] = useState<NegotiationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selected, setSelected] = useState<NegotiationRequest | null>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchNegotiations = async () => {
    try {
      const res = await fetch("/api/merchant/negotiation");
      if (res.ok) {
        const data = await res.json();
        setNegotiations(data.negotiations || []);
        if (data.negotiations?.length > 0) {
          setSelected(data.negotiations[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNegotiations();
  }, []);

  const handleDecision = async (decision: "APPROVE" | "REJECT", counterPricePaise?: number) => {
    if (!selected) return;
    setProcessing(selected.id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/merchant/negotiation/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          counterPrice: counterPricePaise,
          reason: decision === "APPROVE" ? "Approved by merchant" : counterPricePaise ? "Counter offer" : "Rejected by merchant",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(decision === "APPROVE" ? "Offer approved!" : counterPricePaise ? `Counter offer sent: ₹${(counterPricePaise / 100).toLocaleString("en-IN")}` : "Negotiation rejected");
        setTimeout(() => {
          fetchNegotiations();
          setSuccess("");
        }, 2000);
      } else {
        const data = await res.json();
        setError(data.error?.message || "Failed to process decision");
      }
    } catch {
      setError("Network error");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="content">
        <div className="page-head">
          <p className="eyebrow">MERCHANT</p>
          <h1>Loading requests...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="page-head">
        <p className="eyebrow">MERCHANT</p>
        <h1>Customer Requests</h1>
        <p className="subhead">Respond to customer negotiation requests and bulk quotes.</p>
      </div>

      {success && (
        <div className="notice" style={{ background: "rgba(74, 222, 128, 0.1)", borderColor: "#4ade80" }}>
          <div className="notice-icon" style={{ color: "#4ade80" }}><Check size={16} /></div>
          <p>{success}</p>
        </div>
      )}

      {error && (
        <div className="notice alert">
          <div className="notice-icon"><X size={16} /></div>
          <p>{error}</p>
        </div>
      )}

      {negotiations.length === 0 ? (
        <div className="notice">
          <div className="notice-icon"><MessageSquare size={16} /></div>
          <p>No pending customer requests. Customers will appear here when they request price negotiations or bulk quotes.</p>
        </div>
      ) : (
        <div className="requests-grid">
          <div className="requests-list">
            {negotiations.map((neg) => (
              <button
                key={neg.id}
                className={`request-card ${selected?.id === neg.id ? "selected" : ""}`}
                onClick={() => setSelected(neg)}
              >
                <div className="request-header">
                  <Package size={16} />
                  <span>{neg.productName}</span>
                </div>
                <div className="request-meta">
                  <span>Qty: {neg.quantity}</span>
                  <span className="price">{neg.originalPriceDisplay}</span>
                </div>
                <div className="request-status">
                  {neg.status === "OPEN" && <span className="status pending">Pending</span>}
                  {neg.status === "CUSTOMER_OFFER" && <span className="status offer">Counter Offer</span>}
                  {neg.status === "AI_COUNTER" && <span className="status counter">AI Counter</span>}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="request-detail">
              <h3>Request Details</h3>

              <div className="detail-section">
                <h4>Product</h4>
                <p className="product-name">{selected.productName}</p>
                <p className="quantity">Quantity: {selected.quantity}</p>
              </div>

              <div className="detail-section">
                <h4>Pricing</h4>
                <div className="price-row">
                  <span>Listed Price:</span>
                  <strong>{selected.originalPriceDisplay}</strong>
                </div>
                {selected.requestedPricePaise && (
                  <div className="price-row highlight">
                    <span>Customer Request:</span>
                    <strong>{selected.requestedPriceDisplay}</strong>
                  </div>
                )}
                {selected.discountPercent > 0 && (
                  <div className="discount-badge">
                    {selected.discountPercent}% discount requested
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h4>Order Value</h4>
                <p className="total-value">{selected.totalValueDisplay}</p>
              </div>

              <div className="detail-section">
                <h4>Your Policy</h4>
                <p>Max discount: {selected.policy?.maxDiscountPercent || 10}%</p>
                <p>Minimum margin: {selected.policy?.minimumMarginPercent || 15}%</p>
              </div>

              <div className="detail-section">
                <h4>Received</h4>
                <p className="timestamp">
                  <Clock size={14} />
                  {new Date(selected.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="action-buttons">
                <button
                  className="approve-btn"
                  onClick={() => handleDecision("APPROVE")}
                  disabled={processing === selected.id}
                >
                  <Check size={16} />
                  Approve Request
                </button>

                <div className="counter-form">
                  <input
                    type="number"
                    placeholder="Counter offer (paise)"
                    value={counterPrice}
                    onChange={(e) => setCounterPrice(e.target.value)}
                  />
                  <button
                    className="counter-btn"
                    onClick={() => {
                      const price = parseInt(counterPrice, 10);
                      if (price && selected?.id) {
                        fetch(`/api/merchant/negotiation/${selected.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            decision: "COUNTER",
                            counterPrice: price,
                            reason: "Counter offer",
                          }),
                        }).then(() => fetchNegotiations());
                      }
                    }}
                    disabled={processing === selected.id || !counterPrice}
                  >
                    <ArrowRight size={16} />
                    Counter
                  </button>
                </div>

                <button
                  className="reject-btn"
                  onClick={() => handleDecision("REJECT")}
                  disabled={processing === selected.id}
                >
                  <X size={16} />
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .requests-grid {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
          margin-top: 24px;
        }

        .requests-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .request-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 12px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .request-card:hover {
          border-color: var(--amber);
        }

        .request-card.selected {
          border-color: var(--amber);
          background: rgba(251, 146, 60, 0.1);
        }

        .request-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .request-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .request-meta .price {
          font-weight: 600;
          color: var(--ink);
        }

        .request-status .status {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .status.pending {
          background: rgba(251, 146, 60, 0.1);
          color: #fb923c;
        }

        .status.offer {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .status.counter {
          background: rgba(139, 92, 246, 0.1);
          color: #8b5cf6;
        }

        .request-detail {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 24px;
        }

        .request-detail h3 {
          font-size: 18px;
          margin-bottom: 20px;
        }

        .detail-section {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
        }

        .detail-section h4 {
          font-size: 12px;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .product-name {
          font-weight: 600;
          font-size: 16px;
        }

        .quantity {
          color: var(--muted);
          font-size: 14px;
          margin-top: 4px;
        }

        .price-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          margin-bottom: 8px;
        }

        .price-row.highlight {
          color: #4ade80;
        }

        .discount-badge {
          display: inline-block;
          background: rgba(251, 146, 60, 0.1);
          color: #fb923c;
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          margin-top: 8px;
        }

        .total-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--amber);
        }

        .timestamp {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--muted);
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .approve-btn, .reject-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          border: none;
        }

        .approve-btn {
          background: #4ade80;
          color: #052e16;
        }

        .reject-btn {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid #ef4444;
        }

        .counter-form {
          display: flex;
          gap: 8px;
        }

        .counter-form input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--base);
          color: var(--ink);
          font-size: 14px;
        }

        .counter-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--amber);
          color: var(--ink);
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
        }

        @media (max-width: 768px) {
          .requests-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}