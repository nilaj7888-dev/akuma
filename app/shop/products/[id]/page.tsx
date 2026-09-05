"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Package, ShoppingCart, Zap, Heart, Check } from "lucide-react";
import Link from "next/link";

type ProductDetails = {
  id: string;
  name: string;
  description: string;
  category: string;
  pricePaise: number;
  priceDisplay: string;
  stock: number;
  available: boolean;
  merchant: { name: string; email: string; phone: string | null };
};

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingSave, setSavingSave] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (productId) {
      fetchProduct();
      checkSaved();
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/consumer/catalog/${productId}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkSaved = async () => {
    try {
      const res = await fetch("/api/consumer/wishlist?limit=50");
      if (res.ok) {
        const data = await res.json();
        const ids: string[] = (data.wishlist || []).map((w: { productId: string }) => w.productId);
        setSaved(ids.includes(productId));
      }
    } catch {
      /* non-blocking */
    }
  };

  const toggleSave = async () => {
    if (!product || savingSave) return;
    setSavingSave(true);
    const wasSaved = saved;
    try {
      const res = await fetch("/api/consumer/wishlist", {
        method: wasSaved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(wasSaved ? { productId: product.id } : { productId: product.id, name: product.name }),
      });
      if (res.ok) setSaved(!wasSaved);
    } catch {
      /* non-blocking */
    } finally {
      setSavingSave(false);
    }
  };

  const addToCart = async () => {
    if (!product) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/consumer/cart/items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product.id, quantity }),
      });
      if (res.ok) {
        setAdded(true);
        setTimeout(() => setAdded(false), 2000);
      } else {
        const data = await res.json();
        setError(data.error?.message || "Failed to add to cart");
      }
    } catch {
      setError("Network error");
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    await addToCart();
    // Navigate to checkout using Next.js router (no history entry)
    router.replace("/shop/checkout");
  };

  if (loading) {
    return (
      <div className="content">
        <div className="topbar">
          <div className="crumb">
            <span>SHOP</span>
            <span>→</span>
            <strong>PRODUCT</strong>
          </div>
        </div>
        <div className="page-head">
          <p className="eyebrow">LOADING...</p>
          <h1>Loading product...</h1>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="content">
        <div className="topbar">
          <div className="crumb">
            <span>SHOP</span>
            <span>→</span>
            <strong>PRODUCT</strong>
          </div>
        </div>
        <div className="page-head">
          <p className="eyebrow">NOT FOUND</p>
          <h1>Product not found</h1>
        </div>
        <div className="notice alert">
          <p>This product may have been removed or is no longer available.</p>
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
          <Link href="/shop/discover" style={{ color: "var(--muted)" }}>DISCOVER</Link>
          <span>→</span>
          <strong>PRODUCT</strong>
        </div>
      </div>

      <div className="page-head">
        <div>
          <p className="eyebrow">{product.category}</p>
          <h1>{product.name}</h1>
          <p className="subhead">Sold by {product.merchant.name}</p>
        </div>
      </div>

      {error && (
        <div className="notice alert">
          <p>{error}</p>
        </div>
      )}

      <div className="product-detail-grid">
        <div className="product-image-section">
          <div className="product-image">
            <Package size={120} />
          </div>
        </div>

        <div className="product-info-section">
          <div className="product-price-large">{product.priceDisplay}</div>

          <div className={`stock-status ${product.available ? "in-stock" : "out-of-stock"}`}>
            {product.stock > 0 ? `${product.stock} units available` : "Out of stock"}
          </div>

          {product.description && (
            <div className="product-description">
              <p>{product.description}</p>
            </div>
          )}

          <div className="quantity-selector">
            <label>Quantity:</label>
            <div className="quantity-controls">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(product.stock, parseInt(e.target.value, 10) || 1)))}
                min="1"
                max={product.stock}
              />
              <button
                onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                disabled={quantity >= product.stock}
              >
                +
              </button>
            </div>
            {quantity > 1 && (
              <div className="total-preview">
                Total: ₹{((product.pricePaise * quantity) / 100).toLocaleString("en-IN")}
              </div>
            )}
          </div>

          <div className="action-buttons">
            <button
              className="add-to-cart-btn"
              onClick={addToCart}
              disabled={!product.available || adding || added}
            >
              {added ? (
                <>
                  <Check size={18} />
                  Added to Cart
                </>
              ) : adding ? (
                "Adding..."
              ) : (
                <>
                  <ShoppingCart size={18} />
                  Add to Cart
                </>
              )}
            </button>
            <button
              className="buy-now-btn"
              onClick={handleBuyNow}
              disabled={!product.available || adding}
            >
              <Zap size={18} />
              Buy Now
            </button>
            <button
              type="button"
              className={`save-btn ${saved ? "saved" : ""}`}
              onClick={toggleSave}
              disabled={savingSave}
              aria-label={saved ? "Remove from saved" : "Save for later"}
              title={saved ? "Saved" : "Save for later"}
            >
              <Heart size={18} fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>

          <div className="merchant-info">
            <h4>Sold by</h4>
            <p>{product.merchant.name}</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .product-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          margin-top: 24px;
        }

        .product-image-section {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .product-image {
          width: 100%;
          max-width: 400px;
          aspect-ratio: 1;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--line);
        }

        .product-info-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .product-price-large {
          font-size: 36px;
          font-weight: 700;
          color: var(--ink);
        }

        .stock-status {
          font-size: 14px;
          font-weight: 500;
        }

        .stock-status.in-stock {
          color: #4ade80;
        }

        .stock-status.out-of-stock {
          color: #ef4444;
        }

        .product-description {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
          padding: 16px;
          background: var(--panel);
          border-radius: 8px;
        }

        .quantity-selector {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .quantity-selector label {
          font-size: 14px;
          font-weight: 500;
        }

        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .quantity-controls button {
          width: 36px;
          height: 36px;
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--ink);
          font-size: 18px;
          cursor: pointer;
          border-radius: 4px;
        }

        .quantity-controls button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quantity-controls input {
          width: 60px;
          height: 36px;
          text-align: center;
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--ink);
          font-size: 14px;
          font-weight: 600;
        }

        .total-preview {
          font-size: 14px;
          color: var(--amber);
          font-weight: 600;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .add-to-cart-btn, .buy-now-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .add-to-cart-btn {
          background: var(--panel);
          border: 1px solid var(--line);
          color: var(--ink);
        }

        .add-to-cart-btn:hover:not(:disabled) {
          border-color: var(--amber);
        }

        .add-to-cart-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .buy-now-btn {
          background: var(--amber);
          color: var(--ink);
        }

        .buy-now-btn:hover:not(:disabled) {
          opacity: 0.9;
        }

        .buy-now-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .save-btn {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 18px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--panel);
          color: var(--ink);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .save-btn:hover:not(:disabled) {
          border-color: var(--amber);
          color: var(--amber);
        }

        .save-btn.saved {
          border-color: var(--amber);
          color: var(--amber);
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .merchant-info {
          padding: 16px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 8px;
        }

        .merchant-info h4 {
          font-size: 12px;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
        }

        .merchant-info p {
          font-weight: 600;
          color: var(--ink);
        }

        @media (max-width: 768px) {
          .product-detail-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
      `}</style>
    </div>
  );
}