"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe2, LockKeyhole, Sparkles } from "lucide-react";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: { name: string; role: "MERCHANT" | "BUYER" }) => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("nilaj123");
  const [password, setPassword] = useState("akuma-demo-password");
  const [roleStep, setRoleStep] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const handleGoogle = async () => {
    setBusy(true); setError("");
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
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: username.trim(), password }), credentials: "same-origin" });
      const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) { setError(result?.error?.message ?? "Unable to sign in. Please check the server and try again."); return; }
      setRoleStep(true);
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

  if (roleStep) return <main className="auth-shell"><div className="role-screen"><div className="brand"><span className="brand-mark">A</span><span>AKUMA</span></div><p className="eyebrow">ONE LAST STEP</p><h1>How will you use AKUMA?</h1><p className="role-copy">Choose the workspace you want to open. You can change this later.</p><div className="role-grid"><button className="role-card" onClick={() => selectRole("MERCHANT")}><span className="role-icon">🏪</span><strong>Merchant</strong><p>Grow your business with AI</p><small>Find customers · Increase sales · Manage products · Track revenue</small><span className="role-cta">Continue as Merchant <ArrowRight size={15} /></span></button><button className="role-card" onClick={() => selectRole("BUYER")}><span className="role-icon">🛍️</span><strong>Buyer</strong><p>Find and buy products with AI</p><small>Discover products · Compare prices · Negotiate · Checkout securely</small><span className="role-cta">Continue as Buyer <ArrowRight size={15} /></span></button></div></div></main>;
  return <main className="auth-shell"><div className="auth-grid"><section className="auth-brand"><div className="brand"><span className="brand-mark">A</span><span>AKUMA</span></div><div className="auth-hero"><p className="eyebrow">AI SALES AGENT / 01</p><h1>Commerce,<br /><em>powered by agents.</em></h1><p>Connect buyer intent to merchant inventory, negotiate within boundaries, and turn every verified transaction into momentum.</p><div className="auth-signal"><span><Sparkles size={15} /> Intelligence</span><span><LockKeyhole size={15} /> Bounded by policy</span></div></div><small className="auth-foot">AKUMA / autonomous commerce intelligence</small></section><section className="auth-panel"><div className="auth-panel-inner"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to AKUMA</h2><p className="auth-copy">Your merchant command center is waiting.</p><button type="button" onClick={handleGoogle} className="google-button" disabled={busy} title="Continue with Google"><Globe2 size={17} /> Continue with Google</button><div className="divider"><span>or continue with username</span></div><form onSubmit={submit}><label htmlFor="username">Username</label><input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />{error && <p className="auth-error" role="alert">{error}</p>}<div className="remember"><label><input type="checkbox" defaultChecked /> <span>Remember me</span></label><button type="button" disabled title="Password recovery is disabled for demo accounts">Forgot password?</button></div><button className="auth-submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}<ArrowRight size={16} /></button></form><p className="demo-hint">Demo account: <strong>nilaj123</strong> / <strong>akuma-demo-password</strong></p><p className="auth-switch">New to AKUMA? <button type="button" disabled title="Registration is closed for the beta">Create an account</button></p></div></section></div></main>;
}
