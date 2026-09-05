"use client";

import { useEffect, useRef, useState } from "react";
import { Building, Mail, MapPin, Phone, Shield, Sparkles } from "lucide-react";

type MerchantProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryRadius: string | null;
  currency: string;
  timezone: string;
};

type Prediction = { place_id: string; description: string };

export default function MerchantProfilePage() {
  const [profile, setProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [locationQuery, setLocationQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [sessionToken] = useState(() => `${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local drafts for text fields: typing only updates these, never fires a
  // network request per keystroke. The save is debounced, and the input is
  // never disabled while saving so typing is never interrupted.
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const nameSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/merchant/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setNameDraft(data?.name ?? "");
          setPhoneDraft(data?.phone ?? "");
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  const searchLocation = (q: string) => {
    setLocationQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (q.trim().length < 3) {
      setPredictions([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/merchant/location?q=${encodeURIComponent(q)}&sessionToken=${sessionToken}`);
        if (res.ok) {
          const data = await res.json() as { predictions: Prediction[] };
          setPredictions(data.predictions || []);
        }
      } catch {
        // Ignore — user can retry typing
      }
    }, 350);
  };

  const selectLocation = async (prediction: Prediction) => {
    setResolvingLocation(true);
    setMessage(null);
    try {
      const res = await fetch("/api/merchant/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId: prediction.place_id, sessionToken: sessionToken }),
      });
      if (res.ok) {
        const data = await res.json() as { location: string; latitude: number; longitude: number };
        setProfile((prev) => (prev ? { ...prev, location: data.location, latitude: data.latitude, longitude: data.longitude } : prev));
        setMessage({ type: "success", text: "Location saved." });
      } else {
        setMessage({ type: "error", text: "Failed to save location." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setResolvingLocation(false);
      setLocationQuery("");
      setPredictions([]);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const updateProfile = async (updates: Partial<MerchantProfile>) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/merchant/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setMessage({ type: "success", text: "Profile saved." });
      } else {
        setMessage({ type: "error", text: "Failed to save profile." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleNameChange = (value: string) => {
    setNameDraft(value);
    if (nameSaveRef.current) clearTimeout(nameSaveRef.current);
    nameSaveRef.current = setTimeout(() => {
      if (value.trim() && value !== profile?.name) void updateProfile({ name: value });
    }, 600);
  };

  const handlePhoneChange = (value: string) => {
    setPhoneDraft(value);
    if (phoneSaveRef.current) clearTimeout(phoneSaveRef.current);
    phoneSaveRef.current = setTimeout(() => {
      if (value !== profile?.phone) void updateProfile({ phone: value });
    }, 600);
  };

  if (loading) {
    return (
      <div className="content">
        <div className="topbar">
          <div className="crumb">
            <span>WORKSPACE</span>
            <span>→</span>
            <strong>PROFILE</strong>
          </div>
        </div>
        <div className="page-head">
          <p className="eyebrow">MERCHANT PROFILE</p>
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="topbar">
        <div className="crumb">
          <span>WORKSPACE</span>
          <span>→</span>
          <strong>PROFILE</strong>
        </div>
      </div>
      <div className="page-head">
        <div>
          <p className="eyebrow">MERCHANT PROFILE</p>
          <h1>Your settings</h1>
          <p className="subhead">Manage your business information and preferences.</p>
        </div>
      </div>

      {message && (
        <div className={`notice ${message.type === "success" ? "" : "alert"}`}>
          <div className="notice-icon">{message.type === "success" ? <Shield size={16} /> : <Shield size={16} />}</div>
          <p>{message.text}</p>
        </div>
      )}

      <div className="section-heading">
        <p className="eyebrow">BUSINESS</p>
        <h2>Business information</h2>
      </div>

      <div className="input-block">
        <label>Business name</label>
        <div className="input-with-action">
          <input
            type="text"
            placeholder="Your business name"
            value={nameDraft}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          <span className="input-icon"><Building size={17} /></span>
        </div>
      </div>

      <div className="input-block">
        <label>Email</label>
        <div className="input-with-action">
          <input
            type="email"
            placeholder="contact@example.com"
            value={profile?.email ?? ""}
            disabled
          />
          <span className="input-icon"><Mail size={17} /></span>
        </div>
        <p className="input-hint">Email cannot be changed. Contact support to update.</p>
      </div>

      <div className="input-block">
        <label>Phone number</label>
        <div className="input-with-action">
          <input
            type="tel"
            placeholder="+91 98765 43210"
            value={phoneDraft}
            onChange={(e) => handlePhoneChange(e.target.value)}
          />
          <span className="input-icon"><Phone size={17} /></span>
        </div>
      </div>

      <div className="section-heading">
        <p className="eyebrow">LOCATION</p>
        <h2>Delivery and service area</h2>
      </div>

      <div className="input-block">
        <label>Location</label>
        {profile?.location && (
          <p className="input-hint" style={{ marginBottom: "8px" }}>
            Current: {profile.location}
            {profile.latitude == null && " (no coordinates yet — search below to enable delivery-distance estimates)"}
          </p>
        )}
        <div className="input-with-action">
          <input
            type="text"
            placeholder="Search for your business address..."
            value={locationQuery}
            onChange={(e) => searchLocation(e.target.value)}
            disabled={resolvingLocation}
          />
          <span className="input-icon"><MapPin size={17} /></span>
        </div>
        {predictions.length > 0 && (
          <div className="address-predictions" style={{ marginTop: "8px", border: "1px solid var(--line)", borderRadius: "6px", overflow: "hidden" }}>
            {predictions.map((p) => (
              <button
                type="button"
                key={p.place_id}
                onClick={() => selectLocation(p)}
                disabled={resolvingLocation}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "var(--panel)", border: "none", borderBottom: "1px solid var(--line)", color: "var(--ink)", fontSize: "13px", cursor: "pointer" }}
              >
                {p.description}
              </button>
            ))}
          </div>
        )}
        <p className="input-hint">Selecting an address here saves precise coordinates, used to estimate delivery cost on orders.</p>
      </div>

      <div className="input-block">
        <label>Delivery radius</label>
        <select
          value={profile?.deliveryRadius ?? ""}
          onChange={(e) => updateProfile({ deliveryRadius: e.target.value })}
          disabled={saving}
        >
          <option value="">Select delivery radius</option>
          <option value="local_pickup">Local pickup</option>
          <option value="5km">5 km radius</option>
          <option value="15km">15 km radius</option>
          <option value="nationwide">Nationwide</option>
        </select>
      </div>

      <div className="notice">
        <div className="notice-icon"><Sparkles size={16} /></div>
        <p>Your profile information helps AKUMA make better recommendations for your business.</p>
      </div>
    </div>
  );
}
