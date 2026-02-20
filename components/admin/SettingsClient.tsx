"use client";

import { useState } from "react";
import { GhlSettingsTab } from "@/components/admin/GhlSettingsTab";

interface PlatformSettings {
  id: string;
  allow_practitioner_signup: boolean;
  allow_patient_signup: boolean;
  maintenance_mode: boolean;
  updated_at: string;
  updated_by: string | null;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
        checked ? "" : "bg-nesema-bdr"
      }`}
      style={checked ? { backgroundColor: "#4E7A5F" } : {}}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

type Tab = "platform" | "ghl";

export function SettingsClient({
  settings,
  adminId,
  ghlApiKeySet,
  ghlLocationIdSet,
  ghlPipelineId,
  ghlPracPipelineId,
}: {
  settings: PlatformSettings;
  adminId: string | null;
  ghlApiKeySet: boolean;
  ghlLocationIdSet: boolean;
  ghlPipelineId: string;
  ghlPracPipelineId: string;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("platform");
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenance_mode);
  const [allowPracSignup, setAllowPracSignup] = useState(settings.allow_practitioner_signup);
  const [allowPatientSignup, setAllowPatientSignup] = useState(settings.allow_patient_signup);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function save() {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenance_mode: maintenanceMode,
          allow_practitioner_signup: allowPracSignup,
          allow_patient_signup: allowPatientSignup,
          adminId,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to save");
      }
      setSaved(true);
      showToast("Settings saved.");
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const toggleItems = [
    {
      id: "maintenance",
      label: "Maintenance mode",
      description:
        "When enabled, all non-admin users are redirected to the maintenance page. Admin routes remain accessible.",
      value: maintenanceMode,
      onChange: setMaintenanceMode,
      danger: true,
    },
    {
      id: "prac_signup",
      label: "Practitioner sign-ups",
      description:
        "Allow new practitioners to create accounts. Disabling this prevents new registrations without affecting existing users.",
      value: allowPracSignup,
      onChange: setAllowPracSignup,
      danger: false,
    },
    {
      id: "patient_signup",
      label: "Patient sign-ups",
      description:
        "Allow new patients to create accounts via practitioner booking pages.",
      value: allowPatientSignup,
      onChange: setAllowPatientSignup,
      danger: false,
    },
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "platform", label: "Platform settings" },
    { id: "ghl", label: "GHL Integration" },
  ];

  return (
    <div className="p-6 md:p-8">
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg"
          style={{ backgroundColor: "#C27D30" }}
        >
          {toast}
        </div>
      )}

      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Settings</h1>

      {/* Tab nav */}
      <div className="flex gap-1 mb-8 border-b border-nesema-bdr">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors -mb-px ${
              activeTab === tab.id
                ? "border border-b-white border-nesema-bdr text-nesema-t1 bg-white"
                : "text-nesema-t3 hover:text-nesema-t2"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Platform settings tab */}
      {activeTab === "platform" && (
        <div className="max-w-2xl space-y-4">
          {toggleItems.map((item) => (
            <div
              key={item.id}
              className={`bg-nesema-surf rounded-2xl border p-5 flex items-start justify-between gap-4 ${
                item.danger && item.value
                  ? "border-amber-300 bg-amber-50/30"
                  : "border-nesema-bdr"
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-nesema-t1 text-sm">{item.label}</p>
                  {item.danger && item.value && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-nesema-t3 mt-1 leading-relaxed">{item.description}</p>
              </div>
              <Toggle
                checked={item.value}
                onChange={item.onChange}
                disabled={loading}
              />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={save}
              disabled={loading}
              className="px-6 py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#C27D30" }}
            >
              {loading ? "Saving…" : "Save settings"}
            </button>
            {saved && (
              <span className="text-xs text-green-600 font-medium">Saved successfully</span>
            )}
          </div>

          {settings.updated_at && settings.id && (
            <p className="text-xs text-nesema-t4 pt-2">
              Last updated{" "}
              {new Date(settings.updated_at).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}

      {/* GHL Integration tab */}
      {activeTab === "ghl" && (
        <div className="max-w-3xl">
          <GhlSettingsTab
            apiKeySet={ghlApiKeySet}
            locationIdSet={ghlLocationIdSet}
            pipelineId={ghlPipelineId}
            pracPipelineId={ghlPracPipelineId}
          />
        </div>
      )}
    </div>
  );
}
