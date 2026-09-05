"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Loader, Mail } from "lucide-react";

type DemoAccount = {
  email: string;
  pin: string;
  name: string;
  accountType: "MERCHANT" | "CONSUMER";
  label: string;
};

export function PhoneOnboarding({ accountType, onComplete }: { accountType: "MERCHANT" | "CONSUMER"; onComplete?: (isComplete: boolean) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"name" | "email" | "otp">("name");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [shownCode, setShownCode] = useState("");

  // Built-in demo accounts, so a broken email provider can't block sign-in.
  useEffect(() => {
    let active = true;
    fetch("/api/auth/demo")
      .then((res) => (res.ok ? res.json() : { accounts: [] }))
      .then((data) => {
        if (active) setDemoAccounts(Array.isArray(data.accounts) ? data.accounts : []);
      })
      .catch(() => {
        /* demo login is optional — ignore */
      });
    return () => {
      active = false;
    };
  }, []);

  const finish = useCallback(
    (data: { onboardingComplete?: boolean; accountType?: "MERCHANT" | "CONSUMER" }) => {
      if (onComplete) {
        onComplete(Boolean(data.onboardingComplete));
        return;
      }
      const role = data.accountType ?? accountType;
      if (data.onboardingComplete) {
        router.push(role === "MERCHANT" ? "/dashboard" : "/shop");
      } else {
        router.push(`/onboarding?role=${role}`);
      }
    },
    [accountType, onComplete, router]
  );

  const verify = async (payload: { email: string; code: string; name: string; accountType: "MERCHANT" | "CONSUMER" }) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      finish(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError("Enter valid email address");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, accountType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      // A demo account returns its fixed PIN; a dev-mode send that couldn't be
      // delivered returns the generated code. Either way, show it.
      setShownCode(data.pin || data.devCode || "");
      setStep("otp");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = () => {
    if (!otp || otp.length < 4) {
      setError("Enter valid OTP");
      return;
    }
    return verify({ email, code: otp, name, accountType });
  };

  // One tap: no email is sent and no OTP is generated — the PIN is fixed.
  const handleDemoLogin = (account: DemoAccount) => {
    setEmail(account.email);
    setOtp(account.pin);
    setShownCode(account.pin);
    return verify({
      email: account.email,
      code: account.pin,
      name: name.trim() || account.name,
      accountType: account.accountType,
    });
  };

  const demoPanel = demoAccounts.length > 0 ? (
    <div className="demo-panel">
      <div className="demo-panel-head">
        <KeyRound size={11} /> Demo login
      </div>
      <p className="demo-panel-note">
        No email required — these accounts use a fixed PIN. Use one if the verification email doesn&apos;t arrive.
      </p>
      {demoAccounts.map((account) => (
        <button
          key={account.email}
          type="button"
          className="demo-account"
          onClick={() => handleDemoLogin(account)}
          disabled={loading}
        >
          <span className="demo-account-id">
            <strong>{account.label}</strong>
            <span>{account.email}</span>
          </span>
          <span className="demo-account-pin">{account.pin}</span>
        </button>
      ))}
    </div>
  ) : null;

  if (step === "name") {
    return (
      <div className="onboarding-card">
        <h1>Welcome to AKUMA</h1>
        <p className="subhead">Let&apos;s get started. What&apos;s your name?</p>
        {error && <p className="error-text">{error}</p>}
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name && setStep("email")}
          placeholder="Full Name"
          className="input-field"
        />
        {accountType === "MERCHANT" && shownCode && (
          <div>
            <label style={{ display: "block", marginTop: "1rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Business Email (optional - can use demo)
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="business@example.com"
              className="input-field"
              style={{ marginTop: "0.5rem" }}
            />
          </div>
        )}
        <button
          className="primary-button"
          onClick={() => {
            if (!name) return;
            if (shownCode && email) {
              // Demo mode with editable fields - verify directly
              return verify({ email, code: shownCode, name, accountType });
            }
            setStep("email");
          }}
          disabled={!name}
        >
          Continue <ArrowRight size={16} />
        </button>
        {!shownCode && demoPanel}
      </div>
    );
  }

  if (step === "email") {
    return (
      <div className="onboarding-card">
        <h1>Email Verification</h1>
        <p className="subhead">Enter your email to receive verification code</p>
        {error && <p className="error-text">{error}</p>}
        <input
          autoFocus
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
          placeholder="you@example.com"
          className="input-field"
        />
        <button
          className="primary-button"
          onClick={handleSendOTP}
          disabled={loading || !email}
        >
          {loading ? <Loader size={16} className="spin" /> : <Mail size={16} />}
          Send Verification Code
        </button>
        {demoPanel}
        <button className="skip-button" onClick={() => setStep("name")}>
          Back to name
        </button>
      </div>
    );
  }

  return (
    <div className="onboarding-card">
      <h1>Enter Verification Code</h1>
      <p className="subhead">We sent a code to {email}</p>
      {error && <p className="error-text">{error}</p>}
      {shownCode && (
        <p className="demo-code-hint">
          Use this code: <code>{shownCode}</code>
        </p>
      )}
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
        placeholder="6-digit code"
        maxLength={6}
        className="input-field"
      />
      <button
        className="primary-button"
        onClick={handleVerifyOTP}
        disabled={loading || !otp}
      >
        {loading ? <Loader size={16} className="spin" /> : null}
        Verify &amp; Continue
      </button>
      <button className="skip-button" onClick={() => setStep("email")}>
        Change email address
      </button>
    </div>
  );
}
