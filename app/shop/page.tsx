"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bot, Package, Search, ShoppingCart, Sparkles } from "lucide-react";
import { AgentConsole } from "@/components/agent-console";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ShopPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [stats, setStats] = useState({ cart: 0, orders: 0, recommendations: 0 });
  const [greeting, setGreeting] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const init = async () => {
      const authRes = await fetch("/api/auth/me");
      const authData = await authRes.json() as { user: { name: string } | null };
      if (authData.user) setUser(authData.user);

      // Fetch real cart and order counts
      try {
        const [cartRes, ordersRes] = await Promise.all([
          fetch("/api/consumer/cart"),
          fetch("/api/consumer/orders"),
        ]);
        if (cartRes.ok) {
          const cartData = await cartRes.json() as { items?: unknown[] };
          setStats((s) => ({ ...s, cart: cartData.items?.length || 0 }));
        }
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json() as { orders?: unknown[] };
          setStats((s) => ({ ...s, orders: ordersData.orders?.length || 0 }));
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }

      const now = new Date();
      const hour = now.getHours();
      setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
      const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
      setDate(`${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`);
    };
    void init();
  }, []);

  const quickActions = [
    { icon: Search, label: "Search products", desc: "Find what you need", detail: "Search live merchant inventory", href: "/shop/discover" },
    { icon: Bot, label: "Ask AKUMA", desc: "Describe your intent", detail: "Chat with the AI shopping assistant", href: "/shop/ask" },
    { icon: ShoppingCart, label: "View cart", desc: `${stats.cart} items`, detail: stats.cart > 0 ? "Review your saved cart items" : "Your cart is currently empty", href: "/shop/cart" },
    { icon: Package, label: "Order history", desc: `${stats.orders} orders`, detail: stats.orders > 0 ? "Track your past purchases" : "No orders placed yet", href: "/shop/orders" },
  ];

  return (
    <div className="content">
      <div className="topbar">
        <div className="crumb">
          <span>CONSUMER</span>
          <ArrowRight size={14} />
          <strong>SHOP HOME</strong>
        </div>
        <div className="top-actions">
          <span className="mode">
            <span className="tiny-dot" />
            SHOPPING MODE
          </span>
          <ThemeToggle />
          <button className="icon-button" onClick={() => router.push("/shop/discover")}><Search size={17} /></button>
          <button className="icon-button" onClick={() => router.push("/shop/cart")}><ShoppingCart size={17} /></button>
        </div>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">{greeting}, {user?.name} <span>·</span> {date}</p>
          <h1>What are you looking for?</h1>
          <p className="subhead">AKUMA can search, compare, negotiate, and checkout—within merchant policy.</p>
        </div>
      </div>
      <div className="main-grid">
        <div>
          <div className="notice">
            <div className="notice-icon"><Sparkles size={16} /></div>
            <p>Describe your shopping intent naturally. AKUMA will search real inventory, compare prices, check availability, and handle negotiation where the merchant allows.</p>
            <div className="notice-status"><span className="live-dot">●</span> AGENT READY</div>
          </div>
          <div className="section-heading">
            <div>
              <p className="eyebrow">PRIMARY SHOPPING TOOL</p>
              <h2>Ask AKUMA</h2>
            </div>
          </div>
          <AgentConsole role="BUYER" />
        </div>
        <aside className="opportunity-panel">
          <div className="panel-top">
            <p className="eyebrow">QUICK ACTIONS</p>
          </div>
          {quickActions.map((action) => (
            <div key={action.label} className="action-preview" onClick={() => router.push(action.href)} style={{ cursor: 'pointer' }}>
              <div>
                <div className="preview-tag">{action.label.toUpperCase()}</div>
                <h4>{action.desc}</h4>
                <p>{action.detail}</p>
              </div>
              <action.icon size={20} />
            </div>
          ))}
          <div className="panel-actions">
            <button className="primary-button" onClick={() => router.push("/shop/discover")}>Browse catalog</button>
          </div>
        </aside>
      </div>
    </div>
  );
}