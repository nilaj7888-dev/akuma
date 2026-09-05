"use client";

import { useEffect, useState } from "react";
import { Shield, Smartphone, Sparkles, Store, User } from "lucide-react";

type Profile = {
  phone: string | null;
  orderContactConsent: boolean;
  marketingConsent: boolean;
  preferences: Record<string, unknown> | null;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/consumer/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  const updateProfile = async (updates: Partial<Profile>) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/consumer/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setMessage({ type: "success", text: "Settings saved." });
      } else {
        setMessage({ type: "error", text: "Failed to save settings." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="content">
        <div className="topbar">
          <div className="crumb">
            <span>SHOP</span>
            <span>→</span>
            <strong>PROFILE</strong>
          </div>
        </div>
        <div className="page-head">
          <p className="eyebrow">CONSUMER PROFILE</p>
          <h1>Loading...</h1>
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
          <strong>PROFILE</strong>
        </div>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">CONSUMER PROFILE</p>
          <h1>Your settings</h1>
          <p className="subhead">Manage your contact preferences and privacy.</p>
        </div>
      </div>

      {message && (
        <div className={`notice ${message.type === "success" ? "" : "alert"}`}>
          <div className="notice-icon">{message.type === "success" ? <Shield size={16} /> : <Shield size={16} />}</div>
          <p>{message.text}</p>
        </div>
      )}

      <div className="section-heading">
        <p className="eyebrow">CONTACT</p>
        <h2>Phone & notifications</h2>
      </div>

      <div className="input-block">
        <label>Phone number</label>
        <div className="input-with-action">
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={profile?.phone ?? ""}
            onChange={(e) => updateProfile({ phone: e.target.value })}
            disabled={saving}
          />
          <span className="input-icon"><Smartphone size={17} /></span>
        </div>
        <p className="input-hint">Used for order updates only. Never shared publicly.</p>
      </div>

      <div className="section-heading">
        <p className="eyebrow">PRIVACY</p>
        <h2>Contact consent</h2>
      </div>

      <div className="input-block">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={profile?.orderContactConsent ?? false}
            onChange={(e) => updateProfile({ orderContactConsent: e.target.checked })}
            disabled={saving}
          />
          <span className="checkbox-custom" />
          <div>
            <strong>Order contact</strong>
            <p>Merchants can contact you about your orders (shipping, delivery, support).</p>
          </div>
        </label>
      </div>

      <div className="input-block">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={profile?.marketingConsent ?? false}
            onChange={(e) => updateProfile({ marketingConsent: e.target.checked })}
            disabled={saving}
          />
          <span className="checkbox-custom" />
          <div>
            <strong>Marketing updates</strong>
            <p>Receive promotional offers and new product announcements.</p>
          </div>
        </label>
      </div>

      <div className="notice">
        <div className="notice-icon"><Sparkles size={16} /></div>
        <p>Your preferences are stored securely and shared only with merchants after you place an order, and only if you&apos;ve given consent.</p>
      </div>
    </div>
  );
}