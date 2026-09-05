"use client";

import { useEffect, useState } from "react";
import { Search, Package, Heart, Check, Sparkles } from "lucide-react";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  category: string;
  pricePaise: number;
  priceDisplay: string;
  stock: number;
  available: boolean;
  description: string;
  merchantName: string;
};

type MatchProduct = Product & {
  matchScore?: number;
  matchReasons?: string[];
};

export default function DiscoverPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [matches, setMatches] = useState<MatchProduct[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProducts();
  }, [search, category]);

  // Simple polling to refresh products every 10 seconds
  // This ensures newly added merchant products appear without manual refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProducts();
    }, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [search, category]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (category) params.set("category", category);
      params.set("limit", "50");
      // Ask the catalog for this buyer's personalized matches too.
      params.set("matches", "1");

      const res = await fetch(`/api/consumer/catalog/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setMatches(data.matches || []);

        // Extract unique categories
        const cats = [...new Set((data.products || []).map((p: Product) => p.category))] as string[];
        setCategories(cats);
      } else {
        setError("Failed to load products");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill which products are already saved so the heart shows filled.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/consumer/wishlist?limit=50");
        if (res.ok) {
          const data = await res.json();
          const ids = (data.wishlist || []).map((w: { productId: string }) => w.productId);
          setSavedIds(new Set(ids));
        }
      } catch {
        /* non-blocking */
      }
    })();
  }, []);

  const toggleSave = async (product: Product) => {
    if (savingId) return;
    setSavingId(product.id);
    const alreadySaved = savedIds.has(product.id);
    try {
      const res = await fetch("/api/consumer/wishlist", {
        method: alreadySaved ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(alreadySaved ? { productId: product.id } : { productId: product.id, name: product.name }),
      });
      if (res.ok) {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (alreadySaved) next.delete(product.id);
          else next.add(product.id);
          return next;
        });
      }
    } catch {
      /* non-blocking */
    } finally {
      setSavingId(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const renderCard = (product: MatchProduct, isMatch = false) => {
    const saved = savedIds.has(product.id);
    return (
      <div key={`${isMatch ? "m" : "p"}-${product.id}`} className="product-card">
        <button
          type="button"
          className={`save-btn ${saved ? "saved" : ""}`}
          aria-label={saved ? "Remove from saved" : "Save product"}
          title={saved ? "Saved" : "Save"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSave(product);
          }}
          disabled={savingId === product.id}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
        </button>
        <Link href={`/shop/products/${product.id}`} className="card-link">
          <div className="product-image">
            <Package size={48} />
          </div>
          <div className="product-info">
            <div className="product-category">{product.category}</div>
            <div className="product-name">{product.name}</div>
            <div className="product-merchant">{product.merchantName}</div>
            {isMatch && product.matchReasons && product.matchReasons.length > 0 && (
              <div className="match-reasons">
                <Check size={11} /> {product.matchReasons.slice(0, 2).join(" • ")}
              </div>
            )}
            <div className="product-footer">
              <div className="product-price">{product.priceDisplay}</div>
              <div className={`product-stock ${product.available ? "in-stock" : "out-of-stock"}`}>
                {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  return (
    <div className="content">
      <div className="topbar">
        <div className="crumb">
          <span>SHOP</span>
          <span>→</span>
          <strong>DISCOVER</strong>
        </div>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">CATALOG</p>
          <h1>Discover products</h1>
          <p className="subhead">Browse the merchant catalog and find what you need.</p>
        </div>
      </div>

      <div className="discover-filters">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="search-input"
            />
          </div>
        </form>

        <div className="category-filters">
          <button
            className={`filter-chip ${!category ? "active" : ""}`}
            onClick={() => setCategory("")}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-chip ${category === cat ? "active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="notice alert">
          <p>{error}</p>
        </div>
      )}

      {!loading && matches.length > 0 && (
        <section className="matches-section">
          <div className="matches-head">
            <Sparkles size={16} />
            <h2>Matched to your requirements</h2>
          </div>
          <p className="matches-sub">Products AKUMA matched to what you said you&apos;re looking for.</p>
          <div className="product-grid">
            {matches.map((m) => renderCard(m, true))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="loading-grid">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="product-skeleton" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="notice">
          <div className="notice-icon"><Package size={16} /></div>
          <p>No products found. Try a different search or category.</p>
        </div>
      ) : (
        <>
          {matches.length > 0 && <h2 className="catalog-heading">Browse the full catalog</h2>}
          <div className="product-grid">
            {products.map((product) => renderCard(product))}
          </div>
        </>
      )}

      <style jsx>{`
        .discover-filters {
          margin-bottom: 24px;
        }

        .search-form {
          margin-bottom: 16px;
        }

        .search-input-wrapper {
          position: relative;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
        }

        .search-input {
          width: 100%;
          padding: 12px 12px 12px 40px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--panel);
          color: var(--ink);
          font-size: 14px;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--amber);
        }

        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .filter-chip {
          padding: 6px 12px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: var(--panel);
          color: var(--muted);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .filter-chip:hover {
          border-color: var(--amber);
          color: var(--ink);
        }

        .filter-chip.active {
          background: var(--amber);
          border-color: var(--amber);
          color: var(--ink);
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }

        .loading-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 16px;
        }

        .product-skeleton {
          height: 280px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 8px;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .product-card {
          position: relative;
          border: 1px solid var(--line);
          border-radius: 8px;
          overflow: hidden;
          background: var(--panel);
          transition: all 0.2s;
        }

        .product-card:hover {
          border-color: var(--amber);
          transform: translateY(-2px);
        }

        .card-link {
          display: block;
          text-decoration: none;
          color: inherit;
        }

        .save-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 2;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--line);
          border-radius: 50%;
          background: var(--panel);
          color: var(--muted);
          cursor: pointer;
          transition: all 0.15s;
        }

        .save-btn:hover {
          border-color: var(--amber);
          color: var(--amber);
        }

        .save-btn.saved {
          color: var(--amber);
          border-color: var(--amber);
        }

        .save-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .matches-section {
          margin-bottom: 28px;
        }

        .matches-head {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--amber);
        }

        .matches-head h2 {
          font-size: 16px;
          font-weight: 700;
          color: var(--ink);
        }

        .matches-sub {
          font-size: 13px;
          color: var(--muted);
          margin: 4px 0 14px;
        }

        .catalog-heading {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 14px;
        }

        .match-reasons {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--amber);
          margin-bottom: 8px;
        }

        .product-image {
          height: 160px;
          background: var(--base);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--line);
        }

        .product-info {
          padding: 12px;
        }

        .product-category {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--amber);
          margin-bottom: 4px;
        }

        .product-name {
          font-weight: 600;
          font-size: 14px;
          color: var(--ink);
          margin-bottom: 4px;
          line-height: 1.3;
        }

        .product-merchant {
          font-size: 11px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .product-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .product-price {
          font-weight: 700;
          font-size: 16px;
          color: var(--ink);
        }

        .product-stock {
          font-size: 11px;
        }

        .product-stock.in-stock {
          color: #4ade80;
        }

        .product-stock.out-of-stock {
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}