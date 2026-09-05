"use client";

import {
  ArrowRight,
  Bot,
  Building2,
  CreditCard,
  DollarSign,
  Gauge,
  Layers,
  MapPin,
  MessageSquare,
  Package,
  Percent,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useRouter } from "next/navigation";

const loopSteps = [
  { label: "Understand", icon: Sparkles, desc: "AI reads buyer intent and merchant inventory" },
  { label: "Match", icon: Zap, desc: "Connects demand signals to supply" },
  { label: "Recommend", icon: Target, desc: "Surfaces the best opportunities for both sides" },
  { label: "Negotiate", icon: MessageSquare, desc: "Facilitates bounded price negotiation" },
  { label: "Purchase", icon: CreditCard, desc: "Verified, secure checkout" },
  { label: "Measure", icon: Gauge, desc: "Tracks outcomes to improve future matches" },
];

export function LandingScreen() {
  const router = useRouter();

  const heroRef = useRef(null);
  const whatRef = useRef(null);
  const loopRef = useRef(null);
  const roleRef = useRef(null);

  const heroInView = useInView(heroRef, { once: true });
  const whatInView = useInView(whatRef, { once: true, margin: "-80px" });
  const loopInView = useInView(loopRef, { once: true, margin: "-60px" });
  const roleInView = useInView(roleRef, { once: true, margin: "-60px" });

  const scrollToRoles = () => {
    document.getElementById("role-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleBrandClick = () => router.push("/");

  return (
    <main className="landing-shell">
      {/* Intro splash - always rendered but hidden after animation */}
      <motion.div
        className="landing-intro"
        aria-hidden="true"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 2.3, duration: 0.5 }}
      >
        <motion.div
          className="landing-intro-mark"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          A
        </motion.div>
        <motion.strong
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          AKUMA
        </motion.strong>
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          AI-powered commerce intelligence
        </motion.span>
      </motion.div>

      <div className="landing-bg-texture" />
      <div className="landing-orb orb-1" />
      <div className="landing-orb orb-2" />

      {/* ─── Header ─── */}
      <header className="landing-header">
        <motion.div
          className="brand"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          onClick={handleBrandClick}
          style={{ cursor: "pointer" }}
        >
          <span className="brand-mark">A</span>
          <span>AKUMA</span>
        </motion.div>
        <motion.button
          className="get-started-btn"
          onClick={scrollToRoles}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Get Started <ArrowRight size={14} />
        </motion.button>
      </header>

      {/* ─── Hero ─── */}
      <section className="landing-hero" ref={heroRef}>
        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, y: 10 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <span className="pulse-dot" /> AI-powered commerce intelligence
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Where <span className="gradient-text">merchants</span> meet{" "}
          <span className="gradient-text">buyers</span>
        </motion.h1>

        <motion.p
          className="hero-description"
          initial={{ opacity: 0, y: 15 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          AKUMA is an AI commerce agent that connects merchants and customers in
          one intelligent marketplace. The merchant gets more opportunities to
          sell. The buyer gets a smarter way to find, compare and buy.
        </motion.p>

        <motion.button
          className="get-started-btn hero-cta"
          onClick={scrollToRoles}
          initial={{ opacity: 0, y: 10 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.3 }}
          whileHover={{ scale: 1.04, boxShadow: "0 0 30px rgba(233,168,93,0.4)" }}
          whileTap={{ scale: 0.97 }}
        >
          Get Started <ArrowRight size={16} />
        </motion.button>
      </section>

      {/* ─── What is AKUMA ─── */}
      <section className="starter-what" ref={whatRef}>
        <motion.div
          className="starter-what-inner"
          initial={{ opacity: 0, y: 30 }}
          animate={whatInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <p className="eyebrow">WHAT IS AKUMA?</p>
          <h2>An AI layer connecting commerce demand and supply</h2>
          <p className="starter-what-copy">
            AKUMA is not just a chatbot or online store. It is an AI layer that
            understands what buyers want, what merchants offer, and intelligently
            connects the two — creating verified transactions with measurable
            outcomes.
          </p>
        </motion.div>

        {/* ─── Benefits grid ─── */}
        <motion.div
          className="benefits-grid"
          initial={{ opacity: 0, y: 25 }}
          animate={whatInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Merchant card */}
          <div className="benefit-card merchant">
            <div className="benefit-icon">
              <Store size={22} />
            </div>
            <h3>For Merchants</h3>
            <ul>
              <li><Users size={14} /> Understand your customers deeply</li>
              <li><TrendingUp size={14} /> Find revenue opportunities</li>
              <li><Search size={14} /> Discover buyer demand signals</li>
              <li><DollarSign size={14} /> Improve pricing strategies</li>
              <li><Target size={14} /> Recover lost sales</li>
              <li><Package size={14} /> Manage products &amp; inventory</li>
              <li><MessageSquare size={14} /> Negotiate with buyers within policy</li>
              <li><Sparkles size={14} /> Grow revenue with AI insights</li>
            </ul>
          </div>

          {/* Buyer card */}
          <div className="benefit-card buyer">
            <div className="benefit-icon">
              <Bot size={22} />
            </div>
            <h3>For Buyers</h3>
            <ul>
              <li><MessageSquare size={14} /> Describe what you need naturally</li>
              <li><Sparkles size={14} /> AI understands your requirements</li>
              <li><Search size={14} /> Discover the right products</li>
              <li><Layers size={14} /> Compare options &amp; prices</li>
              <li><MapPin size={14} /> Find relevant local merchants</li>
              <li><Percent size={14} /> Negotiate where allowed</li>
              <li><ShoppingCart size={14} /> Checkout &amp; purchase through AKUMA</li>
            </ul>
          </div>
        </motion.div>
      </section>

      {/* ─── Core AKUMA Loop ─── */}
      <section className="starter-loop" ref={loopRef}>
        <motion.div
          className="starter-loop-header"
          initial={{ opacity: 0, y: 20 }}
          animate={loopInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="eyebrow">THE AKUMA LOOP</p>
          <h2>How AKUMA works</h2>
          <p className="starter-loop-copy">
            Every interaction flows through a continuous intelligence cycle.
          </p>
        </motion.div>

        <div className="loop-steps">
          {loopSteps.map((s, i) => (
            <motion.div
              key={s.label}
              className="loop-step"
              initial={{ opacity: 0, y: 20 }}
              animate={loopInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
            >
              <div className="loop-step-icon">
                <s.icon size={20} />
              </div>
              <strong>{s.label}</strong>
              <p>{s.desc}</p>
              {i < loopSteps.length - 1 && (
                <span className="loop-arrow">
                  <ArrowRight size={14} />
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── Role Selection / CTA ─── */}
      <section className="role-selection-section" id="role-section" ref={roleRef}>
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          animate={roleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          Get Started with AKUMA
        </motion.h2>
        <motion.p
          className="role-section-sub"
          initial={{ opacity: 0 }}
          animate={roleInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          Choose your role to begin.
        </motion.p>

        <motion.div
          className="role-cards-row"
          initial={{ opacity: 0, y: 20 }}
          animate={roleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <motion.button
            className="role-select-card"
            onClick={() => router.push("/auth/phone?role=MERCHANT")}
            whileHover={{ y: -6, boxShadow: "0 20px 50px rgba(233,168,93,0.25)" }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="role-select-icon">
              <Building2 size={28} />
            </div>
            <h3>I&apos;m a Merchant</h3>
            <p>List products, get AI insights, find customers, increase sales</p>
            <div className="role-select-cta">
              Continue as Merchant <ArrowRight size={16} />
            </div>
          </motion.button>

          <motion.button
            className="role-select-card consumer"
            onClick={() => router.push("/auth/phone?role=CONSUMER")}
            whileHover={{ y: -6, boxShadow: "0 20px 50px rgba(123,212,163,0.25)" }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="role-select-icon consumer">
              <Bot size={28} />
            </div>
            <h3>I&apos;m a Buyer</h3>
            <p>Find products, compare prices, negotiate, purchase securely</p>
            <div className="role-select-cta">
              Continue as Buyer <ArrowRight size={16} />
            </div>
          </motion.button>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="footer-brand" onClick={handleBrandClick} style={{ cursor: "pointer" }}>
          <span className="brand-mark">A</span>
          <span>AKUMA</span>
        </div>
        <span className="footer-tagline">
          AI proposes. Policy decides. You stay in control.
        </span>
        <span className="footer-credit">Designed &amp; Integrated by Nilaj Kundu</span>
      </footer>
    </main>
  );
}