"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Save, Upload, User, Bell, ShieldAlert, Eye, EyeOff } from "lucide-react";

type Tab = "profile" | "notifications" | "account";

interface PatientNotifPrefs {
  appointment_reminder: boolean;
  checkin_reminder: boolean;
  new_message: boolean;
  care_plan_updated: boolean;
  checkin_reminder_time: string;
}

const defaultNotifPrefs: PatientNotifPrefs = {
  appointment_reminder: true,
  checkin_reminder: true,
  new_message: true,
  care_plan_updated: true,
  checkin_reminder_time: "08:00",
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

export default function PatientSettingsPage() {
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
  const [dob, setDob] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [patientId, setPatientId] = useState("");

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState<PatientNotifPrefs>(defaultNotifPrefs);

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

      const { data: patient } = await supabase
        .from("patients")
        .select("id, date_of_birth, notification_preferences")
        .eq("profile_id", user.id)
        .single();

      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setEmail(profile.email ?? user.email ?? "");
        setAvatarUrl(profile.avatar_url ?? null);
      }
      if (patient) {
        setPatientId(patient.id);
        setDob(patient.date_of_birth ?? "");
        if (patient.notification_preferences) {
          setNotifPrefs({
            ...defaultNotifPrefs,
            ...(patient.notification_preferences as Partial<PatientNotifPrefs>),
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
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
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

    if (!profileErr && patientId && dob) {
      await supabase
        .from("patients")
        .update({ date_of_birth: dob })
        .eq("id", patientId);
    }

    if (profileErr) {
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
    if (!patientId) return;
    const { error: notifErr } = await supabase
      .from("patients")
      .update({ notification_preferences: notifPrefs as unknown as import("@/types/database").Json })
      .eq("id", patientId);
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
    const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
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
    { id: "notifications", label: "Notifications", icon: <Bell size={15} /> },
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
      <div className="flex gap-1 mb-8 bg-nesema-bg rounded-2xl p-1 border border-nesema-bdr">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setError(null); setSaved(false); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium flex-1 justify-center transition-colors ${
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

            <div>
              <label className={labelCls}>Date of birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={inputCls}
              />
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
                { key: "appointment_reminder", label: "Appointment reminder", desc: "24 hours before your session" },
                { key: "checkin_reminder", label: "Daily check-in reminder", desc: "A gentle nudge to complete your check-in" },
                { key: "new_message", label: "New message", desc: "When your practitioner sends you a message" },
                { key: "care_plan_updated", label: "Care plan updated", desc: "When your practitioner updates your plan" },
              ] as { key: keyof Omit<PatientNotifPrefs, "checkin_reminder_time">; label: string; desc: string }[]
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

            {notifPrefs.checkin_reminder && (
              <div className="pt-2 border-t border-nesema-bdr">
                <label className={labelCls}>Check-in reminder time</label>
                <input
                  type="time"
                  value={notifPrefs.checkin_reminder_time}
                  onChange={(e) =>
                    setNotifPrefs((p) => ({ ...p, checkin_reminder_time: e.target.value }))
                  }
                  className={`${inputCls} max-w-[160px]`}
                />
              </div>
            )}
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}
          {saved && <p className="text-green-700 text-xs">Preferences saved.</p>}
          <button type="submit" disabled={saving} className={saveBtnCls}>
            <Save size={14} />
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </form>
      )}

      {/* ── ACCOUNT ── */}
      {activeTab === "account" && (
        <div className="space-y-6">
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

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
            <p className="text-sm text-red-600">
              Permanently delete your account and all your health data. This cannot be undone.
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
