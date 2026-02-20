"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import {
  MessageSquare,
  CalendarPlus,
  Upload,
  FileText,
  ExternalLink,
  Save,
  CheckCircle2,
} from "lucide-react";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
type CheckInRow = Database["public"]["Tables"]["check_ins"]["Row"];
type CarePlanRow = Database["public"]["Tables"]["care_plans"]["Row"];
type MealPlanRow = Database["public"]["Tables"]["meal_plans"]["Row"];
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

const MOOD_EMOJI: Record<number, string> = {
  1: "😞",
  2: "😐",
  3: "🙂",
  4: "😊",
  5: "😄",
};

const TABS = ["Overview", "Plan", "Notes", "Lab Results"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  patientId: string;
  practitionerId: string;
  profileId: string;
  name: string;
  initials: string;
  age: number | null;
  week: number;
  discipline: string;
  email: string;
  patient: PatientRow;
  checkIns: CheckInRow[];
  last7CheckIns: CheckInRow[];
  adherence: number;
  avgMetrics: { energy: number; sleep: number; digestion: number; mood: number };
  carePlan: CarePlanRow | null;
  mealPlan: MealPlanRow | null;
  docs: DocumentRow[];
}

// ── Mini bar for displaying a score as a filled bar ──────────────────────────
function ScoreBar({ value, max, color }: { value: number | null; max: number; color: string }) {
  if (value === null) return <span className="text-nesema-t4 text-xs">—</span>;
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 rounded-full bg-nesema-bdr overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-nesema-t3 tabular-nums">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function PatientProfileClient({
  patientId,
  practitionerId,
  profileId,
  name,
  initials,
  age,
  week,
  discipline,
  email,
  patient,
  last7CheckIns,
  adherence,
  avgMetrics,
  carePlan,
  mealPlan,
  docs: initialDocs,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [notes, setNotes] = useState(carePlan?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(
    carePlan?.updated_at ?? null
  );
  const [docs, setDocs] = useState<DocumentRow[]>(initialDocs);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  async function saveNotes() {
    if (!carePlan) return;
    setSaving(true);
    const now = new Date().toISOString();
    await supabase
      .from("care_plans")
      .update({ notes, updated_at: now })
      .eq("id", carePlan.id);
    setSavedAt(now);
    setSaving(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${patientId}/${Date.now()}-${file.name}`;
    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(path, file);

    if (!storageError) {
      const { data: doc } = await supabase
        .from("documents")
        .insert({
          patient_id: patientId,
          practitioner_id: practitionerId,
          title: file.name,
          storage_path: path,
          document_type: "lab_result",
          is_lab_result: true,
        })
        .select()
        .single();
      if (doc) setDocs((prev) => [doc as DocumentRow, ...prev]);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function getFileUrl(storagePath: string) {
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="min-h-full">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#2A2118] px-4 md:px-8 pt-6 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
          {/* Avatar */}
          <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-nesema-sage flex items-center justify-center flex-shrink-0">
            <span className="font-serif text-white text-2xl md:text-3xl font-semibold">
              {initials}
            </span>
          </div>

          {/* Name + meta */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="font-serif text-2xl md:text-3xl text-white">{name}</h1>
              {discipline && (
                <span className="px-2 py-0.5 rounded-full bg-nesema-sage/20 text-nesema-sage text-xs font-medium capitalize">
                  {discipline}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-white/60 text-sm">
              {age !== null && <span>{age} years old</span>}
              <span>Week {week} of programme</span>
              {email && <span>{email}</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href={`/practitioner/messages?to=${profileId}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-medium transition-colors"
            >
              <MessageSquare size={15} />
              <span className="hidden sm:inline">Message</span>
            </Link>
            <Link
              href="/practitioner/calendar"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-nesema-sage text-white text-sm font-medium hover:bg-nesema-sage/90 transition-colors"
            >
              <CalendarPlus size={15} />
              <span className="hidden sm:inline">Book session</span>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-nesema-sage text-white"
                  : "border-transparent text-white/50 hover:text-white/80"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="p-4 md:p-8">
        {/* ── OVERVIEW ────────────────────────────────────────────────────── */}
        {activeTab === "Overview" && (
          <div className="space-y-6">
            {/* Health summary + adherence side by side on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Health summary */}
              <div className="md:col-span-2 bg-white rounded-2xl border border-nesema-bdr p-5">
                <h2 className="font-serif text-lg text-nesema-t1 mb-4">
                  Health summary
                </h2>
                <div className="space-y-3">
                  <InfoRow label="Current health" value={patient.current_health} />
                  <InfoRow label="Conditions" value={patient.diagnosed_conditions} />
                  <InfoRow label="Medications" value={patient.medications} />
                  <InfoRow label="Allergies" value={patient.allergies} />
                  {patient.goals && patient.goals.length > 0 && (
                    <div>
                      <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-1.5">Goals</p>
                      <div className="flex flex-wrap gap-1.5">
                        {patient.goals.map((g) => (
                          <span key={g} className="px-2 py-1 rounded-full bg-nesema-sage/10 text-nesema-sage text-xs">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Adherence + metrics */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
                  <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-1">
                    Adherence
                  </p>
                  <p className="font-serif text-4xl text-nesema-t1 mb-1">
                    {adherence}%
                  </p>
                  <p className="text-xs text-nesema-t3">days checked in</p>
                </div>
                <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
                  <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-3">
                    Avg (last 14 check-ins)
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-nesema-t2">Energy</span>
                      <ScoreBar value={avgMetrics.energy} max={10} color="bg-yellow-400" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-nesema-t2">Sleep</span>
                      <div className="text-xs text-nesema-t3">{avgMetrics.sleep}h</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-nesema-t2">Digestion</span>
                      <ScoreBar value={avgMetrics.digestion} max={10} color="bg-nesema-sage" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-nesema-t2">Mood</span>
                      <ScoreBar value={avgMetrics.mood} max={5} color="bg-sky-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent check-ins */}
            <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
              <h2 className="font-serif text-lg text-nesema-t1 mb-4">
                Recent check-ins
              </h2>
              {last7CheckIns.length === 0 ? (
                <p className="text-nesema-t3 text-sm py-4 text-center">
                  No check-ins recorded yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {last7CheckIns.map((ci) => (
                    <div
                      key={ci.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-nesema-bdr last:border-0"
                    >
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xl">
                          {ci.mood_score ? MOOD_EMOJI[ci.mood_score] : "—"}
                        </span>
                        <span className="text-xs text-nesema-t3 w-20">
                          {new Date(ci.checked_in_at).toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 flex-1">
                        <div>
                          <p className="text-[10px] text-nesema-t4 mb-0.5">Energy</p>
                          <ScoreBar value={ci.energy_score} max={10} color="bg-yellow-400" />
                        </div>
                        <div>
                          <p className="text-[10px] text-nesema-t4 mb-0.5">Sleep</p>
                          <span className="text-xs text-nesema-t3">
                            {ci.sleep_hours !== null ? `${ci.sleep_hours}h` : "—"}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] text-nesema-t4 mb-0.5">Digestion</p>
                          <ScoreBar value={ci.digestion_score} max={10} color="bg-nesema-sage" />
                        </div>
                      </div>
                      {ci.symptoms && ci.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {ci.symptoms.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[10px]"
                            >
                              {s}
                            </span>
                          ))}
                          {ci.symptoms.length > 3 && (
                            <span className="text-[10px] text-nesema-t3">
                              +{ci.symptoms.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PLAN ────────────────────────────────────────────────────────── */}
        {activeTab === "Plan" && (
          <div className="space-y-6 max-w-2xl">
            {/* Care plan */}
            <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-nesema-t1">Care plan</h2>
                {carePlan && (
                  <span className="text-xs text-nesema-t3">Week {carePlan.week_number}</span>
                )}
              </div>
              {carePlan ? (
                <div className="space-y-4">
                  {carePlan.goals && carePlan.goals.length > 0 && (
                    <div>
                      <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-2">Goals</p>
                      <ul className="space-y-2">
                        {carePlan.goals.map((g, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 size={16} className="text-nesema-sage mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-nesema-t2">{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {carePlan.supplements && (
                    <div>
                      <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-2">Supplements</p>
                      <div className="rounded-xl bg-nesema-bg p-3 text-sm text-nesema-t2">
                        <pre className="whitespace-pre-wrap font-sans text-xs">
                          {JSON.stringify(carePlan.supplements, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-nesema-t3 text-sm py-4 text-center">
                  No care plan created yet.
                </p>
              )}
            </div>

            {/* Meal plan */}
            <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
              <h2 className="font-serif text-lg text-nesema-t1 mb-4">Meal plan</h2>
              {mealPlan ? (
                <div className="space-y-2">
                  {mealPlan.protocol_name && (
                    <p className="font-medium text-nesema-t1">{mealPlan.protocol_name}</p>
                  )}
                  {mealPlan.notes && (
                    <p className="text-sm text-nesema-t2">{mealPlan.notes}</p>
                  )}
                </div>
              ) : (
                <p className="text-nesema-t3 text-sm py-4 text-center">
                  No meal plan assigned yet.
                </p>
              )}
            </div>

            <button className="px-5 py-2.5 rounded-full border border-nesema-bdr text-nesema-t2 text-sm font-medium hover:bg-nesema-bg transition-colors">
              Update plan
            </button>
          </div>
        )}

        {/* ── NOTES ───────────────────────────────────────────────────────── */}
        {activeTab === "Notes" && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-white rounded-2xl border border-nesema-bdr p-5">
              <h2 className="font-serif text-lg text-nesema-t1 mb-3">Session notes</h2>
              {!carePlan && (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                  Create a care plan for this patient first to enable notes.
                </p>
              )}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!carePlan}
                rows={12}
                placeholder="Add session notes, observations, treatment plans, or any relevant clinical information…"
                className="w-full rounded-xl border border-nesema-bdr bg-nesema-bg px-4 py-3 text-sm text-nesema-t1 placeholder:text-nesema-t3 focus:outline-none focus:ring-2 focus:ring-nesema-sage/40 resize-none disabled:opacity-50"
              />
              <div className="flex items-center justify-between mt-3">
                {savedAt ? (
                  <p className="text-xs text-nesema-t3">
                    Last saved{" "}
                    {new Date(savedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ) : (
                  <span />
                )}
                <button
                  onClick={saveNotes}
                  disabled={!carePlan || saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-nesema-bark text-white text-sm font-medium hover:bg-nesema-bark/90 transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  {saving ? "Saving…" : "Save notes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LAB RESULTS ─────────────────────────────────────────────────── */}
        {activeTab === "Lab Results" && (
          <div className="max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg text-nesema-t1">Lab results</h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-nesema-bark text-white text-sm font-medium hover:bg-nesema-bark/90 transition-colors disabled:opacity-60"
              >
                <Upload size={14} />
                {uploading ? "Uploading…" : "Upload result"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {docs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-nesema-bdr p-10 text-center">
                <FileText className="mx-auto text-nesema-t4 mb-3" size={36} />
                <p className="text-nesema-t2 font-medium mb-1">No lab results yet</p>
                <p className="text-nesema-t3 text-sm">
                  Upload PDF or image files to keep all results in one place.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-nesema-bdr divide-y divide-nesema-bdr">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 px-5 py-4"
                  >
                    <FileText className="text-nesema-sage flex-shrink-0" size={20} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nesema-t1 truncate">
                        {doc.title}
                      </p>
                      <p className="text-xs text-nesema-t3">
                        {new Date(doc.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => getFileUrl(doc.storage_path)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-nesema-bdr text-nesema-t2 text-xs font-medium hover:bg-nesema-bg transition-colors flex-shrink-0"
                    >
                      <ExternalLink size={12} />
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper: info row ──────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-nesema-t3 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-nesema-t2">{value}</p>
    </div>
  );
}
