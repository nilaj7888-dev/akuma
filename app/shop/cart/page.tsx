"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, Minus, ShoppingCart, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CartItem = {
  id: string;
  productId: string;
  productName: string;
  merchantName: string;
  quantity: number;
  unitPriceDisplay: string;
  unitPricePaise: number;
  totalDisplay: string;
  totalPaise: number;
  stock: number;
  available: boolean;
};

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subtotal, setSubtotal] = useState(0);
  const [negotiateChecked, setNegotiateChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/consumer/cart/items");
      if (!res.ok) {
        throw new Error("Failed to fetch cart");
      }
      const data = await res.json();
      setItems(data.items || []);
      setSubtotal(data.subtotalPaise || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading cart");
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (cartItemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    try {
      const res = await fetch(`/api/consumer/cart/items/${cartItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      });

      if (!res.ok) throw new Error("Failed to update quantity");
      await fetchCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating quantity");
    }
  };

  const removeItem = async (cartItemId: string) => {
    try {
      const res = await fetch(`/api/consumer/cart/items/${cartItemId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to remove item");
      await fetchCart();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error removing item");
    }
  };

  const handleNegotiate = () => {
    if (!negotiateChecked || items.length === 0) return;

    // Store cart in session storage for AI chat to access
    sessionStorage.setItem("negotiation_cart_items", JSON.stringify(items));

    // Navigate to AI chat page
    router.push("/shop/negotiate");
  };

  const handleCheckout = () => {
    if (items.length === 0) return;

    if (negotiateChecked) {
      handleNegotiate();
    } else {
      router.push("/shop/checkout");
    }
  };

  if (loading) {
    return (
      <section className="content">
        <p>Loading cart...</p>
      </section>
    );
  }

  return (
    <section className="content">
      <header className="topbar">
        <div className="crumb">
          <span>Shop</span>
          <span>/</span>
          <strong>Cart</strong>
        </div>
      </header>

      <div className="page-head">
        <div>
          <p className="eyebrow">YOUR CART</p>
          <h1>Shopping Cart</h1>
          <p className="subhead">{items.length} item{items.length !== 1 ? "s" : ""} in cart</p>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "var(--red-light)",
            color: "var(--red)",
            borderRadius: "8px",
            marginBottom: "24px",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {items.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 24px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            backgroundColor: "var(--surface)",
          }}
        >
          <ShoppingCart size={48} style={{ color: "var(--muted)", margin: "0 auto 16px" }} />
          <h3 style={{ margin: "0 0 8px 0" }}>Your cart is empty</h3>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            <Link href="/shop/discover" style={{ color: "var(--accent)" }}>
              Browse products
            </Link>{" "}
            to add items to your cart
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "32px" }}>
          {/* Cart Items */}
          <div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "12px", fontSize: "12px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Product</th>
                    <th style={{ textAlign: "center", padding: "12px", fontSize: "12px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "12px", fontSize: "12px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Price</th>
                    <th style={{ textAlign: "right", padding: "12px", fontSize: "12px", fontWeight: "600", color: "var(--muted)", textTransform: "uppercase" }}>Total</th>
                    <th style={{ textAlign: "center", padding: "12px" }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "16px 12px" }}>
                        <div>
                          <p style={{ margin: "0 0 4px 0", fontWeight: "600", color: "var(--text)" }}>{item.productName}</p>
                          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>{item.merchantName}</p>
                        </div>
                      </td>
                      <td style={{ textAlign: "center", padding: "16px 12px" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            width: "100px",
                            margin: "0 auto",
                          }}
                        >
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              padding: "4px 8px",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <Minus size={16} />
                          </button>
                          <span style={{ fontWeight: "600", minWidth: "30px", textAlign: "center" }}>{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              padding: "4px 8px",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", padding: "16px 12px", color: "var(--text)" }}>{item.unitPriceDisplay}</td>
                      <td style={{ textAlign: "right", padding: "16px 12px", fontWeight: "600", color: "var(--text)" }}>{item.totalDisplay}</td>
                      <td style={{ textAlign: "center", padding: "16px 12px" }}>
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "var(--red)",
                            padding: "4px",
                            display: "flex",
                            alignItems: "center",
                            margin: "0 auto",
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Summary & Negotiation */}
          <div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "24px",
                backgroundColor: "var(--surface)",
                position: "sticky",
                top: "120px",
              }}
            >
              <h3 style={{ margin: "0 0 20px 0", fontSize: "16px" }}>Order Summary</h3>

              {/* Subtotal */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--muted)" }}>Subtotal</span>
                <span style={{ fontWeight: "600" }}>₹{(subtotal / 100).toLocaleString("en-IN")}</span>
              </div>

              {/* Bulk Discount Info */}
              {items.some(item => item.quantity >= 5) && (
                <div
                  style={{
                    padding: "12px",
                    backgroundColor: "var(--green-light)",
                    color: "var(--green)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    marginBottom: "16px",
                  }}
                >
                  💡 You qualify for bulk discounts! Negotiate for up to {items.some(item => item.quantity >= 10) ? "30%" : "10%"} off when you negotiate.
                </div>
              )}

              {/* Negotiation Checkbox */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "16px",
                  backgroundColor: "var(--amber-light)",
                  borderRadius: "8px",
                  marginBottom: "20px",
                  cursor: "pointer",
                }}
                onClick={() => setNegotiateChecked(!negotiateChecked)}
              >
                <input
                  type="checkbox"
                  checked={negotiateChecked}
                  onChange={(e) => setNegotiateChecked(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <label style={{ cursor: "pointer", flex: 1, margin: 0 }}>
                  <strong>Do you want to negotiate?</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "var(--muted)" }}>Chat with AI to negotiate prices with merchants</p>
                </label>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleCheckout}
                disabled={items.length === 0}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  backgroundColor: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: items.length === 0 ? "not-allowed" : "pointer",
                  opacity: items.length === 0 ? 0.5 : 1,
                  marginBottom: "12px",
                }}
              >
                {negotiateChecked ? "Negotiate Prices" : "Proceed to Checkout"}
              </button>

              <Link href="/shop/discover" style={{ textDecoration: "none" }}>
                <button
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    backgroundColor: "transparent",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)",
                    borderRadius: "8px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Continue Shopping
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .content {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .crumb {
          display: flex;
          gap: 8px;
          font-size: 13px;
          color: var(--muted);
        }

        .crumb strong {
          color: var(--text);
        }

        .page-head {
          margin-bottom: 40px;
        }

        .page-head h1 {
          margin: 8px 0 12px 0;
          font-size: 32px;
          color: var(--text);
        }

        .page-head .eyebrow {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--muted);
          margin: 0;
        }

        .page-head .subhead {
          margin: 0;
          font-size: 14px;
          color: var(--muted);
        }

        @media (max-width: 900px) {
          [style*="grid-template-columns: 1fr 350px"] {
            grid-template-columns: 1fr !important;
          }

          [style*="position: sticky"] {
            position: static !important;
          }
        }
      `}</style>
    </section>
  );
}
