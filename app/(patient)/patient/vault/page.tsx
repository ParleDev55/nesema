"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock, Unlock, Upload, Fingerprint, FlaskConical, FileText, Delete } from "lucide-react";

// PIN is stored client-side only — in a real app this would be server-verified
const CORRECT_PIN = "1234";
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 30;

type VaultState = "locked" | "unlocked";

type Doc = {
  id: string;
  title: string;
  document_type: string | null;
  storage_path: string;
  created_at: string;
};

const RESULT_COLOURS = [
  "border-l-[#4E7A5F] bg-[#EBF2EE]/30",
  "border-l-[#4A7FA0] bg-[#E8F2F8]/30",
  "border-l-[#7B6FA8] bg-[#EEECf6]/30",
  "border-l-[#C27D30] bg-[#F9F1E6]/30",
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── PIN Pad ──────────────────────────────────────────────────────────────────

function PinPad({ onComplete }: { onComplete: (pin: string) => void }) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake] = useState(false);

  function press(digit: string) {
    if (digits.length >= 4) return;
    const next = [...digits, digit];
    setDigits(next);
    if (next.length === 4) {
      setTimeout(() => {
        onComplete(next.join(""));
        setDigits([]);
      }, 100);
    }
  }

  function backspace() {
    setDigits((prev) => prev.slice(0, -1));
  }

  const keys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["bio", "0", "back"],
  ];

  return (
    <div className={`flex flex-col items-center gap-6 ${shake ? "animate-pulse" : ""}`}>
      {/* 4-dot display */}
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
              i < digits.length
                ? "bg-[#2E2620] border-[#2E2620] scale-110"
                : "border-[#BFB8B0]"
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((row, ri) =>
          row.map((key) => {
            if (key === "bio") {
              return (
                <button
                  key="bio"
                  onClick={() => {
                    // Biometric placeholder
                    const el = document.getElementById("vault-bio-toast");
                    if (el) { el.style.opacity = "1"; setTimeout(() => { el.style.opacity = "0"; }, 2500); }
                  }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-[#9C9087] hover:bg-[#F6F3EE] transition-colors"
                  aria-label="Use biometrics"
                >
                  <Fingerprint size={24} />
                </button>
              );
            }
            if (key === "back") {
              return (
                <button
                  key="back"
                  onClick={backspace}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-[#9C9087] hover:bg-[#F6F3EE] transition-colors"
                  aria-label="Backspace"
                >
                  <Delete size={22} />
                </button>
              );
            }
            return (
              <button
                key={`${ri}-${key}`}
                onClick={() => press(key)}
                className="w-16 h-16 rounded-2xl bg-white border border-[#E6E0D8] text-xl font-medium text-[#1E1A16] hover:bg-[#F6F3EE] active:bg-[#E6E0D8] transition-colors shadow-sm select-none"
              >
                {key}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VaultPage() {
  const supabase = createClient();
  const [vaultState, setVaultState] = useState<VaultState>("locked");
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [pinError, setPinError] = useState<string | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function startLockout() {
    setLockedOut(true);
    setCountdown(LOCKOUT_SECONDS);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          setLockedOut(false);
          setAttempts(0);
          setPinError(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function loadDocs() {
    setDocsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDocsLoading(false); return; }

    const { data: patient } = (await supabase
      .from("patients")
      .select("id")
      .eq("profile_id", user.id)
      .single()) as { data: { id: string } | null; error: unknown };

    if (!patient) { setDocsLoading(false); return; }

    const { data } = (await supabase
      .from("documents")
      .select("id, title, document_type, storage_path, created_at")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })) as { data: Doc[] | null; error: unknown };

    setDocs(data ?? []);
    setDocsLoading(false);
  }

  function handlePin(pin: string) {
    if (pin === CORRECT_PIN) {
      setPinError(null);
      setAttempts(0);
      setVaultState("unlocked");
      loadDocs();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= MAX_ATTEMPTS) {
        setPinError(null);
        startLockout();
      } else {
        setPinError(`Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining.`);
      }
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = (await supabase
        .from("patients")
        .select("id, practitioner_id")
        .eq("profile_id", user.id)
        .single()) as { data: { id: string; practitioner_id: string | null } | null; error: unknown };

      if (!patient) return;

      const ext = file.name.split(".").pop();
      const path = `${patient.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert({
        patient_id: patient.id,
        practitioner_id: patient.practitioner_id,
        uploaded_by: user.id,
        document_type: "lab_result",
        title: file.name.replace(/\.[^.]+$/, ""),
        storage_path: path,
        is_lab_result: true,
        requires_pin: true,
      });

      if (insertError) throw insertError;

      showToast("Lab result uploaded");
      await loadDocs();
    } catch {
      showToast("Upload failed — please try again");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function getDocUrl(storagePath: string) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else showToast("Could not open file");
  }

  // ─── Locked state ────────────────────────────────────────────────────────────

  if (vaultState === "locked") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-6 py-12">
        <div className="w-full max-w-xs flex flex-col items-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[#2E2620] flex items-center justify-center mb-6">
            <Lock size={26} className="text-white" />
          </div>

          <h1 className="font-serif text-2xl text-[#1E1A16] mb-2 text-center">Results Vault</h1>
          <p className="text-sm text-[#9C9087] text-center mb-8">
            {lockedOut
              ? `Too many attempts — try again in ${countdown}s`
              : "Enter your PIN to access your lab results"}
          </p>

          {!lockedOut && (
            <>
              <PinPad onComplete={handlePin} />

              {pinError && (
                <p className="mt-4 text-xs text-red-500 text-center">{pinError}</p>
              )}
            </>
          )}

          {lockedOut && (
            <div className="w-full bg-[#FEF2F2] border border-red-100 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-medium text-red-600">Vault locked</p>
              <p className="text-xs text-red-400 mt-0.5">
                Try again in {countdown} second{countdown !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>

        {/* Biometric toast (hidden by default) */}
        <div
          id="vault-bio-toast"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2E2620] text-white text-xs px-5 py-3 rounded-full shadow-xl pointer-events-none transition-opacity duration-300"
          style={{ opacity: 0 }}
        >
          Biometric unlock coming soon
        </div>
      </div>
    );
  }

  // ─── Unlocked state ───────────────────────────────────────────────────────────

  const labResults = docs.filter((d) => d.document_type === "lab_result");
  const otherDocs = docs.filter((d) => d.document_type !== "lab_result");

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EBF2EE] flex items-center justify-center">
            <Unlock size={16} className="text-[#4E7A5F]" />
          </div>
          <div>
            <h1 className="font-serif text-2xl text-[#1E1A16]">Results Vault</h1>
            <p className="text-xs text-[#9C9087]">Unlocked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-[#4E7A5F] border border-[#4E7A5F]/30 px-3 py-2 rounded-full hover:bg-[#EBF2EE] transition-colors disabled:opacity-50"
          >
            <Upload size={13} />
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <button
            onClick={() => setVaultState("locked")}
            className="flex items-center gap-1.5 text-xs text-[#9C9087] border border-[#E6E0D8] px-3 py-2 rounded-full hover:bg-[#F6F3EE] transition-colors"
          >
            <Lock size={13} />
            Lock vault
          </button>
        </div>
      </div>

      {docsLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#4E7A5F]/30 p-12 text-center">
          <FlaskConical className="mx-auto mb-3 text-[#4E7A5F]/40" size={36} />
          <p className="text-[#1E1A16] font-medium mb-1">No results yet</p>
          <p className="text-[#9C9087] text-sm max-w-sm mx-auto">
            Your practitioner will upload lab results here as your programme progresses.
            You can also upload your own results above.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {labResults.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#9C9087] mb-4">
                Lab Results
              </h2>
              <div className="space-y-2">
                {labResults.map((doc, i) => (
                  <button
                    key={doc.id}
                    onClick={() => getDocUrl(doc.storage_path)}
                    className={`w-full text-left rounded-xl border-l-4 border border-[#E6E0D8] p-4 flex items-center gap-4 hover:shadow-sm transition-shadow ${
                      RESULT_COLOURS[i % RESULT_COLOURS.length]
                    }`}
                  >
                    <FlaskConical size={18} className="text-[#4E7A5F] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#1E1A16] truncate">{doc.title}</p>
                      <p className="text-xs text-[#9C9087] mt-0.5">{fmtDate(doc.created_at)}</p>
                    </div>
                    <span className="text-[11px] text-[#4E7A5F] shrink-0">View →</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {otherDocs.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[#9C9087] mb-4">
                Documents
              </h2>
              <div className="space-y-2">
                {otherDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => getDocUrl(doc.storage_path)}
                    className="w-full text-left rounded-xl border border-[#E6E0D8] bg-white p-4 flex items-center gap-4 hover:shadow-sm transition-shadow"
                  >
                    <FileText size={18} className="text-[#9C9087] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#1E1A16] truncate">{doc.title}</p>
                      <p className="text-xs text-[#9C9087] mt-0.5">
                        {doc.document_type?.replace("_", " ") ?? "Document"} · {fmtDate(doc.created_at)}
                      </p>
                    </div>
                    <span className="text-[11px] text-[#9C9087] shrink-0">View →</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#2E2620] text-white text-xs px-5 py-3 rounded-full shadow-xl pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
