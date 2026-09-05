"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader, Check, Package } from "lucide-react";

interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>;
  prefill: { contact: string; email: string };
  theme: { color: string };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

type CartItem = {
  productName: string;
  quantity: number;
  totalDisplay: string;
};

type DeliveryAddress = {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
};

type Prediction = { place_id: string; description: string };

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [orderContactConsent, setOrderContactConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [subtotal, setSubtotal] = useState("");
  const [negotiateChecked, setNegotiateChecked] = useState(false);

  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [newAddressName, setNewAddressName] = useState("");
  const [newAddressPhone, setNewAddressPhone] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [manualLine1, setManualLine1] = useState("");
  const [manualLine2, setManualLine2] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualState, setManualState] = useState("");
  const [manualPostalCode, setManualPostalCode] = useState("");
  const [sessionToken] = useState(() => `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCartItems = async () => {
    try {
      const res = await fetch("/api/consumer/cart/items");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSubtotal(data.subtotalDisplay || "₹0");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      const res = await fetch("/api/consumer/addresses");
      if (res.ok) {
        const data = await res.json() as { addresses: DeliveryAddress[] };
        setAddresses(data.addresses || []);
        const preferred = data.addresses?.find((a) => a.isDefault) ?? data.addresses?.[0];
        if (preferred) setSelectedAddressId(preferred.id);
        else setAddingAddress(true);
      }
    } catch {
      // Non-blocking — address is optional context for delivery-cost estimation
    }
  };

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => setRazorpayReady(true);
    document.body.appendChild(script);

    fetchCartItems();
    fetchAddresses();
  }, []);

  const searchAddress = (q: string) => {
    setAddressQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.trim().length < 3) {
      setPredictions([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/consumer/addresses/autocomplete?q=${encodeURIComponent(q)}&sessionToken=${sessionToken}`);
        if (res.ok) {
          const data = await res.json() as { predictions: Prediction[] };
          setPredictions(data.predictions || []);
        }
      } catch {
        // Ignore — user can retry typing
      }
    }, 350);
  };

  const selectPrediction = async (prediction: Prediction) => {
    if (!newAddressName.trim() || !newAddressPhone.trim()) {
      setError("Please enter a recipient name and phone number before selecting an address.");
      return;
    }
    setResolvingAddress(true);
    setError("");
    try {
      const res = await fetch("/api/consumer/addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placeId: prediction.place_id,
          sessionToken: sessionToken,
          name: newAddressName.trim(),
          phone: newAddressPhone.trim(),
          contactConsent: orderContactConsent,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || "Could not save that address.");
        return;
      }
      const { address } = await res.json() as { address: DeliveryAddress };
      setAddresses((prev) => [address, ...prev.filter((a) => a.id !== address.id)]);
      setSelectedAddressId(address.id);
      setAddingAddress(false);
      setAddressQuery("");
      setPredictions([]);
    } finally {
      setResolvingAddress(false);
    }
  };

  const saveManualAddress = async () => {
    if (!newAddressName.trim() || !newAddressPhone.trim() || !manualLine1.trim() || !manualCity.trim() || !manualState.trim() || !manualPostalCode.trim()) {
      setError("Please fill in all address fields.");
      return;
    }
    setResolvingAddress(true);
    setError("");
    try {
      const res = await fetch("/api/consumer/addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manual: true,
          name: newAddressName.trim(),
          phone: newAddressPhone.trim(),
          addressLine1: manualLine1.trim(),
          addressLine2: manualLine2.trim() || undefined,
          city: manualCity.trim(),
          state: manualState.trim(),
          postalCode: manualPostalCode.trim(),
          contactConsent: orderContactConsent,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || "Could not save that address.");
        return;
      }
      const { address } = await res.json() as { address: DeliveryAddress };
      setAddresses((prev) => [address, ...prev.filter((a) => a.id !== address.id)]);
      setSelectedAddressId(address.id);
      setAddingAddress(false);
      setManualEntry(false);
      setManualLine1("");
      setManualLine2("");
      setManualCity("");
      setManualState("");
      setManualPostalCode("");
    } finally {
      setResolvingAddress(false);
    }
  };

  const handleNegotiate = () => {
    if (items.length === 0) return;
    // Store cart in session storage for AI chat to access
    sessionStorage.setItem("negotiation_cart_items", JSON.stringify(items));
    // Navigate to AI chat page
    router.push("/shop/negotiate");
  };

  const handleCheckout = async () => {
    if (!orderContactConsent) {
      setError("Please provide order contact consent to proceed.");
      return;
    }

    if (!selectedAddressId) {
      setError("Please add or select a delivery address to proceed.");
      return;
    }

    // If user wants to negotiate, redirect to negotiate page
    if (negotiateChecked) {
      handleNegotiate();
      return;
    }

    setProcessing(true);
    setError("");

    try {
      // Create order on backend
      const res = await fetch("/api/consumer/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderContactConsent,
          marketingConsent,
          deliveryAddressId: selectedAddressId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || "Checkout failed");
        setProcessing(false);
        return;
      }

      const checkoutData = await res.json();

      // Open Razorpay
      const options = {
        key: checkoutData.razorpayKey,
        order_id: checkoutData.razorpayOrderId,
        amount: checkoutData.amount,
        currency: "INR",
        name: "AKUMA Shopping",
        description: `Order for ${items.length} item${items.length !== 1 ? "s" : ""}`,
        handler: async (response: RazorpayPaymentResponse) => {
          // Verify payment
          try {
            const verifyRes = await fetch("/api/consumer/checkout/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              const verified = await verifyRes.json();
              setSuccess(true);
              setTimeout(() => {
                router.push(`/shop/orders/${verified.orderId}`);
              }, 2000);
            } else {
              const data = await verifyRes.json();
              setError(data.error?.message || "Payment verification failed");
              setProcessing(false);
            }
          } catch {
            setError("Payment verification error");
            setProcessing(false);
          }
        },
        prefill: {
          contact: "",
          email: "",
        },
        theme: {
          color: "#fb923c",
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();
    } catch {
      setError("Network error");
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="content">
        <div className="topbar">
          <div className="crumb">
            <span>SHOP</span>
            <span>→</span>
            <strong>CHECKOUT</strong>
          </div>
        </div>
        <div className="page-head">
          <p className="eyebrow">CHECKOUT</p>
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="content">
        <div className="topbar">
          <div className="crumb">
            <span>SHOP</span>
            <span>→</span>
            <strong>CHECKOUT</strong>
          </div>
        </div>
        <div className="success-container">
          <div className="success-icon">
            <Check size={64} />
          </div>
          <h1>Payment successful!</h1>
          <p>Your order has been confirmed. Redirecting to order details...</p>
        </div>
        <style jsx>{`
          .success-container {
            text-align: center;
            padding: 60px 20px;
          }

          .success-icon {
            color: #4ade80;
            margin-bottom: 24px;
            display: flex;
            justify-content: center;
          }

          h1 {
            font-size: 28px;
            margin-bottom: 12px;
          }

          p {
            color: var(--muted);
          }
        `}</style>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="content">
        <div className="topbar">
          <div className="crumb">
            <span>SHOP</span>
            <span>→</span>
            <strong>CHECKOUT</strong>
          </div>
        </div>
        <div className="page-head">
          <p className="eyebrow">CHECKOUT</p>
          <h1>Your cart is empty</h1>
        </div>
        <div className="notice">
          <div className="notice-icon">
            <Package size={16} />
          </div>
          <p>Add items to your cart before proceeding to checkout.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="topbar">
        <div className="crumb">
          <span>SHOP</span>
          <span>→</span>
          <strong>CHECKOUT</strong>
        </div>
      </div>

      <div className="page-head">
        <div>
          <p className="eyebrow">REVIEW & PAY</p>
          <h1>Checkout</h1>
          <p className="subhead">Review your order and complete payment.</p>
        </div>
      </div>

      {error && (
        <div className="notice alert">
          <div className="notice-icon">
            <AlertCircle size={16} />
          </div>
          <p>{error}</p>
        </div>
      )}

      <div className="checkout-grid">
        <div className="order-summary">
          <h3>Order Summary</h3>
          <div className="order-items">
            {items.map((item, idx) => (
              <div key={idx} className="order-item">
                <div>
                  <div className="item-name">{item.productName}</div>
                  <div className="item-qty">Qty: {item.quantity}</div>
                </div>
                <div className="item-total">{item.totalDisplay}</div>
              </div>
            ))}
          </div>
          <div className="order-total">
            <span>Subtotal</span>
            <strong>{subtotal}</strong>
          </div>
        </div>

        <div className="payment-form">
          <h3>Delivery Address</h3>

          {addresses.length > 0 && !addingAddress && (
            <div className="address-list">
              {addresses.map((addr) => (
                <label key={addr.id} className={`address-option ${selectedAddressId === addr.id ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="deliveryAddress"
                    checked={selectedAddressId === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)}
                    disabled={processing}
                  />
                  <div>
                    <strong>{addr.name}</strong>
                    <p>{[addr.addressLine1, addr.addressLine2, addr.city, addr.state, addr.postalCode].filter(Boolean).join(", ")}</p>
                    <p className="address-phone">{addr.phone}</p>
                  </div>
                </label>
              ))}
              <button type="button" className="address-add-link" onClick={() => setAddingAddress(true)} disabled={processing}>
                + Add a new address
              </button>
            </div>
          )}

          {addingAddress && (
            <div className="address-form">
              <div className="address-form-row">
                <input type="text" placeholder="Recipient name" value={newAddressName} onChange={(e) => setNewAddressName(e.target.value)} disabled={resolvingAddress} />
                <input type="tel" placeholder="Phone number" value={newAddressPhone} onChange={(e) => setNewAddressPhone(e.target.value)} disabled={resolvingAddress} />
              </div>

              {!manualEntry ? (
                <>
                  <input
                    type="text"
                    placeholder="Search for your delivery address..."
                    value={addressQuery}
                    onChange={(e) => searchAddress(e.target.value)}
                    disabled={resolvingAddress}
                  />
                  {predictions.length > 0 && (
                    <div className="address-predictions">
                      {predictions.map((p) => (
                        <button type="button" key={p.place_id} onClick={() => selectPrediction(p)} disabled={resolvingAddress}>
                          {p.description}
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" className="address-add-link" onClick={() => setManualEntry(true)} disabled={resolvingAddress}>
                    Can&apos;t find your address? Enter it manually
                  </button>
                </>
              ) : (
                <>
                  <input type="text" placeholder="Address line 1" value={manualLine1} onChange={(e) => setManualLine1(e.target.value)} disabled={resolvingAddress} />
                  <input type="text" placeholder="Address line 2 (optional)" value={manualLine2} onChange={(e) => setManualLine2(e.target.value)} disabled={resolvingAddress} />
                  <div className="address-form-row">
                    <input type="text" placeholder="City" value={manualCity} onChange={(e) => setManualCity(e.target.value)} disabled={resolvingAddress} />
                    <input type="text" placeholder="State" value={manualState} onChange={(e) => setManualState(e.target.value)} disabled={resolvingAddress} />
                  </div>
                  <input type="text" placeholder="Postal code" value={manualPostalCode} onChange={(e) => setManualPostalCode(e.target.value)} disabled={resolvingAddress} />
                  <button type="button" className="address-add-link" onClick={saveManualAddress} disabled={resolvingAddress}>
                    Save address
                  </button>
                  <button type="button" className="address-add-link" onClick={() => setManualEntry(false)} disabled={resolvingAddress}>
                    Back to address search
                  </button>
                </>
              )}

              {resolvingAddress && <p className="address-hint">Saving address...</p>}
              {addresses.length > 0 && (
                <button type="button" className="address-add-link" onClick={() => { setAddingAddress(false); setManualEntry(false); setError(""); }} disabled={resolvingAddress}>
                  Cancel
                </button>
              )}
            </div>
          )}

          <h3>Contact & Consent</h3>

          <div className="consent-section">
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={orderContactConsent}
                onChange={(e) => setOrderContactConsent(e.target.checked)}
                disabled={processing}
              />
              <span className="checkbox-custom" />
              <div>
                <strong>Order Contact Permission</strong>
                <p>Allow the merchant to contact you about this order (shipping, delivery, support).</p>
              </div>
            </label>
          </div>

          <div className="consent-section">
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
                disabled={processing}
              />
              <span className="checkbox-custom" />
              <div>
                <strong>Marketing Updates</strong>
                <p>Receive promotional offers and new product announcements.</p>
              </div>
            </label>
          </div>

          <div className="consent-section negotiation-section">
            <label className="consent-checkbox">
              <input
                type="checkbox"
                checked={negotiateChecked}
                onChange={(e) => setNegotiateChecked(e.target.checked)}
                disabled={processing}
              />
              <span className="checkbox-custom" />
              <div>
                <strong>💬 Negotiate Prices with Merchant</strong>
                <p>Chat with AI to request better prices based on bulk orders or budget constraints.</p>
              </div>
            </label>
          </div>

          <div className="payment-note">
            <p>{negotiateChecked ? "You'll chat with AI to negotiate before completing payment." : "You will be redirected to Razorpay to complete the payment securely."}</p>
          </div>

          <button
            className="pay-button"
            onClick={handleCheckout}
            disabled={processing || !razorpayReady || items.length === 0 || !selectedAddressId}
          >
            {processing ? (
              <>
                <Loader size={18} className="spinner" />
                Processing...
              </>
            ) : negotiateChecked ? (
              <>Negotiate Prices</>
            ) : (
              <>Proceed to Payment</>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .checkout-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          margin-top: 24px;
        }

        .order-summary {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 20px;
          background: var(--panel);
        }

        .order-summary h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .order-items {
          display: grid;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--line);
        }

        .order-item {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
        }

        .item-name {
          font-weight: 500;
          color: var(--ink);
        }

        .item-qty {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }

        .item-total {
          font-weight: 600;
          color: var(--ink);
        }

        .order-total {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: 600;
        }

        .payment-form {
          border: 1px solid var(--line);
          border-radius: 8px;
          padding: 20px;
          background: var(--panel);
        }

        .payment-form h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .address-list {
          display: grid;
          gap: 10px;
          margin-bottom: 20px;
        }

        .address-option {
          display: flex;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--line);
          border-radius: 8px;
          cursor: pointer;
        }

        .address-option.selected {
          border-color: var(--amber);
          background: var(--base);
        }

        .address-option input {
          margin-top: 2px;
          cursor: pointer;
        }

        .address-option strong {
          display: block;
          font-size: 13px;
          margin-bottom: 2px;
        }

        .address-option p {
          font-size: 12px;
          color: var(--muted);
          margin: 0;
        }

        .address-phone {
          margin-top: 2px !important;
        }

        .address-add-link {
          background: none;
          border: none;
          color: var(--amber);
          font-size: 13px;
          cursor: pointer;
          padding: 4px 0;
          text-align: left;
        }

        .address-form {
          display: grid;
          gap: 10px;
          margin-bottom: 20px;
        }

        .address-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .address-form input {
          padding: 10px 12px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--base);
          color: var(--ink);
          font-size: 13px;
        }

        .address-predictions {
          display: grid;
          gap: 4px;
          border: 1px solid var(--line);
          border-radius: 6px;
          overflow: hidden;
        }

        .address-predictions button {
          text-align: left;
          padding: 10px 12px;
          background: var(--panel);
          border: none;
          border-bottom: 1px solid var(--line);
          color: var(--ink);
          font-size: 13px;
          cursor: pointer;
        }

        .address-predictions button:last-child {
          border-bottom: none;
        }

        .address-predictions button:hover {
          background: var(--base);
        }

        .address-hint {
          font-size: 12px;
          color: var(--muted);
        }

        .consent-section {
          margin-bottom: 16px;
        }

        .consent-checkbox {
          display: flex;
          gap: 12px;
          cursor: pointer;
        }

        .consent-checkbox input {
          width: 18px;
          height: 18px;
          margin-top: 2px;
          cursor: pointer;
        }

        .consent-checkbox strong {
          display: block;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .consent-checkbox p {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.4;
        }

        .negotiation-section {
          background: var(--base);
          border: 1px solid var(--amber);
          border-radius: 8px;
          padding: 12px;
        }

        .negotiation-section .consent-checkbox {
          margin: 0;
        }

        .payment-note {
          background: var(--base);
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 12px;
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 16px;
        }

        .pay-button {
          width: 100%;
          padding: 14px;
          background: var(--amber);
          color: var(--ink);
          border: none;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s;
        }

        .pay-button:hover:not(:disabled) {
          opacity: 0.9;
        }

        .pay-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .checkout-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
