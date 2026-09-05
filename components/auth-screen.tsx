"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, LockKeyhole, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Shake, SuccessCheckmark } from "@/components/ui/animations";

export function AuthScreen({ onAuthenticated, skipToRole }: { onAuthenticated: (user: { name: string; role: "MERCHANT" | "BUYER" }) => void; skipToRole?: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("nilaj123");
  const [password, setPassword] = useState("akuma-demo-password");
  const [roleStep, setRoleStep] = useState(skipToRole ?? false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google");
      if (res.status === 503) {
        const data = await res.json();
        setError(data.error?.message ?? "Google sign-in is not configured.");
        setBusy(false);
      } else {
        window.location.href = "/api/auth/google";
      }
    } catch {
      window.location.href = "/api/auth/google";
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
        credentials: "same-origin"
      });
      const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) {
        setError(result?.error?.message ?? "Unable to sign in. Please check the server and try again.");
        return;
      }
      setShowSuccess(true);
      setTimeout(() => setRoleStep(true), 1000);
    } catch {
      setError("Unable to reach AKUMA. Make sure the development server is running.");
    } finally {
      setBusy(false);
    }
  };

  const selectRole = async (role: "MERCHANT" | "BUYER") => {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, field: "role_init", value: role, complete: false })
      });
    } catch { }
    onAuthenticated({ name: "Nilaj", role });
  };

  // Role selection screen with animations
  if (roleStep) {
    return (
      <main className="auth-shell">
        <motion.div
          className="role-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="brand"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => router.push("/")}
            style={{ cursor: "pointer" }}
          >
            <span className="brand-mark">A</span>
            <span>AKUMA</span>
          </motion.div>

          <motion.p
            className="eyebrow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            ONE LAST STEP
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            How will you use AKUMA?
          </motion.h1>

          <motion.p
            className="role-copy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            Choose the workspace you want to open.
          </motion.p>

          <motion.div
            className="role-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4, staggerChildren: 0.1 }}
          >
            <motion.button
              className="role-card"
              onClick={() => selectRole("MERCHANT")}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(233, 168, 93, 0.15)" }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="role-icon">🏪</span>
              <strong>Merchant</strong>
              <p>Grow your business with AI</p>
              <small>Find customers · Increase sales · Manage products · Track revenue</small>
              <motion.span
                className="role-cta"
                initial={{ x: 0 }}
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                Continue as Merchant <ArrowRight size={15} />
              </motion.span>
            </motion.button>

            <motion.button
              className="role-card"
              onClick={() => selectRole("BUYER")}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              whileHover={{ y: -8, boxShadow: "0 20px 40px rgba(123, 212, 163, 0.15)" }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="role-icon">🛍️</span>
              <strong>Buyer</strong>
              <p>Find and buy products with AI</p>
              <small>Discover products · Compare prices · Negotiate · Checkout securely</small>
              <motion.span
                className="role-cta"
                initial={{ x: 0 }}
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                Continue as Buyer <ArrowRight size={15} />
              </motion.span>
            </motion.button>
          </motion.div>

          <motion.button
            className="back-to-landing"
            onClick={() => router.push("/")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            Back to home
          </motion.button>
        </motion.div>
      </main>
    );
  }

  // Login screen with animations
  return (
    <main className="auth-shell">
      <div className="auth-grid">
        <motion.section
          className="auth-brand"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="brand"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <span className="brand-mark">A</span>
            <span>AKUMA</span>
          </motion.div>

          <motion.div
            className="auth-hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <p className="eyebrow">AI SALES AGENT / 01</p>
            <h1>
              Commerce,<br />
              <motion.em
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="gradient-text"
              >
                powered by agents.
              </motion.em>
            </h1>
            <p>Connect buyer intent to merchant inventory, negotiate within boundaries, and turn every verified transaction into momentum.</p>

            <motion.div
              className="auth-signal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Sparkles size={15} /> Intelligence
              </motion.span>
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
              >
                <LockKeyhole size={15} /> Bounded by policy
              </motion.span>
            </motion.div>
          </motion.div>

          <motion.small
            className="auth-foot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.4 }}
          >
            AKUMA / autonomous commerce intelligence
          </motion.small>
        </motion.section>

        <motion.section
          className="auth-panel"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="auth-panel-inner">
            <motion.p
              className="eyebrow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              WELCOME BACK
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              Sign in to AKUMA
            </motion.h2>

            <motion.p
              className="auth-copy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              Your merchant command center is waiting.
            </motion.p>

            <motion.button
              type="button"
              onClick={handleGoogle}
              className="google-button"
              disabled={busy}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              whileHover={{ scale: 1.02, borderColor: '#36393d' }}
              whileTap={{ scale: 0.98 }}
            >
              <Globe2 size={17} /> Continue with Google
            </motion.button>

            <motion.div
              className="divider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              <span>or continue with username</span>
            </motion.div>

            <motion.form
              onSubmit={submit}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <label htmlFor="username">Username</label>
                <motion.input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  required
                  whileFocus={{ borderColor: '#e9a85d', boxShadow: '0 0 0 3px rgba(160, 113, 61, 0.15)' }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <label htmlFor="password">Password</label>
                <motion.input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  whileFocus={{ borderColor: '#e9a85d', boxShadow: '0 0 0 3px rgba(160, 113, 61, 0.15)' }}
                />
              </motion.div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    className="auth-error"
                    role="alert"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.div
                className="remember"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <label>
                  <input type="checkbox" defaultChecked /> <span>Remember me</span>
                </label>
                <button type="button" disabled title="Password recovery is disabled for demo accounts">
                  Forgot password?
                </button>
              </motion.div>

              <motion.button
                className="auth-submit glow-amber"
                disabled={busy || showSuccess}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <AnimatePresence mode="wait">
                  {showSuccess ? (
                    <motion.span
                      key="success"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <SuccessCheckmark size={16} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {busy ? "Signing in..." : "Sign in"}
                      <ArrowRight size={16} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.form>

            <motion.p
              className="demo-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.4 }}
            >
              Demo account: <strong>nilaj123</strong> / <strong>akuma-demo-password</strong>
            </motion.p>

            <motion.p
              className="auth-switch"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.4 }}
            >
              New to AKUMA? <button type="button" disabled title="Registration is closed for the beta">
                Create an account
              </button>
            </motion.p>
          </div>
        </motion.section>
      </div>
    </main>
  );
}