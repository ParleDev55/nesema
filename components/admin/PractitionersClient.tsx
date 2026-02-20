"use client";

import { useState } from "react";
import { X, ChevronRight, ExternalLink } from "lucide-react";

type VerificationStatus = "pending" | "verified" | "rejected";

interface PractitionerRow {
  id: string;
  profile_id: string;
  practice_name: string | null;
  discipline: string | null;
  registration_body: string | null;
  registration_number: string | null;
  bio: string | null;
  verification_status: VerificationStatus | null;
  booking_slug: string | null;
  session_length_mins: number;
  initial_fee: number | null;
  followup_fee: number | null;
  is_live: boolean;
  stripe_account_id: string | null;
  created_at: string;
  patientCount: number;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    avatar_url: string | null;
    suspended: boolean;
  } | null;
}

type FilterTab = "all" | "pending" | "verified" | "rejected" | "suspended";

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-green-100 text-green-700",
  pending: "bg-[#F9F1E6] text-[#C27D30]",
  rejected: "bg-red-100 text-red-700",
  suspended: "bg-gray-100 text-gray-600",
};

function StatusBadge({ status, suspended }: { status: string | null; suspended?: boolean }) {
  if (suspended) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Suspended</span>;
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status ?? "pending"] ?? STATUS_COLORS.pending}`}>
      {status ?? "pending"}
    </span>
  );
}

export function PractitionersClient({ practitioners }: { practitioners: PractitionerRow[] }) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<PractitionerRow | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rows, setRows] = useState(practitioners);

  const filtered = rows.filter((p) => {
    if (tab === "all") return true;
    if (tab === "suspended") return p.profiles?.suspended;
    return p.verification_status === tab && !p.profiles?.suspended;
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function callAction(url: string, body?: object) {
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Request failed");
      }
      return true;
    } catch (e) {
      showToast((e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  function updateRow(id: string, patch: Partial<PractitionerRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function verify(p: PractitionerRow) {
    const ok = await callAction(`/api/admin/practitioners/${p.id}/verify`);
    if (ok) {
      updateRow(p.id, { verification_status: "verified", is_live: true });
      showToast("Practitioner verified and set live.");
      setSelected(null);
    }
  }

  async function reject(p: PractitionerRow) {
    if (!rejectReason.trim()) return;
    const ok = await callAction(`/api/admin/practitioners/${p.id}/reject`, { reason: rejectReason });
    if (ok) {
      updateRow(p.id, { verification_status: "rejected" });
      showToast("Practitioner rejected.");
      setRejectModal(false);
      setRejectReason("");
      setSelected(null);
    }
  }

  async function suspend(p: PractitionerRow) {
    const ok = await callAction(`/api/admin/practitioners/${p.id}/suspend`);
    if (ok) {
      updateRow(p.id, {
        is_live: false,
        profiles: p.profiles ? { ...p.profiles, suspended: true } : p.profiles,
      });
      showToast("Practitioner suspended.");
      setSelected(null);
    }
  }

  async function reinstate(p: PractitionerRow) {
    const ok = await callAction(`/api/admin/practitioners/${p.id}/reinstate`);
    if (ok) {
      updateRow(p.id, {
        is_live: true,
        verification_status: "verified",
        profiles: p.profiles ? { ...p.profiles, suspended: false } : p.profiles,
      });
      showToast("Practitioner reinstated.");
      setSelected(null);
    }
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "pending", label: "Pending" },
    { id: "verified", label: "Verified" },
    { id: "rejected", label: "Rejected" },
    { id: "suspended", label: "Suspended" },
  ];

  return (
    <div className="p-6 md:p-8">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg"
          style={{ backgroundColor: "#C27D30" }}
        >
          {toast}
        </div>
      )}

      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Practitioners</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-nesema-bg rounded-2xl p-1 border border-nesema-bdr w-fit">
        {tabs.map((t) => {
          const count = t.id === "all"
            ? rows.length
            : t.id === "suspended"
            ? rows.filter((r) => r.profiles?.suspended).length
            : rows.filter((r) => r.verification_status === t.id && !r.profiles?.suspended).length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                tab === t.id
                  ? "text-white shadow-sm"
                  : "text-nesema-t3 hover:text-nesema-t2"
              }`}
              style={tab === t.id ? { backgroundColor: "#C27D30" } : {}}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${tab === t.id ? "bg-white/30" : "bg-nesema-bdr"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-nesema-t3 text-sm">No practitioners match this filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-nesema-bdr">
              <tr>
                {["Name", "Discipline", "Registration", "Status", "Patients", "Joined", ""].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-widest"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nesema-bdr">
              {filtered.map((p) => {
                const name = [p.profiles?.first_name, p.profiles?.last_name].filter(Boolean).join(" ") || "—";
                return (
                  <tr key={p.id} className="hover:bg-nesema-bg/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-nesema-t1">{name}</div>
                      <div className="text-xs text-nesema-t3">{p.profiles?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-nesema-t2">{p.discipline ?? "—"}</td>
                    <td className="px-4 py-3 text-nesema-t2 text-xs">
                      {p.registration_body && p.registration_number
                        ? `${p.registration_body} · ${p.registration_number}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.verification_status} suspended={p.profiles?.suspended} />
                    </td>
                    <td className="px-4 py-3 text-nesema-t2 text-center">{p.patientCount}</td>
                    <td className="px-4 py-3 text-nesema-t3 text-xs">
                      {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(p)}
                        className="flex items-center gap-1 text-xs text-nesema-sage hover:text-nesema-sage-l font-medium"
                      >
                        View <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-over panel */}
      {selected && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="w-full max-w-md bg-nesema-surf border-l border-nesema-bdr overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-nesema-bdr">
              <h2 className="font-serif text-xl text-nesema-t1">
                {[selected.profiles?.first_name, selected.profiles?.last_name].filter(Boolean).join(" ") || "Practitioner"}
              </h2>
              <button onClick={() => setSelected(null)} className="text-nesema-t3 hover:text-nesema-t1">
                <X size={18} />
              </button>
            </div>

            {/* Details */}
            <div className="flex-1 p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Email", value: selected.profiles?.email },
                  { label: "Practice name", value: selected.practice_name },
                  { label: "Discipline", value: selected.discipline },
                  { label: "Reg body", value: selected.registration_body },
                  { label: "Reg number", value: selected.registration_number },
                  { label: "Session length", value: selected.session_length_mins ? `${selected.session_length_mins} mins` : null },
                  { label: "Initial fee", value: selected.initial_fee ? `£${(selected.initial_fee / 100).toFixed(2)}` : null },
                  { label: "Follow-up fee", value: selected.followup_fee ? `£${(selected.followup_fee / 100).toFixed(2)}` : null },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-nesema-t3 font-medium mb-0.5">{label}</p>
                    <p className="text-nesema-t1">{value ?? "—"}</p>
                  </div>
                ))}
              </div>

              {selected.bio && (
                <div>
                  <p className="text-xs text-nesema-t3 font-medium mb-1">Bio</p>
                  <p className="text-nesema-t2 leading-relaxed">{selected.bio}</p>
                </div>
              )}

              {selected.booking_slug && (
                <div>
                  <p className="text-xs text-nesema-t3 font-medium mb-1">Booking URL</p>
                  <a
                    href={`/book/${selected.booking_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-nesema-sage text-xs flex items-center gap-1 hover:underline"
                  >
                    nesema.com/book/{selected.booking_slug}
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}

              <div>
                <p className="text-xs text-nesema-t3 font-medium mb-1">Status</p>
                <StatusBadge status={selected.verification_status} suspended={selected.profiles?.suspended} />
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-nesema-bdr space-y-2">
              {selected.verification_status === "pending" && !selected.profiles?.suspended && (
                <>
                  <button
                    onClick={() => verify(selected)}
                    disabled={loading}
                    className="w-full py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: "#4E7A5F" }}
                  >
                    {loading ? "Processing…" : "Verify & go live"}
                  </button>
                  <button
                    onClick={() => setRejectModal(true)}
                    disabled={loading}
                    className="w-full py-2.5 rounded-full text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}

              {selected.verification_status === "verified" && !selected.profiles?.suspended && (
                <button
                  onClick={() => suspend(selected)}
                  disabled={loading}
                  className="w-full py-2.5 rounded-full text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {loading ? "Processing…" : "Suspend"}
                </button>
              )}

              {selected.profiles?.suspended && (
                <button
                  onClick={() => reinstate(selected)}
                  disabled={loading}
                  className="w-full py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#C27D30" }}
                >
                  {loading ? "Processing…" : "Reinstate"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-nesema-surf rounded-2xl p-6 max-w-sm w-full mx-4 border border-nesema-bdr">
            <h3 className="font-serif text-lg text-nesema-t1 mb-1">Reject practitioner</h3>
            <p className="text-sm text-nesema-t2 mb-4">
              Provide a reason — this will be included in the email to the practitioner.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Registration number could not be verified."
              className="w-full border border-nesema-bdr rounded-xl px-3 py-2 text-sm text-nesema-t1 bg-nesema-bg focus:outline-none focus:ring-2 mb-4 resize-none placeholder:text-nesema-t4"
              style={{ outline: "none" }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectModal(false); setRejectReason(""); }}
                className="flex-1 py-2 border border-nesema-bdr rounded-full text-sm text-nesema-t2 hover:bg-nesema-bg"
              >
                Cancel
              </button>
              <button
                onClick={() => reject(selected)}
                disabled={loading || !rejectReason.trim()}
                className="flex-1 py-2 bg-red-600 text-white rounded-full text-sm disabled:opacity-50 hover:bg-red-700"
              >
                {loading ? "Sending…" : "Reject & email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
