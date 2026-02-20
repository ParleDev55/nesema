"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Users, MessageSquare, ChevronRight } from "lucide-react";
import type { PatientListItem } from "@/app/(practitioner)/practitioner/patients/page";

const MOOD_EMOJI: Record<number, string> = {
  1: "😞",
  2: "😐",
  3: "🙂",
  4: "😊",
  5: "😄",
};

type FilterTab = "All" | "Active" | "Needs Attention" | "New";

function daysSince(iso: string | null): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function relativeDate(iso: string | null): string {
  if (!iso) return "Never";
  const days = daysSince(iso);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function PatientListClient({ patients }: { patients: PatientListItem[] }) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("All");

  const filtered = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;

    return patients
      .filter((p) => {
        if (search) {
          const q = search.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (tab === "Needs Attention") return daysSince(p.lastCheckIn) >= 3;
        if (tab === "New") return new Date(p.createdAt).getTime() > sevenDaysAgo;
        if (tab === "Active") return daysSince(p.lastCheckIn) < 3;
        return true;
      });
  }, [patients, search, tab]);

  const tabs: FilterTab[] = ["All", "Active", "Needs Attention", "New"];

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-nesema-t1">Patients</h1>
          <p className="text-nesema-t3 text-sm mt-0.5">
            {patients.length} patient{patients.length !== 1 ? "s" : ""} in your practice
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-nesema-t3"
        />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-full border border-nesema-bdr bg-white text-sm text-nesema-t1 placeholder:text-nesema-t3 focus:outline-none focus:ring-2 focus:ring-nesema-sage/40"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t
                ? "bg-nesema-bark text-white"
                : "bg-white border border-nesema-bdr text-nesema-t2 hover:bg-nesema-bg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-nesema-bdr p-12 text-center">
          <Users className="mx-auto text-nesema-t4 mb-3" size={40} />
          {patients.length === 0 ? (
            <>
              <p className="text-nesema-t1 font-medium mb-1">No patients yet</p>
              <p className="text-nesema-t3 text-sm max-w-xs mx-auto">
                Your patients will appear here once they complete onboarding and are linked to your practice.
              </p>
            </>
          ) : (
            <>
              <p className="text-nesema-t1 font-medium mb-1">No results</p>
              <p className="text-nesema-t3 text-sm">
                Try adjusting your search or filter.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-nesema-bdr divide-y divide-nesema-bdr">
          {filtered.map((p) => {
            const needsAttention = daysSince(p.lastCheckIn) >= 3;
            return (
              <Link
                key={p.id}
                href={`/practitioner/patients/${p.id}`}
                className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-4 hover:bg-nesema-bg transition-colors group"
              >
                {/* Avatar */}
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold ${
                    needsAttention ? "bg-amber-400" : "bg-nesema-sage"
                  }`}
                >
                  {p.initials}
                </div>

                {/* Name + week */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-nesema-t1 truncate">{p.name}</p>
                    {needsAttention && (
                      <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium flex-shrink-0">
                        Needs attention
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-nesema-t3 truncate">
                    Week {p.week} · Last check-in: {relativeDate(p.lastCheckIn)}
                  </p>
                </div>

                {/* Adherence — hidden on small mobile */}
                <div className="hidden sm:block text-center flex-shrink-0 w-16">
                  <p className="text-sm font-semibold text-nesema-t1">{p.adherence}%</p>
                  <p className="text-[10px] text-nesema-t3">adherence</p>
                </div>

                {/* Mood trend */}
                <div className="hidden md:flex gap-0.5 flex-shrink-0">
                  {p.moodTrend.length > 0 ? (
                    p.moodTrend.map((m, i) => (
                      <span key={i} className="text-base">
                        {m ? MOOD_EMOJI[m] : "—"}
                      </span>
                    ))
                  ) : (
                    <span className="text-nesema-t4 text-xs">No data</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/practitioner/messages?to=${p.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden sm:flex h-8 w-8 rounded-full border border-nesema-bdr items-center justify-center text-nesema-t3 hover:text-nesema-t1 hover:border-nesema-t2 transition-colors"
                  >
                    <MessageSquare size={14} />
                  </Link>
                  <ChevronRight
                    size={18}
                    className="text-nesema-t4 group-hover:text-nesema-t2 transition-colors"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
