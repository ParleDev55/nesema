"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Save,
  Upload,
  User,
  Building2,
  Bell,
  CreditCard,
  ShieldAlert,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";

type Tab = "profile" | "practice" | "notifications" | "billing" | "account";

interface NotificationPrefs {
  new_booking: boolean;
  appointment_reminder: boolean;
  patient_checkin: boolean;
  new_message: boolean;
  lab_result_uploaded: boolean;
  payment_received: boolean;
}

const defaultNotifPrefs: NotificationPrefs = {
  new_booking: true,
  appointment_reminder: true,
  patient_checkin: true,
  new_message: true,
  lab_result_uploaded: true,
  payment_received: true,
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nesema-sage/40 ${
        checked ? "bg-nesema-sage" : "bg-nesema-bdr"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function PractitionerSettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Practice
  const [pracId, setPracId] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [bio, setBio] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [registrationBody, setRegistrationBody] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [sessionLength, setSessionLength] = useState(60);
  const [bufferMins, setBufferMins] = useState(10);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [allowsSelfBooking, setAllowsSelfBooking] = useState(true);
  const [bookingSlug, setBookingSlug] = useState("");
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);

  // Notifications
  const [notifPrefs, setNotifPrefs] =
    useState<NotificationPrefs>(defaultNotifPrefs);

  // Account
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, avatar_url")
        .eq("id", user.id)
        .single();

      const { data: prac } = await supabase
        .from("practitioners")
        .select(
          "id, practice_name, discipline, bio, registration_body, registration_number, session_length_mins, buffer_mins, cancellation_hours, allows_self_booking, booking_slug, stripe_account_id, notification_preferences"
        )
        .eq("profile_id", user.id)
        .single();

      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setEmail(profile.email ?? user.email ?? "");
        setAvatarUrl(profile.avatar_url ?? null);
      }
      if (prac) {
        setPracId(prac.id);
        setPracticeName(prac.practice_name ?? "");
        setBio(prac.bio ?? "");
        setDiscipline(prac.discipline ?? "");
        setRegistrationBody((prac as Record<string, unknown>).registration_body as string ?? "");
        setRegistrationNumber((prac as Record<string, unknown>).registration_number as string ?? "");
        setSessionLength(prac.session_length_mins ?? 60);
        setBufferMins(prac.buffer_mins ?? 10);
        setCancellationHours(prac.cancellation_hours ?? 24);
        setAllowsSelfBooking(prac.allows_self_booking ?? true);
        setBookingSlug(prac.booking_slug ?? "");
        setStripeAccountId(prac.stripe_account_id ?? null);
        if (prac.notification_preferences) {
          setNotifPrefs({
            ...defaultNotifPrefs,
            ...(prac.notification_preferences as Partial<NotificationPrefs>),
          });
        }
      }
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      const url = urlData.publicUrl;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      setAvatarUrl(url);
    }
    setAvatarUploading(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq("id", user.id);
    if (profileErr) {
      setError("Failed to save. Please try again.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleSavePractice(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    if (!pracId) return;
    const { error: pracErr } = await supabase
      .from("practitioners")
      .update({
        practice_name: practiceName.trim() || null,
        bio: bio.trim() || null,
        session_length_mins: sessionLength,
        buffer_mins: bufferMins,
        cancellation_hours: cancellationHours,
        allows_self_booking: allowsSelfBooking,
      })
      .eq("id", pracId);
    if (pracErr) {
      setError("Failed to save. Please try again.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleSaveNotifications(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    if (!pracId) return;
    const { error: notifErr } = await supabase
      .from("practitioners")
      .update({ notification_preferences: notifPrefs as unknown as import("@/types/database").Json })
      .eq("id", pracId);
    if (notifErr) {
      setError("Failed to save. Please try again.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);
    if (newPassword !== confirmPassword) {
      setPwError("New passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    const { error: pwErr } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (pwErr) {
      setPwError(pwErr.message);
    } else {
      setPwSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSaved(false), 3000);
    }
    setPwSaving(false);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push("/");
    } else {
      setDeleting(false);
      setShowDeleteModal(false);
      setError("Failed to delete account. Please contact support.");
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User size={15} /> },
    { id: "practice", label: "Practice", icon: <Building2 size={15} /> },
    { id: "notifications", label: "Notifications", icon: <Bell size={15} /> },
    { id: "billing", label: "Billing", icon: <CreditCard size={15} /> },
    { id: "account", label: "Account", icon: <ShieldAlert size={15} /> },
  ];

  const inputCls =
    "w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm bg-nesema-surf focus:outline-none focus:ring-2 focus:ring-nesema-sage/40 text-nesema-t1 placeholder:text-nesema-t4";
  const readonlyCls =
    "w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm bg-nesema-bg text-nesema-t3 cursor-not-allowed";
  const labelCls = "block text-xs text-nesema-t3 mb-1.5 font-medium";
  const cardCls = "rounded-2xl bg-nesema-surf border border-nesema-bdr p-6 space-y-5";
  const saveBtnCls =
    "inline-flex items-center gap-2 px-5 py-2.5 bg-nesema-sage text-white text-sm rounded-full disabled:opacity-50 hover:bg-nesema-sage-l transition-colors";

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-nesema-sage border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 bg-nesema-bg rounded-2xl p-1 border border-nesema-bdr overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setError(null); setSaved(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-1 justify-center ${
              activeTab === t.id
                ? "bg-nesema-surf text-nesema-sage shadow-sm border border-nesema-bdr"
                : "text-nesema-t3 hover:text-nesema-t2"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PROFILE ── */}
      {activeTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="space-y-6">
          <div className={cardCls}>
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-nesema-sage-p border border-nesema-bdr flex-shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={24} className="text-nesema-sage" />
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarUploading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-nesema-bdr rounded-full text-xs text-nesema-t2 hover:bg-nesema-bg transition-colors disabled:opacity-50"
                >
                  <Upload size={12} />
                  {avatarUploading ? "Uploading…" : "Upload photo"}
                </button>
                <p className="text-xs text-nesema-t4 mt-1">JPG or PNG, up to 2MB</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={email} readOnly className={readonlyCls} />
            </div>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}
          {saved && <p className="text-green-700 text-xs">Changes saved successfully.</p>}
          <button type="submit" disabled={saving} className={saveBtnCls}>
            <Save size={14} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}

      {/* ── PRACTICE ── */}
      {activeTab === "practice" && (
        <form onSubmit={handleSavePractice} className="space-y-6">
          <div className={cardCls}>
            <div>
              <label className={labelCls}>Practice name</label>
              <input
                type="text"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="A brief description of your practice and approach…"
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label className={labelCls}>Discipline</label>
              <input type="text" value={discipline} readOnly className={readonlyCls} />
              <p className="text-xs text-nesema-t4 mt-1">
                Contact{" "}
                <a href="mailto:support@nesema.com" className="underline hover:text-nesema-t2">
                  support@nesema.com
                </a>{" "}
                to change your discipline.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Registration body</label>
                <input type="text" value={registrationBody} readOnly className={readonlyCls} />
              </div>
              <div>
                <label className={labelCls}>Registration number</label>
                <input type="text" value={registrationNumber} readOnly className={readonlyCls} />
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Session length (mins)</label>
                <select
                  value={sessionLength}
                  onChange={(e) => setSessionLength(Number(e.target.value))}
                  className={inputCls}
                >
                  {[30, 45, 60, 75, 90, 120].map((v) => (
                    <option key={v} value={v}>{v} mins</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Buffer time (mins)</label>
                <select
                  value={bufferMins}
                  onChange={(e) => setBufferMins(Number(e.target.value))}
                  className={inputCls}
                >
                  {[0, 5, 10, 15, 20, 30].map((v) => (
                    <option key={v} value={v}>{v} mins</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Cancellation notice (hours)</label>
                <select
                  value={cancellationHours}
                  onChange={(e) => setCancellationHours(Number(e.target.value))}
                  className={inputCls}
                >
                  {[12, 24, 48, 72].map((v) => (
                    <option key={v} value={v}>{v}h</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium text-nesema-t1">Allow self-booking</p>
                <p className="text-xs text-nesema-t3">Patients can book directly via your booking link.</p>
              </div>
              <Toggle checked={allowsSelfBooking} onChange={setAllowsSelfBooking} />
            </div>

            <div>
              <label className={labelCls}>Your booking URL</label>
              <div className="flex items-center gap-2 rounded-xl bg-nesema-bg border border-nesema-bdr px-3 py-2">
                <span className="text-sm text-nesema-t3 select-all break-all">
                  nesema.com/book/{bookingSlug}
                </span>
              </div>
            </div>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}
          {saved && <p className="text-green-700 text-xs">Changes saved successfully.</p>}
          <button type="submit" disabled={saving} className={saveBtnCls}>
            <Save size={14} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}

      {/* ── NOTIFICATIONS ── */}
      {activeTab === "notifications" && (
        <form onSubmit={handleSaveNotifications} className="space-y-6">
          <div className={cardCls}>
            {(
              [
                { key: "new_booking", label: "New booking received", desc: "When a patient books a session" },
                { key: "appointment_reminder", label: "Appointment reminder", desc: "24 hours before each session" },
                { key: "patient_checkin", label: "Patient check-in submitted", desc: "When a patient completes a daily check-in" },
                { key: "new_message", label: "New message received", desc: "When a patient sends you a message" },
                { key: "lab_result_uploaded", label: "Lab result uploaded", desc: "When a new result is added to a patient's vault" },
                { key: "payment_received", label: "Payment received", desc: "When a patient completes a payment" },
              ] as { key: keyof NotificationPrefs; label: string; desc: string }[]
            ).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-nesema-t1">{label}</p>
                  <p className="text-xs text-nesema-t3">{desc}</p>
                </div>
                <Toggle
                  checked={notifPrefs[key]}
                  onChange={(v) => setNotifPrefs((p) => ({ ...p, [key]: v }))}
                />
              </div>
            ))}
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}
          {saved && <p className="text-green-700 text-xs">Preferences saved.</p>}
          <button type="submit" disabled={saving} className={saveBtnCls}>
            <Save size={14} />
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </form>
      )}

      {/* ── BILLING ── */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          <div className={cardCls}>
            <div>
              <p className="text-xs text-nesema-t3 uppercase tracking-widest font-semibold mb-1">Current plan</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-nesema-t1">Nesema Pro</p>
                  <p className="text-sm text-nesema-t2">£49 / month</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-nesema-sage-p text-nesema-sage text-xs font-semibold">
                  Active
                </span>
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <p className="text-xs text-nesema-t3 uppercase tracking-widest font-semibold mb-2">Stripe Connect</p>
            {stripeAccountId ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm text-nesema-t1 font-medium">Bank account connected</span>
                </div>
                <p className="text-xs text-nesema-t3">Account ID: {stripeAccountId}</p>
                <a
                  href="https://dashboard.stripe.com/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-nesema-sage hover:text-nesema-sage-l transition-colors"
                >
                  Manage payouts in Stripe dashboard
                  <ExternalLink size={13} />
                </a>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-nesema-t2">
                  Connect your bank account to receive payments from patients.
                </p>
                <button
                  type="button"
                  className={saveBtnCls}
                  onClick={() => {
                    window.open("https://connect.stripe.com/setup/e/acct_connect", "_blank");
                  }}
                >
                  Connect bank account
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ACCOUNT ── */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* Change password */}
          <form onSubmit={handleChangePassword} className={`${cardCls} !space-y-4`}>
            <h3 className="text-sm font-semibold text-nesema-t1">Change password</h3>

            {(
              [
                { label: "Current password", value: currentPassword, setter: setCurrentPassword, show: showCurrentPw, toggleShow: () => setShowCurrentPw((v) => !v) },
                { label: "New password", value: newPassword, setter: setNewPassword, show: showNewPw, toggleShow: () => setShowNewPw((v) => !v) },
                { label: "Confirm new password", value: confirmPassword, setter: setConfirmPassword, show: showConfirmPw, toggleShow: () => setShowConfirmPw((v) => !v) },
              ] as { label: string; value: string; setter: (v: string) => void; show: boolean; toggleShow: () => void }[]
            ).map(({ label, value, setter, show, toggleShow }) => (
              <div key={label}>
                <label className={labelCls}>{label}</label>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className={`${inputCls} pr-10`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={toggleShow}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-nesema-t4 hover:text-nesema-t2"
                  >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            ))}

            {pwError && <p className="text-red-600 text-xs">{pwError}</p>}
            {pwSaved && <p className="text-green-700 text-xs">Password updated successfully.</p>}

            <button type="submit" disabled={pwSaving} className={saveBtnCls}>
              <Save size={14} />
              {pwSaving ? "Updating…" : "Update password"}
            </button>
          </form>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
            <p className="text-sm text-red-600">
              Permanently delete your practice and all associated patient records. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-full hover:bg-red-700 transition-colors"
            >
              Delete account
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-nesema-surf rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-nesema-bdr">
            <h2 className="font-serif text-xl text-nesema-t1 mb-2">Delete account</h2>
            <p className="text-sm text-nesema-t2 mb-6">
              This will permanently delete your practice, all patient records, and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 border border-nesema-bdr rounded-full text-sm text-nesema-t2 hover:bg-nesema-bg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-full text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
