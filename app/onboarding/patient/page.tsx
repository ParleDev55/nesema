"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/types/database";
import { Check, ChevronRight, CalendarDays, BookOpen, ArrowRight } from "lucide-react";
import Link from "next/link";

const STEPS = [
  { number: 1, label: "Welcome" },
  { number: 2, label: "Health background" },
  { number: 3, label: "Your goals" },
  { number: 4, label: "Lifestyle" },
];

const GOALS = [
  "Energy & fatigue", "Brain fog & focus", "Gut health", "Sleep quality",
  "Weight management", "Stress & anxiety", "Hormonal balance", "Fitness & strength",
  "Joint & muscle health", "Skin health", "Chronic condition management", "General wellbeing",
];

const DIET_TYPES = ["No restrictions","Vegetarian","Vegan","Pescatarian","Gluten-free","Dairy-free","Paleo","Keto","Low FODMAP","Other"];
const MEALS_OPTIONS = ["1–2","3","4–5","Grazing"];
const SLEEP_OPTIONS = ["Less than 5h","5–6h","6–7h","7–8h","8–9h","More than 9h"];
const ACTIVITY_OPTIONS = ["Sedentary (desk job, little movement)","Lightly active (1–2 days/week)","Moderately active (3–4 days/week)","Very active (5+ days/week)","Athlete / daily training"];
const SUPPORT_OPTIONS = ["Video sessions","Messaging","Progress tracking","Educational content"];

const iCls = "w-full rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] px-4 py-2.5 text-sm text-[#1E1A16] placeholder:text-[#BFB8B0] focus:outline-none focus:ring-2 focus:ring-[#4E7A5F] focus:border-[#4E7A5F] transition-colors";
const sCls = "w-full rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] px-4 py-2.5 text-sm text-[#1E1A16] focus:outline-none focus:ring-2 focus:ring-[#4E7A5F] transition-colors appearance-none cursor-pointer";
const lCls = "block text-sm font-medium text-[#5C5248] mb-1.5";
const taCls = "w-full rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] px-4 py-3 text-sm text-[#1E1A16] placeholder:text-[#BFB8B0] focus:outline-none focus:ring-2 focus:ring-[#4E7A5F] transition-colors resize-none";

// Sidebar bg is slightly warmer for patients
function Sidebar({ step }: { step: number }) {
  return (
    <aside className="w-64 bg-[#3A2E26] flex-shrink-0 flex flex-col min-h-screen">
      <div className="px-8 pt-10 pb-8 border-b border-white/10">
        <span className="font-serif text-2xl font-semibold text-white tracking-wide">Nesema</span>
        <p className="text-[11px] text-white/40 mt-0.5">Your health journey</p>
      </div>
      <nav className="flex-1 px-6 pt-8">
        {STEPS.map((s, i) => {
          const done = step > s.number; const active = step === s.number;
          return (
            <div key={s.number} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${done ? "bg-[#4E7A5F] text-white" : active ? "bg-white text-[#3A2E26]" : "border border-white/20 text-white/30"}`}>
                  {done ? <Check size={13} strokeWidth={3} /> : s.number}
                </div>
                {i < STEPS.length - 1 && <div className={`w-px flex-1 my-1.5 min-h-[28px] ${done ? "bg-[#4E7A5F]/50" : "bg-white/10"}`} />}
              </div>
              <div className="pb-8">
                <p className={`text-sm font-medium mt-1 ${active ? "text-white" : done ? "text-white/60" : "text-white/25"}`}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </nav>
      <p className="px-6 pb-8 text-[11px] text-white/20 leading-relaxed">Everything you share is private and only visible to you and your practitioner.</p>
    </aside>
  );
}

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return <div className="mb-8"><h1 className="font-serif text-3xl text-[#1E1A16] mb-2">{title}</h1><p className="text-[#9C9087] text-sm leading-relaxed">{sub}</p></div>;
}

function NextBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full mt-8 h-12 rounded-full bg-[#4E7A5F] text-white text-base font-medium flex items-center justify-center gap-2 hover:bg-[#3d6249] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
      {label} {!disabled && <ChevronRight size={16} />}
    </button>
  );
}

function SelectWrap({ children }: { children: React.ReactNode }) {
  return <div className="relative">{children}<ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9C9087] rotate-90 pointer-events-none" /></div>;
}

// ── Step 1: Welcome ───────────────────────────────────────────
function Step1({ firstName, setFirstName, lastName, setLastName, dob, setDob, onNext, saving }: {
  firstName: string; setFirstName: (v: string) => void;
  lastName: string; setLastName: (v: string) => void;
  dob: string; setDob: (v: string) => void;
  onNext: () => void; saving: boolean;
}) {
  return (
    <div>
      <StepHeader title="Welcome to Nesema" sub="Let's start with the basics. This takes about 5 minutes and helps us personalise your experience." />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lCls}>First name</label><input className={iCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Sophie" /></div>
          <div><label className={lCls}>Last name</label><input className={iCls} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Marsh" /></div>
        </div>
        <div>
          <label className={lCls}>Date of birth</label>
          <input type="date" className={iCls} value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().split("T")[0]} />
        </div>
      </div>
      <NextBtn label={saving ? "Saving…" : "Continue"} onClick={onNext} disabled={saving || !firstName.trim() || !lastName.trim() || !dob} />
    </div>
  );
}

// ── Step 2: Health background ─────────────────────────────────
function Step2({ currentHealth, setCurrentHealth, diagnosedConditions, setDiagnosedConditions, medications, setMedications, allergies, setAllergies, onNext, saving }: {
  currentHealth: string; setCurrentHealth: (v: string) => void;
  diagnosedConditions: string; setDiagnosedConditions: (v: string) => void;
  medications: string; setMedications: (v: string) => void;
  allergies: string; setAllergies: (v: string) => void;
  onNext: () => void; saving: boolean;
}) {
  return (
    <div>
      <StepHeader title="Your health background" sub="The more context you share, the more your practitioner can tailor their support. Nothing is mandatory." />
      <div className="space-y-5">
        <div>
          <label className={lCls}>How would you describe your current health?</label>
          <textarea className={taCls} rows={3} value={currentHealth} onChange={e => setCurrentHealth(e.target.value)} placeholder="e.g. Generally okay but struggling with low energy and irregular sleep…" />
        </div>
        <div>
          <label className={lCls}>Any diagnosed conditions?</label>
          <textarea className={taCls} rows={2} value={diagnosedConditions} onChange={e => setDiagnosedConditions(e.target.value)} placeholder="e.g. Hypothyroidism, IBS, PCOS — or leave blank if none" />
        </div>
        <div>
          <label className={lCls}>Current medications or supplements</label>
          <input className={iCls} value={medications} onChange={e => setMedications(e.target.value)} placeholder="e.g. Levothyroxine 50mcg, Vitamin D, Magnesium" />
        </div>
        <div>
          <label className={lCls}>Allergies or dietary restrictions</label>
          <input className={iCls} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g. Nut allergy, lactose intolerant, gluten-free" />
        </div>
      </div>
      <NextBtn label={saving ? "Saving…" : "Continue"} onClick={onNext} disabled={saving} />
    </div>
  );
}

// ── Step 3: Goals ─────────────────────────────────────────────
function Step3({ selectedGoals, setSelectedGoals, successVision, setSuccessVision, motivationLevel, setMotivationLevel, onNext, saving }: {
  selectedGoals: string[]; setSelectedGoals: (v: string[]) => void;
  successVision: string; setSuccessVision: (v: string) => void;
  motivationLevel: string; setMotivationLevel: (v: string) => void;
  onNext: () => void; saving: boolean;
}) {
  function toggleGoal(g: string) {
    setSelectedGoals(selectedGoals.includes(g) ? selectedGoals.filter(x => x !== g) : [...selectedGoals, g]);
  }
  const motivations = [
    { value: "exploring", label: "Exploring", sub: "Just starting to look into it" },
    { value: "ready", label: "Ready", sub: "I know what I want to work on" },
    { value: "all_in", label: "All in", sub: "Fully committed to making changes" },
  ];
  return (
    <div>
      <StepHeader title="What brings you here?" sub="Select everything that resonates. You can refine this with your practitioner later." />
      <div className="space-y-7">
        <div>
          <p className={lCls}>Health goals <span className="text-[#9C9087] font-normal">(select all that apply)</span></p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {GOALS.map(g => {
              const sel = selectedGoals.includes(g);
              return (
                <button key={g} type="button" onClick={() => toggleGoal(g)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm text-left font-medium transition-all ${sel ? "border-[#4E7A5F] bg-[#EBF2EE] text-[#4E7A5F]" : "border-[#E6E0D8] bg-[#FDFCFA] text-[#5C5248] hover:border-[#4E7A5F]/40"}`}>
                  {sel && <Check size={13} className="inline mr-1.5 mb-0.5" strokeWidth={3} />}{g}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className={lCls}>What does success look like for you?</label>
          <textarea className={taCls} rows={3} value={successVision} onChange={e => setSuccessVision(e.target.value)} placeholder="In your own words, describe how you want to feel or what you want to achieve…" />
        </div>
        <div>
          <p className={lCls}>How would you describe your motivation right now?</p>
          <div className="space-y-2 mt-2">
            {motivations.map(m => (
              <button key={m.value} type="button" onClick={() => setMotivationLevel(m.value)}
                className={`w-full flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all ${motivationLevel === m.value ? "border-[#4E7A5F] bg-[#EBF2EE]" : "border-[#E6E0D8] bg-[#FDFCFA] hover:border-[#4E7A5F]/40"}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${motivationLevel === m.value ? "border-[#4E7A5F] bg-[#4E7A5F]" : "border-[#E6E0D8]"}`}>
                  {motivationLevel === m.value && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div>
                  <p className={`font-medium text-sm ${motivationLevel === m.value ? "text-[#4E7A5F]" : "text-[#1E1A16]"}`}>{m.label}</p>
                  <p className="text-xs text-[#9C9087] mt-0.5">{m.sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <NextBtn label={saving ? "Saving…" : "Continue"} onClick={onNext} disabled={saving || selectedGoals.length === 0 || !motivationLevel} />
    </div>
  );
}

// ── Step 4: Lifestyle ─────────────────────────────────────────
function Step4({ dietType, setDietType, mealsPerDay, setMealsPerDay, avgSleep, setAvgSleep, activityLevel, setActivityLevel, supportPreferences, setSupportPreferences, additionalNotes, setAdditionalNotes, onNext, saving }: {
  dietType: string; setDietType: (v: string) => void;
  mealsPerDay: string; setMealsPerDay: (v: string) => void;
  avgSleep: string; setAvgSleep: (v: string) => void;
  activityLevel: string; setActivityLevel: (v: string) => void;
  supportPreferences: string[]; setSupportPreferences: (v: string[]) => void;
  additionalNotes: string; setAdditionalNotes: (v: string) => void;
  onNext: () => void; saving: boolean;
}) {
  function toggleSupport(s: string) {
    setSupportPreferences(supportPreferences.includes(s) ? supportPreferences.filter(x => x !== s) : [...supportPreferences, s]);
  }
  return (
    <div>
      <StepHeader title="Your lifestyle" sub="This helps your practitioner understand your daily rhythms and how to fit into your life." />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>Diet type</label>
            <SelectWrap>
              <select className={sCls} value={dietType} onChange={e => setDietType(e.target.value)}>
                <option value="">Select…</option>
                {DIET_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </SelectWrap>
          </div>
          <div>
            <label className={lCls}>Meals per day</label>
            <div className="flex gap-2 mt-0.5">
              {MEALS_OPTIONS.map(m => (
                <button key={m} type="button" onClick={() => setMealsPerDay(m)}
                  className={`flex-1 rounded-xl border-2 py-2 text-xs font-medium transition-all ${mealsPerDay === m ? "border-[#4E7A5F] bg-[#EBF2EE] text-[#4E7A5F]" : "border-[#E6E0D8] bg-[#FDFCFA] text-[#5C5248] hover:border-[#4E7A5F]/40"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className={lCls}>Average sleep per night</label>
          <SelectWrap>
            <select className={sCls} value={avgSleep} onChange={e => setAvgSleep(e.target.value)}>
              <option value="">Select…</option>
              {SLEEP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </SelectWrap>
        </div>
        <div>
          <label className={lCls}>Activity level</label>
          <div className="space-y-2">
            {ACTIVITY_OPTIONS.map(a => (
              <button key={a} type="button" onClick={() => setActivityLevel(a)}
                className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-sm transition-all ${activityLevel === a ? "border-[#4E7A5F] bg-[#EBF2EE] text-[#4E7A5F]" : "border-[#E6E0D8] bg-[#FDFCFA] text-[#5C5248] hover:border-[#4E7A5F]/40"}`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${activityLevel === a ? "border-[#4E7A5F] bg-[#4E7A5F]" : "border-[#E6E0D8]"}`}>
                  {activityLevel === a && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className={lCls}>How would you like to be supported? <span className="text-[#9C9087] font-normal">(select all that apply)</span></p>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {SUPPORT_OPTIONS.map(s => {
              const sel = supportPreferences.includes(s);
              return (
                <button key={s} type="button" onClick={() => toggleSupport(s)}
                  className={`rounded-xl border-2 px-4 py-3 text-sm text-left font-medium transition-all ${sel ? "border-[#4E7A5F] bg-[#EBF2EE] text-[#4E7A5F]" : "border-[#E6E0D8] bg-[#FDFCFA] text-[#5C5248] hover:border-[#4E7A5F]/40"}`}>
                  {sel && <Check size={12} className="inline mr-1.5 mb-0.5" strokeWidth={3} />}{s}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className={lCls}>Anything else you&apos;d like your practitioner to know?</label>
          <textarea className={taCls} rows={3} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder="Work schedule, stress levels, past experiences with health practitioners, anything at all…" />
        </div>
      </div>
      <NextBtn label={saving ? "Completing setup…" : "Complete setup"} onClick={onNext} disabled={saving || !dietType || !avgSleep || !activityLevel} />
    </div>
  );
}

// ── Welcome screen ────────────────────────────────────────────
function WelcomeScreen({ firstName }: { firstName: string }) {
  const nextSteps = [
    { icon: CalendarDays, title: "Book your first session", body: "Choose a practitioner and a time that works for you. Your first consultation is where the real conversation begins." },
    { icon: BookOpen, title: "Explore your dashboard", body: "Your health home base. Track check-ins, view your care plan, and see your progress over time." },
  ];
  return (
    <div className="min-h-screen bg-[#F6F3EE] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-[#EBF2EE] flex items-center justify-center mx-auto mb-6">
          <Check size={28} className="text-[#4E7A5F]" strokeWidth={2.5} />
        </div>
        <h1 className="font-serif text-4xl text-[#1E1A16] mb-3">Welcome, {firstName}.</h1>
        <p className="text-[#9C9087] text-sm leading-relaxed mb-10">
          Your profile is all set. Your practitioner now has everything they need to start personalising your care. Here&apos;s what happens next.
        </p>
        <div className="space-y-4 mb-10 text-left">
          {nextSteps.map((s, i) => (
            <div key={i} className="flex gap-4 bg-[#FDFCFA] border border-[#E6E0D8] rounded-xl p-5">
              <div className="w-10 h-10 rounded-xl bg-[#EBF2EE] flex items-center justify-center flex-shrink-0">
                <s.icon size={18} className="text-[#4E7A5F]" />
              </div>
              <div>
                <p className="font-medium text-[#1E1A16] text-sm mb-0.5">{s.title}</p>
                <p className="text-xs text-[#9C9087] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Link href="/book" className="w-full h-12 rounded-full bg-[#4E7A5F] text-white text-base font-medium flex items-center justify-center gap-2 hover:bg-[#3d6249] transition-colors">
            Book first session <ArrowRight size={16} />
          </Link>
          <Link href="/patient/dashboard" className="w-full h-12 rounded-full border-2 border-[#E6E0D8] text-[#5C5248] text-base font-medium flex items-center justify-center gap-2 hover:border-[#4E7A5F] hover:text-[#4E7A5F] transition-colors">
            Go to my dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function PatientOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = loading
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [currentHealth, setCurrentHealth] = useState("");
  const [diagnosedConditions, setDiagnosedConditions] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [successVision, setSuccessVision] = useState("");
  const [motivationLevel, setMotivationLevel] = useState("");
  const [dietType, setDietType] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState("");
  const [avgSleep, setAvgSleep] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [supportPreferences, setSupportPreferences] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState("");

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/sign-in"); return; }
    setUserId(user.id);
    const { data: prof } = await sb.from("profiles").select("first_name,last_name,email").eq("id", user.id).single();
    if (prof) { setFirstName(prof.first_name || ""); setLastName(prof.last_name || ""); }
    const { data: pat } = await sb.from("patients").select("*").eq("profile_id", user.id).single() as { data: Patient | null; error: unknown };
    if (pat) {
      setDob(pat.date_of_birth || "");
      setCurrentHealth(pat.current_health || ""); setDiagnosedConditions(pat.diagnosed_conditions || "");
      setMedications(pat.medications || ""); setAllergies(pat.allergies || "");
      setSelectedGoals(pat.goals || []); setSuccessVision(pat.success_vision || "");
      setMotivationLevel(pat.motivation_level || ""); setDietType(pat.diet_type || "");
      setMealsPerDay(pat.meals_per_day || ""); setAvgSleep(pat.avg_sleep || "");
      setActivityLevel(pat.activity_level || ""); setSupportPreferences(pat.support_preferences || []);
      setAdditionalNotes(pat.additional_notes || "");
    }
    setStep(1);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function upsertProfile(extra: Record<string, unknown> = {}) {
    const sb = createClient();
    await sb.from("profiles").update({ first_name: firstName.trim(), last_name: lastName.trim() }).eq("id", userId!);
    const payload = {
      profile_id: userId!, date_of_birth: dob || null, current_health: currentHealth || null,
      diagnosed_conditions: diagnosedConditions || null, medications: medications || null,
      allergies: allergies || null, goals: selectedGoals.length ? selectedGoals : null,
      success_vision: successVision || null, motivation_level: motivationLevel as "exploring" | "ready" | "all_in" | null || null,
      diet_type: dietType || null, meals_per_day: mealsPerDay || null, avg_sleep: avgSleep || null,
      activity_level: activityLevel || null,
      support_preferences: supportPreferences.length ? supportPreferences : null,
      additional_notes: additionalNotes || null, ...extra,
    };
    const { data: existing } = await sb.from("patients").select("id").eq("profile_id", userId!).single();
    if (existing) await sb.from("patients").update(payload).eq("profile_id", userId!);
    else await sb.from("patients").insert(payload);
  }

  async function step1Next() { setSaving(true); await upsertProfile(); setSaving(false); setStep(2); }
  async function step2Next() { setSaving(true); await upsertProfile(); setSaving(false); setStep(3); }
  async function step3Next() { setSaving(true); await upsertProfile(); setSaving(false); setStep(4); }
  async function step4Next() { setSaving(true); await upsertProfile(); setSaving(false); setDone(true); }

  if (step === 0) return (
    <div className="min-h-screen bg-[#F6F3EE] flex items-center justify-center">
      <div className="text-center"><div className="w-8 h-8 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-[#9C9087]">Getting things ready…</p></div>
    </div>
  );

  if (done) return <WelcomeScreen firstName={firstName} />;

  return (
    <div className="min-h-screen bg-[#F6F3EE] flex">
      <Sidebar step={step} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-16">
          {step === 1 && <Step1 firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} dob={dob} setDob={setDob} onNext={step1Next} saving={saving} />}
          {step === 2 && <Step2 currentHealth={currentHealth} setCurrentHealth={setCurrentHealth} diagnosedConditions={diagnosedConditions} setDiagnosedConditions={setDiagnosedConditions} medications={medications} setMedications={setMedications} allergies={allergies} setAllergies={setAllergies} onNext={step2Next} saving={saving} />}
          {step === 3 && <Step3 selectedGoals={selectedGoals} setSelectedGoals={setSelectedGoals} successVision={successVision} setSuccessVision={setSuccessVision} motivationLevel={motivationLevel} setMotivationLevel={setMotivationLevel} onNext={step3Next} saving={saving} />}
          {step === 4 && <Step4 dietType={dietType} setDietType={setDietType} mealsPerDay={mealsPerDay} setMealsPerDay={setMealsPerDay} avgSleep={avgSleep} setAvgSleep={setAvgSleep} activityLevel={activityLevel} setActivityLevel={setActivityLevel} supportPreferences={supportPreferences} setSupportPreferences={setSupportPreferences} additionalNotes={additionalNotes} setAdditionalNotes={setAdditionalNotes} onNext={step4Next} saving={saving} />}
        </div>
      </main>
    </div>
  );
}
