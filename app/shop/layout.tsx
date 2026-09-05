"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Bot, Home, LogOut, Package, Search, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { BrandReset, resetAkumaState } from "@/components/brand-reset";
import { NegotiationBanner } from "@/components/negotiation-banner";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; accountType?: "MERCHANT" | "CONSUMER" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    // Get or create tab-specific demo identity
    const getTabId = () => {
      let tabId = sessionStorage.getItem("akuma_tab_id");
      if (!tabId) {
        tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem("akuma_tab_id", tabId);
      }
      return tabId;
    };

    const init = async () => {
      try {
        const tabId = getTabId();
        const authRes = await fetch("/api/auth/me");
        const authData = await authRes.json() as { user: { name: string; accountType?: "MERCHANT" | "CONSUMER" } | null };
        if (!authData.user) {
          router.push("/");
          return;
        }
        if (authData.user.accountType === "MERCHANT") {
          // Store merchant identity for this tab
          sessionStorage.setItem(`akuma_demo_role_${tabId}`, "MERCHANT");
          router.push("/dashboard");
          return;
        }
        // Store consumer identity for this tab
        sessionStorage.setItem(`akuma_demo_role_${tabId}`, "CONSUMER");
        setUser(authData.user);
        setLoading(false);
      } catch {
        router.push("/");
      }
    };
    void init();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const fetchCartCount = async () => {
      try {
        const res = await fetch("/api/consumer/cart");
        if (res.ok) {
          const data = await res.json() as { items?: unknown[] };
          setCartCount(data.items?.length || 0);
        }
      } catch {
        // Silent fail
      }
    };

    fetchCartCount();
    const interval = setInterval(fetchCartCount, 5000);
    return () => clearInterval(interval);
  }, [user]);

  if (loading) return <main className="auth-loading"><span className="brand-mark">A</span><p>Securing your shopping session...</p></main>;

  return (
    <main className="shell">
      <aside className="sidebar">
        <BrandReset />
        <div className="workspace">
          <span className="avatar">CS</span>
          <div><strong>Consumer Space</strong><small>Shop with confidence</small></div>
          <ArrowRight size={15} />
        </div>
        <nav>
          <p className="nav-label">DISCOVER</p>
          <Link href="/shop" className="nav-link"><Home size={17} /> Shop Home</Link>
          <Link href="/shop/discover" className="nav-link"><Search size={17} /> Discover</Link>
          <Link href="/shop/ask" className="nav-link"><Bot size={17} /> Ask AKUMA</Link>
          <Link href="/shop/cart" className="nav-link"><ShoppingCart size={17} /> Cart <b>{cartCount}</b></Link>
          <p className="nav-label lower">ACCOUNT</p>
          <Link href="/shop/orders" className="nav-link"><Package size={17} /> Orders</Link>
          <Link href="/shop/profile" className="nav-link"><User size={17} /> Profile</Link>
        </nav>
        <div className="system">
          <div className="system-head"><span>System status</span><span className="live-dot">● Operational</span></div>
          <div className="health"><span>Catalog</span><i>Nova Electronics</i></div>
          <div className="health"><span>Payments</span><i>Secure</i></div>
          <div className="health"><span>Agent</span><i>Ready</i></div>
        </div>
        <div className="profile" onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          resetAkumaState("/");
        }} style={{ cursor: "pointer" }}>
          <span className="avatar user">{user?.name?.slice(0, 2).toUpperCase() || "CS"}</span>
          <div><strong>{user?.name || "Consumer"}</strong><small>Consumer</small></div>
          <LogOut size={16} />
        </div>
      </aside>
      {children}
      <NegotiationBanner role="CONSUMER" />
    </main>
  );
}