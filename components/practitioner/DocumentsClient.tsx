"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FolderOpen, FileText, Plus, X, ChevronRight, ChevronDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocRow = {
  id: string;
  title: string;
  document_type: string | null;
  is_lab_result: boolean;
  created_at: string;
  patient_id: string | null;
};

export type PatientOption = {
  id: string;
  name: string;
};

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: "intake_form",
    emoji: "📋",
    label: "Intake Form",
    type: "intake_form",
    is_lab_result: false,
    titlePrefix: "Intake Form",
    description: "New patient health history and presenting concerns",
  },
  {
    id: "consent",
    emoji: "✍️",
    label: "Consent Form",
    type: "consent",
    is_lab_result: false,
    titlePrefix: "Consent Form",
    description: "Treatment consent and data processing agreement",
  },
  {
    id: "report",
    emoji: "📊",
    label: "Progress Report",
    type: "report",
    is_lab_result: false,
    titlePrefix: "Progress Report",
    description: "Weekly or monthly patient progress notes",
  },
  {
    id: "lab_result",
    emoji: "🧪",
    label: "Lab Result",
    type: "lab_result",
    is_lab_result: true,
    titlePrefix: "Lab Results",
    description: "Record or reference lab test results",
  },
  {
    id: "other",
    emoji: "📁",
    label: "Custom Document",
    type: "other",
    is_lab_result: false,
    titlePrefix: "",
    description: "Any other document — blank title",
  },
] as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  lab_result: "🧪",
  intake_form: "📋",
  consent: "✍️",
  report: "📊",
  other: "📁",
};

const TYPE_LABEL: Record<string, string> = {
  lab_result: "Lab result",
  intake_form: "Intake form",
  consent: "Consent form",
  report: "Progress report",
  other: "Other",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  initialDocs: DocRow[];
  patientNames: Record<string, string>;
  patients: PatientOption[];
  pracId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentsClient({ initialDocs, patientNames: initialPatientNames, patients, pracId }: Props) {
  const supabase = createClient();

  const [docs, setDocs] = useState<DocRow[]>(initialDocs);
  const [patientNames, setPatientNames] = useState<Record<string, string>>(initialPatientNames);

  // Modal state
  const [step, setStep] = useState<"closed" | "template" | "form">("closed");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[number] | null>(null);
  const [title, setTitle] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openModal() { setStep("template"); setError(null); }
  function closeModal() {
    setStep("closed");
    setSelectedTemplate(null);
    setTitle("");
    setSelectedPatient("");
    setError(null);
  }

  function selectTemplate(t: typeof TEMPLATES[number]) {
    setSelectedTemplate(t);
    setTitle(t.titlePrefix ? `${t.titlePrefix} — ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : "");
    setStep("form");
  }

  async function handleCreate() {
    if (!title.trim()) { setError("Please enter a document title."); return; }
    if (!selectedTemplate) return;

    setSaving(true);
    setError(null);

    const storageRef = `practitioner/${pracId}/${selectedTemplate.type}/${crypto.randomUUID()}`;

    const { data: newDoc, error: insertErr } = await (supabase as ReturnType<typeof createClient>)
      .from("documents")
      .insert({
        practitioner_id: pracId,
        patient_id: selectedPatient || null,
        title: title.trim(),
        document_type: selectedTemplate.type,
        is_lab_result: selectedTemplate.is_lab_result,
        storage_path: storageRef,
      })
      .select("id, title, document_type, is_lab_result, created_at, patient_id")
      .single();

    if (insertErr) {
      setError("Failed to create document. Please try again.");
      setSaving(false);
      return;
    }

    // Add to list + update patient name map
    const doc = newDoc as DocRow;
    setDocs((prev) => [doc, ...prev]);
    if (selectedPatient) {
      const patient = patients.find((p) => p.id === selectedPatient);
      if (patient) {
        setPatientNames((prev) => ({ ...prev, [selectedPatient]: patient.name }));
      }
    }

    setSaving(false);
    closeModal();
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-nesema-t1">Documents</h1>
        <button
          onClick={openModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E2620] text-white text-sm font-medium rounded-full hover:bg-[#4E3D30] transition-colors"
        >
          <Plus size={15} />
          New Document
        </button>
      </div>

      {/* List */}
      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-nesema-sage/40 p-10 text-center">
          <FolderOpen className="mx-auto mb-3 text-nesema-sage/50" size={36} />
          <p className="text-nesema-t1 font-medium mb-1">No documents yet</p>
          <p className="text-nesema-t3 text-sm max-w-sm mx-auto mb-4">
            Create a document from a template or upload from a patient&apos;s profile.
          </p>
          <button
            onClick={openModal}
            className="px-5 py-2 bg-[#2E2620] text-white text-sm rounded-full hover:bg-[#4E3D30] transition-colors"
          >
            Create first document
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => {
            const typeKey = d.document_type ?? "other";
            return (
              <div
                key={d.id}
                className="rounded-2xl bg-white border border-nesema-sage/20 p-4 flex items-center gap-4"
              >
                <div className="text-2xl w-10 text-center shrink-0">
                  {d.is_lab_result ? "🧪" : (TYPE_EMOJI[typeKey] ?? "📁")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-nesema-t1 truncate">{d.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-nesema-t3 flex-wrap">
                    {d.patient_id && patientNames[d.patient_id] && (
                      <>
                        <Link
                          href={`/practitioner/patients/${d.patient_id}`}
                          className="text-nesema-bark hover:underline"
                        >
                          {patientNames[d.patient_id]}
                        </Link>
                        <span>·</span>
                      </>
                    )}
                    <span>{d.is_lab_result ? "Lab result" : (TYPE_LABEL[typeKey] ?? "Other")}</span>
                    <span>·</span>
                    <span>
                      {new Date(d.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <FileText className="text-nesema-t3 shrink-0" size={16} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal overlay ────────────────────────────────────────────────────── */}
      {step !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E0D8]">
              <div className="flex items-center gap-2 text-xs text-[#9C9087]">
                <button
                  onClick={() => step === "form" ? setStep("template") : closeModal()}
                  className={step === "form" ? "hover:text-[#1E1A16] transition-colors" : ""}
                >
                  Templates
                </button>
                {step === "form" && (
                  <>
                    <ChevronRight size={12} />
                    <span className="text-[#1E1A16] font-medium">{selectedTemplate?.label}</span>
                  </>
                )}
              </div>
              <button onClick={closeModal} className="text-[#9C9087] hover:text-[#1E1A16] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* ── Step 1: Template picker ─────────────────────────────────── */}
            {step === "template" && (
              <div className="p-6">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9C9087] mb-4">
                  Choose a template
                </p>
                <div className="space-y-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] hover:bg-[#EBF2EE] hover:border-[#4E7A5F]/30 transition-all text-left group"
                    >
                      <span className="text-2xl shrink-0">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1E1A16]">{t.label}</p>
                        <p className="text-xs text-[#9C9087] mt-0.5">{t.description}</p>
                      </div>
                      <ChevronRight size={15} className="text-[#9C9087] group-hover:text-[#4E7A5F] shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 2: Fill in details ─────────────────────────────────── */}
            {step === "form" && selectedTemplate && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{selectedTemplate.emoji}</span>
                  <div>
                    <p className="font-medium text-[#1E1A16]">{selectedTemplate.label}</p>
                    <p className="text-xs text-[#9C9087]">{selectedTemplate.description}</p>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="text-[11px] font-medium text-[#5C5248] uppercase tracking-wider mb-1.5 block">
                    Document title
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter document title…"
                    className="w-full text-sm border border-[#E6E0D8] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/25 bg-white"
                  />
                </div>

                {/* Patient (optional) */}
                <div>
                  <label className="text-[11px] font-medium text-[#5C5248] uppercase tracking-wider mb-1.5 block">
                    Assign to patient <span className="text-[#9C9087] normal-case font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedPatient}
                      onChange={(e) => setSelectedPatient(e.target.value)}
                      className="w-full appearance-none text-sm border border-[#E6E0D8] rounded-xl px-4 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]/25 bg-white"
                    >
                      <option value="">No patient — general document</option>
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9C9087] pointer-events-none" />
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                    {error}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setStep("template")}
                    className="flex-1 py-2.5 rounded-full border border-[#E6E0D8] text-sm text-[#5C5248] hover:bg-[#F6F3EE] transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !title.trim()}
                    className="flex-1 py-2.5 rounded-full bg-[#2E2620] text-white text-sm font-medium hover:bg-[#4E3D30] transition-colors disabled:opacity-50"
                  >
                    {saving ? "Creating…" : "Create Document"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
