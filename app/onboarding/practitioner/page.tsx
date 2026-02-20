"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Practitioner, Database } from "@/types/database";
type AvailabilityRow = Database["public"]["Tables"]["availability"]["Row"];
import { Check, Upload, AlertTriangle, ChevronRight, Flame } from "lucide-react";

const STEPS = [
  { number: 1, label: "Account details" },
  { number: 2, label: "Credentials" },
  { number: 3, label: "Practice setup" },
  { number: 4, label: "Availability" },
  { number: 5, label: "Review & go live" },
];
const DISCIPLINES = ["Functional Nutritionist","Physiotherapist","Sleep Coach","Personal Trainer","Naturopath","Psychotherapist","Osteopath","Acupuncturist","Health Coach"];
const YEARS_OPTIONS = ["Less than 1","1–2","3–5","6–10","10+"];
const SESSION_LENGTHS = [30, 45, 60, 90, 120];
const BUFFER_MINS = [0, 5, 10, 15, 30];
const NOTICE_OPTIONS = [{ label: "4 hours", value: 4 },{ label: "12 hours", value: 12 },{ label: "24 hours", value: 24 },{ label: "48 hours", value: 48 },{ label: "72 hours", value: 72 }];
const CANCELLATION_OPTIONS = [{ label: "4 hours notice", value: 4 },{ label: "12 hours notice", value: 12 },{ label: "24 hours notice", value: 24 },{ label: "48 hours notice", value: 48 }];
const DAY_MAP = [
  { label: "Monday",    short: "Mon", dayOfWeek: 1 },
  { label: "Tuesday",   short: "Tue", dayOfWeek: 2 },
  { label: "Wednesday", short: "Wed", dayOfWeek: 3 },
  { label: "Thursday",  short: "Thu", dayOfWeek: 4 },
  { label: "Friday",    short: "Fri", dayOfWeek: 5 },
  { label: "Saturday",  short: "Sat", dayOfWeek: 6 },
  { label: "Sunday",    short: "Sun", dayOfWeek: 0 },
];

interface DaySlot { active: boolean; startTime: string; endTime: string }
type DayAvail = Record<number, DaySlot>;

const iCls = "w-full rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] px-4 py-2.5 text-sm text-[#1E1A16] placeholder:text-[#BFB8B0] focus:outline-none focus:ring-2 focus:ring-[#4E7A5F] focus:border-[#4E7A5F] transition-colors";
const sCls = "w-full rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] px-4 py-2.5 text-sm text-[#1E1A16] focus:outline-none focus:ring-2 focus:ring-[#4E7A5F] transition-colors appearance-none cursor-pointer";
const lCls = "block text-sm font-medium text-[#5C5248] mb-1.5";

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-").replace(/-+/g,"-"); }

function Sidebar({ step }: { step: number }) {
  return (
    <aside className="w-64 bg-[#2A2118] flex-shrink-0 flex flex-col min-h-screen">
      <div className="px-8 pt-10 pb-8 border-b border-white/10">
        <span className="font-serif text-2xl font-semibold text-white tracking-wide">Nesema</span>
        <p className="text-[11px] text-white/40 mt-0.5">Practitioner setup</p>
      </div>
      <nav className="flex-1 px-6 pt-8">
        {STEPS.map((s, i) => {
          const done = step > s.number; const active = step === s.number;
          return (
            <div key={s.number} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${done ? "bg-[#4E7A5F] text-white" : active ? "bg-white text-[#2A2118]" : "border border-white/20 text-white/30"}`}>
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
      <p className="px-6 pb-8 text-[11px] text-white/20 leading-relaxed">Your information is handled securely and never shared without consent.</p>
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

function SummaryCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9C9087] mb-3">{label}</p>
      {children}
    </div>
  );
}

// ── Step 1: Account ───────────────────────────────────────────
function Step1({ firstName, setFirstName, lastName, setLastName, email, onNext, saving }: {
  firstName: string; setFirstName: (v: string) => void; lastName: string; setLastName: (v: string) => void;
  email: string; onNext: () => void; saving: boolean;
}) {
  return (
    <div>
      <StepHeader title="Let's set up your account" sub="Confirm your name — this is how patients will see you on Nesema." />
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lCls}>First name</label><input className={iCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Emma" /></div>
          <div><label className={lCls}>Last name</label><input className={iCls} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Clarke" /></div>
        </div>
        <div>
          <label className={lCls}>Email address</label>
          <input type="email" readOnly value={email} className={`${iCls} bg-[#F6F3EE] text-[#9C9087] cursor-not-allowed`} />
          <p className="text-xs text-[#9C9087] mt-1.5">Set at sign-up and cannot be changed here.</p>
        </div>
      </div>
      <NextBtn label={saving ? "Saving…" : "Continue"} onClick={onNext} disabled={saving || !firstName.trim() || !lastName.trim()} />
    </div>
  );
}

// ── Step 2: Credentials ───────────────────────────────────────
function Step2({ discipline, setDiscipline, registrationBody, setRegistrationBody, registrationNumber, setRegistrationNumber, yearsOfPractice, setYearsOfPractice, proofFileName, setProofFileName, onNext, saving }: {
  discipline: string; setDiscipline: (v: string) => void; registrationBody: string; setRegistrationBody: (v: string) => void;
  registrationNumber: string; setRegistrationNumber: (v: string) => void; yearsOfPractice: string; setYearsOfPractice: (v: string) => void;
  proofFileName: string; setProofFileName: (v: string) => void; onNext: () => void; saving: boolean;
}) {
  const ok = discipline && registrationBody.trim() && registrationNumber.trim() && yearsOfPractice;
  return (
    <div>
      <StepHeader title="Your credentials" sub="We verify every practitioner before they go live. This keeps the platform trusted and safe." />
      <div className="flex gap-3 bg-[#F9F1E6] border border-[#C27D30]/30 rounded-xl px-4 py-3 mb-6">
        <AlertTriangle size={16} className="text-[#C27D30] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-[#C27D30]">Verification typically takes <strong>1–2 business days</strong>. Complete your setup now — we&apos;ll notify you when approved.</p>
      </div>
      <div className="space-y-5">
        <div>
          <label className={lCls}>Discipline</label>
          <SelectWrap>
            <select className={sCls} value={discipline} onChange={e => setDiscipline(e.target.value)}>
              <option value="">Select your discipline…</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </SelectWrap>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lCls}>Registration body</label><input className={iCls} value={registrationBody} onChange={e => setRegistrationBody(e.target.value)} placeholder="e.g. BANT, HCPC" /></div>
          <div><label className={lCls}>Registration number</label><input className={iCls} value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} placeholder="Your reg. number" /></div>
        </div>
        <div>
          <label className={lCls}>Years of practice</label>
          <SelectWrap>
            <select className={sCls} value={yearsOfPractice} onChange={e => setYearsOfPractice(e.target.value)}>
              <option value="">Select…</option>
              {YEARS_OPTIONS.map(y => <option key={y} value={y}>{y} years</option>)}
            </select>
          </SelectWrap>
        </div>
        <div>
          <label className={lCls}>Proof of registration</label>
          <label className="flex items-center gap-3 w-full rounded-xl border-2 border-dashed border-[#E6E0D8] bg-[#FDFCFA] px-4 py-4 cursor-pointer hover:border-[#4E7A5F] transition-colors">
            <div className="h-10 w-10 rounded-xl bg-[#EBF2EE] flex items-center justify-center flex-shrink-0"><Upload size={18} className="text-[#4E7A5F]" /></div>
            <div className="flex-1 min-w-0">
              {proofFileName ? <><p className="text-sm font-medium text-[#1E1A16] truncate">{proofFileName}</p><p className="text-xs text-[#9C9087]">Click to change</p></> : <><p className="text-sm font-medium text-[#5C5248]">Upload your certificate or registration card</p><p className="text-xs text-[#9C9087]">PDF, JPG or PNG · Max 10 MB</p></>}
            </div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) setProofFileName(f.name); }} />
          </label>
        </div>
      </div>
      <NextBtn label={saving ? "Saving…" : "Continue"} onClick={onNext} disabled={saving || !ok} />
    </div>
  );
}

// ── Step 3: Practice setup ────────────────────────────────────
function Step3({ practiceName, setPracticeName, bio, setBio, sessionLengthMins, setSessionLengthMins, bufferMins, setBufferMins, allowsSelfBooking, setAllowsSelfBooking, initialFee, setInitialFee, followupFee, setFollowupFee, onNext, saving }: {
  practiceName: string; setPracticeName: (v: string) => void; bio: string; setBio: (v: string) => void;
  sessionLengthMins: number; setSessionLengthMins: (v: number) => void; bufferMins: number; setBufferMins: (v: number) => void;
  allowsSelfBooking: boolean; setAllowsSelfBooking: (v: boolean) => void;
  initialFee: string; setInitialFee: (v: string) => void; followupFee: string; setFollowupFee: (v: string) => void;
  onNext: () => void; saving: boolean;
}) {
  return (
    <div>
      <StepHeader title="Your practice" sub="Tell patients about your practice. This appears on your public booking page." />
      <div className="space-y-5">
        <div><label className={lCls}>Practice name</label><input className={iCls} value={practiceName} onChange={e => setPracticeName(e.target.value)} placeholder="e.g. Clarke Nutrition & Wellness" /></div>
        <div>
          <label className={lCls}>Short bio</label>
          <textarea className="w-full rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] px-4 py-3 text-sm text-[#1E1A16] placeholder:text-[#BFB8B0] focus:outline-none focus:ring-2 focus:ring-[#4E7A5F] transition-colors resize-none" rows={4} value={bio} onChange={e => setBio(e.target.value.slice(0,400))} placeholder="Describe your approach, philosophy, and what patients can expect…" />
          <p className="text-xs text-[#9C9087] mt-1">{bio.length}/400</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>Session length</label>
            <SelectWrap><select className={sCls} value={sessionLengthMins} onChange={e => setSessionLengthMins(Number(e.target.value))}>{SESSION_LENGTHS.map(v => <option key={v} value={v}>{v} minutes</option>)}</select></SelectWrap>
          </div>
          <div>
            <label className={lCls}>Buffer between sessions</label>
            <SelectWrap><select className={sCls} value={bufferMins} onChange={e => setBufferMins(Number(e.target.value))}>{BUFFER_MINS.map(v => <option key={v} value={v}>{v === 0 ? "No buffer" : `${v} min`}</option>)}</select></SelectWrap>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lCls}>Initial consultation fee</label>
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#9C9087]">£</span><input type="number" min="0" className={`${iCls} pl-8`} value={initialFee} onChange={e => setInitialFee(e.target.value)} placeholder="0" /></div>
          </div>
          <div>
            <label className={lCls}>Follow-up fee</label>
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#9C9087]">£</span><input type="number" min="0" className={`${iCls} pl-8`} value={followupFee} onChange={e => setFollowupFee(e.target.value)} placeholder="0" /></div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] px-5 py-4">
          <div><p className="text-sm font-medium text-[#1E1A16]">Allow patient self-booking</p><p className="text-xs text-[#9C9087] mt-0.5">Patients can book directly from your public page</p></div>
          <button type="button" onClick={() => setAllowsSelfBooking(!allowsSelfBooking)} className={`relative w-12 h-6 rounded-full transition-colors ${allowsSelfBooking ? "bg-[#4E7A5F]" : "bg-[#E6E0D8]"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${allowsSelfBooking ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
      </div>
      <NextBtn label={saving ? "Saving…" : "Continue"} onClick={onNext} disabled={saving || !practiceName.trim() || !bio.trim()} />
    </div>
  );
}

// ── Step 4: Availability ──────────────────────────────────────
function Step4({ availability, setAvailability, bookingNoticeHours, setBookingNoticeHours, cancellationHours, setCancellationHours, bookingSlug, setBookingSlug, onNext, saving }: {
  availability: DayAvail; setAvailability: (v: DayAvail) => void;
  bookingNoticeHours: number; setBookingNoticeHours: (v: number) => void;
  cancellationHours: number; setCancellationHours: (v: number) => void;
  bookingSlug: string; setBookingSlug: (v: string) => void;
  onNext: () => void; saving: boolean;
}) {
  const hasActive = DAY_MAP.some(d => availability[d.dayOfWeek]?.active);
  function upd(dow: number, field: keyof DaySlot, val: boolean | string) {
    setAvailability({ ...availability, [dow]: { ...availability[dow], [field]: val } });
  }
  return (
    <div>
      <StepHeader title="Your availability" sub="Set your working hours and booking preferences. Update these any time from settings." />
      <div className="space-y-6">
        <div>
          <p className={lCls}>Working hours</p>
          <div className="space-y-2">
            {DAY_MAP.map(({ short, dayOfWeek }) => {
              const slot = availability[dayOfWeek] ?? { active: false, startTime: "09:00", endTime: "17:00" };
              return (
                <div key={dayOfWeek} className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-colors ${slot.active ? "border-[#4E7A5F]/40 bg-[#EBF2EE]/30" : "border-[#E6E0D8] bg-[#FDFCFA]"}`}>
                  <button type="button" onClick={() => upd(dayOfWeek, "active", !slot.active)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${slot.active ? "bg-[#4E7A5F] border-[#4E7A5F]" : "border-[#E6E0D8] bg-white"}`}>
                    {slot.active && <Check size={11} className="text-white" strokeWidth={3} />}
                  </button>
                  <span className={`text-sm font-medium w-9 flex-shrink-0 ${slot.active ? "text-[#1E1A16]" : "text-[#9C9087]"}`}>{short}</span>
                  {slot.active ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={slot.startTime} onChange={e => upd(dayOfWeek, "startTime", e.target.value)} className="flex-1 rounded-lg border border-[#E6E0D8] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]" />
                      <span className="text-xs text-[#9C9087]">to</span>
                      <input type="time" value={slot.endTime} onChange={e => upd(dayOfWeek, "endTime", e.target.value)} className="flex-1 rounded-lg border border-[#E6E0D8] bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]" />
                    </div>
                  ) : <span className="text-sm text-[#BFB8B0]">Unavailable</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={lCls}>Minimum booking notice</label><SelectWrap><select className={sCls} value={bookingNoticeHours} onChange={e => setBookingNoticeHours(Number(e.target.value))}>{NOTICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></SelectWrap></div>
          <div><label className={lCls}>Cancellation policy</label><SelectWrap><select className={sCls} value={cancellationHours} onChange={e => setCancellationHours(Number(e.target.value))}>{CANCELLATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></SelectWrap></div>
        </div>
        <div>
          <label className={lCls}>Your booking page URL</label>
          <div className="flex items-center rounded-xl border border-[#E6E0D8] bg-[#FDFCFA] overflow-hidden focus-within:ring-2 focus-within:ring-[#4E7A5F] transition-all">
            <span className="px-4 py-2.5 text-sm text-[#9C9087] bg-[#F6F3EE] border-r border-[#E6E0D8] whitespace-nowrap flex-shrink-0">nesema.com/book/</span>
            <input type="text" value={bookingSlug} onChange={e => setBookingSlug(slugify(e.target.value))} placeholder="your-name" className="flex-1 px-4 py-2.5 text-sm text-[#1E1A16] bg-transparent focus:outline-none" />
          </div>
          {bookingSlug && <p className="text-xs text-[#4E7A5F] font-medium mt-1.5">nesema.com/book/{bookingSlug}</p>}
        </div>
      </div>
      <NextBtn label={saving ? "Saving…" : "Review & go live"} onClick={onNext} disabled={saving || !hasActive || !bookingSlug.trim()} />
    </div>
  );
}

// ── Step 5: Review ────────────────────────────────────────────
function Step5({ firstName, lastName, email, discipline, registrationBody, registrationNumber, yearsOfPractice, practiceName, bio, sessionLengthMins, bufferMins, allowsSelfBooking, initialFee, followupFee, availability, bookingSlug, cancellationHours, onGoLive, saving }: {
  firstName: string; lastName: string; email: string; discipline: string; registrationBody: string; registrationNumber: string;
  yearsOfPractice: string; practiceName: string; bio: string; sessionLengthMins: number; bufferMins: number;
  allowsSelfBooking: boolean; initialFee: string; followupFee: string; availability: DayAvail;
  bookingSlug: string; cancellationHours: number; onGoLive: () => void; saving: boolean;
}) {
  const activeDays = DAY_MAP.filter(d => availability[d.dayOfWeek]?.active);
  return (
    <div>
      <StepHeader title="Review & go live" sub="Check everything looks right. You can edit any of this later from settings." />
      <div className="flex gap-3 bg-[#EBF2EE] border border-[#4E7A5F]/30 rounded-xl px-4 py-3 mb-6">
        <div className="w-5 h-5 rounded-full bg-[#4E7A5F] flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={11} className="text-white" strokeWidth={3} /></div>
        <div>
          <p className="text-sm font-semibold text-[#4E7A5F]">You&apos;re almost live</p>
          <p className="text-xs text-[#4E7A5F]/80 mt-0.5">Once you go live, your profile is submitted for verification. You&apos;ll hear back within 1–2 business days.</p>
        </div>
      </div>
      <div className="space-y-4">
        <SummaryCard label="Account">
          <p className="font-medium text-[#1E1A16]">{firstName} {lastName}</p>
          <p className="text-sm text-[#9C9087]">{email}</p>
        </SummaryCard>
        <SummaryCard label="Credentials">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[["Discipline", discipline],["Years", yearsOfPractice],["Reg. body", registrationBody],["Reg. number", registrationNumber]].map(([k,v]) => (
              <div key={k}><p className="text-[#9C9087]">{k}</p><p className="font-medium text-[#1E1A16]">{v || "—"}</p></div>
            ))}
          </div>
        </SummaryCard>
        <SummaryCard label="Practice">
          <p className="font-medium text-[#1E1A16] mb-1">{practiceName || "—"}</p>
          {bio && <p className="text-sm text-[#5C5248] leading-relaxed line-clamp-2 mb-3">{bio}</p>}
          <div className="flex gap-5 text-sm flex-wrap">
            {[["Session",`${sessionLengthMins} min`],["Buffer",bufferMins > 0 ? `${bufferMins} min` : "None"],["Initial",initialFee ? `£${initialFee}` : "Free"],["Follow-up",followupFee ? `£${followupFee}` : "Free"]].map(([k,v]) => (
              <div key={k}><p className="text-[#9C9087]">{k}</p><p className="font-medium text-[#1E1A16]">{v}</p></div>
            ))}
          </div>
          <p className="text-xs text-[#9C9087] mt-2">Self-booking: {allowsSelfBooking ? "Enabled" : "Disabled"}</p>
        </SummaryCard>
        <SummaryCard label="Availability">
          {activeDays.length === 0 ? <p className="text-sm text-[#9C9087]">No days set</p> : (
            <div className="space-y-1 mb-3">
              {activeDays.map(({ label, dayOfWeek }) => (
                <div key={dayOfWeek} className="flex justify-between text-sm">
                  <span className="font-medium text-[#5C5248]">{label}</span>
                  <span className="text-[#9C9087]">{availability[dayOfWeek].startTime} – {availability[dayOfWeek].endTime}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-[#9C9087]">Booking page: <span className="text-[#4E7A5F] font-medium">nesema.com/book/{bookingSlug}</span></p>
          <p className="text-xs text-[#9C9087] mt-0.5">Cancellation: {cancellationHours}h notice required</p>
        </SummaryCard>
      </div>
      <button onClick={onGoLive} disabled={saving} className="w-full mt-8 h-12 rounded-full bg-[#4E7A5F] text-white text-base font-medium flex items-center justify-center gap-2 hover:bg-[#3d6249] transition-colors disabled:opacity-50">
        {saving ? "Going live…" : <><Flame size={16} /> Go live</>}
      </button>
      <p className="text-center text-xs text-[#9C9087] mt-4">You can update any details from Settings after going live.</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function PractitionerOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pracDbId, setPracDbId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [registrationBody, setRegistrationBody] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [yearsOfPractice, setYearsOfPractice] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [bio, setBio] = useState("");
  const [sessionLengthMins, setSessionLengthMins] = useState(60);
  const [bufferMins, setBufferMins] = useState(10);
  const [allowsSelfBooking, setAllowsSelfBooking] = useState(true);
  const [initialFee, setInitialFee] = useState("");
  const [followupFee, setFollowupFee] = useState("");
  const blank: DaySlot = { active: false, startTime: "09:00", endTime: "17:00" };
  const [availability, setAvailability] = useState<DayAvail>({
    0: { ...blank }, 1: { ...blank, active: true }, 2: { ...blank, active: true },
    3: { ...blank, active: true }, 4: { ...blank, active: true }, 5: { ...blank, active: true }, 6: { ...blank },
  });
  const [bookingNoticeHours, setBookingNoticeHours] = useState(24);
  const [cancellationHours, setCancellationHours] = useState(24);
  const [bookingSlug, setBookingSlug] = useState("");

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/sign-in"); return; }
    setUserId(user.id);
    const { data: prof } = await sb.from("profiles").select("first_name,last_name,email").eq("id", user.id).single();
    if (prof) { setFirstName(prof.first_name || ""); setLastName(prof.last_name || ""); setEmail(prof.email || user.email || ""); }
    else setEmail(user.email || "");
    const { data: prac } = await sb.from("practitioners").select("*").eq("profile_id", user.id).single() as { data: Practitioner | null; error: unknown };
    if (prac) {
      setPracDbId(prac.id);
      setDiscipline(prac.discipline || ""); setRegistrationBody(prac.registration_body || "");
      setRegistrationNumber(prac.registration_number || ""); setYearsOfPractice(prac.years_of_practice || "");
      setPracticeName(prac.practice_name || ""); setBio(prac.bio || "");
      setSessionLengthMins(prac.session_length_mins || 60); setBufferMins(prac.buffer_mins || 10);
      setAllowsSelfBooking(prac.allows_self_booking ?? true);
      setInitialFee(prac.initial_fee ? String(prac.initial_fee / 100) : "");
      setFollowupFee(prac.followup_fee ? String(prac.followup_fee / 100) : "");
      setCancellationHours(prac.cancellation_hours || 24); setBookingSlug(prac.booking_slug || "");
      const { data: avail } = await sb.from("availability").select("*").eq("practitioner_id", prac.id) as { data: AvailabilityRow[] | null; error: unknown };
      if (avail?.length) {
        const map: DayAvail = Object.fromEntries([0,1,2,3,4,5,6].map(d => [d, { active: false, startTime: "09:00", endTime: "17:00" }]));
        avail.forEach(r => { map[r.day_of_week] = { active: r.is_active, startTime: r.start_time.slice(0,5), endTime: r.end_time.slice(0,5) }; });
        setAvailability(map);
      }
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function upsert(extra: Record<string, unknown> = {}) {
    const sb = createClient();
    const payload = {
      profile_id: userId!, discipline, registration_body: registrationBody, registration_number: registrationNumber,
      years_of_practice: yearsOfPractice, practice_name: practiceName, bio,
      session_length_mins: sessionLengthMins, buffer_mins: bufferMins, allows_self_booking: allowsSelfBooking,
      initial_fee: initialFee ? Math.round(parseFloat(initialFee) * 100) : null,
      followup_fee: followupFee ? Math.round(parseFloat(followupFee) * 100) : null,
      cancellation_hours: cancellationHours, booking_slug: bookingSlug || null, ...extra,
    };
    if (pracDbId) { await sb.from("practitioners").update(payload).eq("id", pracDbId); return pracDbId; }
    else { const { data } = await sb.from("practitioners").insert(payload).select("id").single(); if (data?.id) setPracDbId(data.id); return data?.id ?? null; }
  }

  async function step1Next() { setSaving(true); await createClient().from("profiles").update({ first_name: firstName.trim(), last_name: lastName.trim() }).eq("id", userId!); setSaving(false); setStep(2); }
  async function step2Next() { setSaving(true); await upsert(); setSaving(false); setStep(3); }
  async function step3Next() { setSaving(true); await upsert(); setSaving(false); setStep(4); }
  async function step4Next() {
    setSaving(true);
    const id = await upsert({ booking_slug: bookingSlug, cancellation_hours: cancellationHours });
    if (id) {
      const sb = createClient();
      await sb.from("availability").delete().eq("practitioner_id", id);
      const rows = DAY_MAP.filter(d => availability[d.dayOfWeek]?.active).map(({ dayOfWeek }) => ({ practitioner_id: id, day_of_week: dayOfWeek, start_time: availability[dayOfWeek].startTime, end_time: availability[dayOfWeek].endTime, is_active: true }));
      if (rows.length) await sb.from("availability").insert(rows);
    }
    setSaving(false); setStep(5);
  }
  async function goLive() { setSaving(true); await upsert({ is_live: true }); setSaving(false); router.push("/practitioner/dashboard"); }

  if (loading) return (
    <div className="min-h-screen bg-[#F6F3EE] flex items-center justify-center">
      <div className="text-center"><div className="w-8 h-8 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-[#9C9087]">Loading your setup…</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F6F3EE] flex">
      <Sidebar step={step} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-16">
          {step === 1 && <Step1 firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} email={email} onNext={step1Next} saving={saving} />}
          {step === 2 && <Step2 discipline={discipline} setDiscipline={setDiscipline} registrationBody={registrationBody} setRegistrationBody={setRegistrationBody} registrationNumber={registrationNumber} setRegistrationNumber={setRegistrationNumber} yearsOfPractice={yearsOfPractice} setYearsOfPractice={setYearsOfPractice} proofFileName={proofFileName} setProofFileName={setProofFileName} onNext={step2Next} saving={saving} />}
          {step === 3 && <Step3 practiceName={practiceName} setPracticeName={setPracticeName} bio={bio} setBio={setBio} sessionLengthMins={sessionLengthMins} setSessionLengthMins={setSessionLengthMins} bufferMins={bufferMins} setBufferMins={setBufferMins} allowsSelfBooking={allowsSelfBooking} setAllowsSelfBooking={setAllowsSelfBooking} initialFee={initialFee} setInitialFee={setInitialFee} followupFee={followupFee} setFollowupFee={setFollowupFee} onNext={step3Next} saving={saving} />}
          {step === 4 && <Step4 availability={availability} setAvailability={setAvailability} bookingNoticeHours={bookingNoticeHours} setBookingNoticeHours={setBookingNoticeHours} cancellationHours={cancellationHours} setCancellationHours={setCancellationHours} bookingSlug={bookingSlug} setBookingSlug={setBookingSlug} onNext={step4Next} saving={saving} />}
          {step === 5 && <Step5 firstName={firstName} lastName={lastName} email={email} discipline={discipline} registrationBody={registrationBody} registrationNumber={registrationNumber} yearsOfPractice={yearsOfPractice} practiceName={practiceName} bio={bio} sessionLengthMins={sessionLengthMins} bufferMins={bufferMins} allowsSelfBooking={allowsSelfBooking} initialFee={initialFee} followupFee={followupFee} availability={availability} bookingSlug={bookingSlug} cancellationHours={cancellationHours} onGoLive={goLive} saving={saving} />}
        </div>
      </main>
    </div>
  );
}
