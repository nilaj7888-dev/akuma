"use client";

import { ArrowRight, Bot, CircleDollarSign, LockKeyhole, Package, Sparkles, Store } from "lucide-react";
import { useEffect, useState } from "react";

export function LandingScreen({ onStart }: { onStart: () => void }) {
  const [introVisible, setIntroVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setIntroVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className="landing-shell">
    {introVisible && <div className="landing-intro" aria-hidden="true"><div className="landing-intro-mark">A</div><strong>AKUMA</strong><span>merchant <i /> AI <i /> customer <i /> commerce</span></div>}
    <header className="landing-nav"><div className="brand"><span className="brand-mark">A</span><span>AKUMA</span></div><button className="landing-login" onClick={onStart}>Sign in <ArrowRight size={14} /></button></header>
    <section className="landing-hero"><div className="landing-kicker"><span className="live-dot" /> AI COMMERCE, BOUNDED BY TRUST</div><h1>Commerce that thinks<br /><em>in both directions.</em></h1><p>AKUMA helps businesses find their next best move and helps customers find what fits. One intelligent layer from product discovery to verified payment.</p><button className="landing-cta" onClick={onStart}>Get started <ArrowRight size={17} /></button><div className="landing-flow"><span>MERCHANT</span><ArrowRight size={15} /><span className="flow-active">AKUMA</span><ArrowRight size={15} /><span>CUSTOMER</span><ArrowRight size={15} /><span>GROWTH</span></div></section>
    <section className="landing-sides"><article><div className="landing-icon"><Store size={18} /></div><p className="eyebrow">FOR MERCHANTS</p><h2>Find the signal<br />inside your store.</h2><p>Connect your catalog, understand what buyers do next, and let AI propose growth actions that stay inside your policies.</p><ul><li><Package size={15} /> Connect products and commerce data</li><li><Sparkles size={15} /> Discover evidence-backed opportunities</li><li><LockKeyhole size={15} /> Set boundaries before AI acts</li></ul></article><article><div className="landing-icon consumer"><Bot size={18} /></div><p className="eyebrow">FOR CUSTOMERS</p><h2>Say what you want.<br />AKUMA gets specific.</h2><p>Search a trusted catalog, get useful recommendations, negotiate where permitted, and checkout with confidence.</p><ul><li><Sparkles size={15} /> Describe intent naturally</li><li><Package size={15} /> Compare real products and stock</li><li><CircleDollarSign size={15} /> Pay through a verified flow</li></ul></article></section>
    <footer className="landing-footer"><span>AKUMA / autonomous commerce intelligence</span><span>AI proposes. Policy decides. You stay in control.</span></footer>
  </main>;
}
