"use client";

import { useState } from "react";
import { X, ChevronRight } from "lucide-react";

interface PatientRow {
  id: string;
  profile_id: string;
  practitioner_id: string | null;
  current_health: string | null;
  goals: string[] | null;
  programme_weeks: number | null;
  created_at: string;
  last_checkin: string | null;
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    suspended: boolean;
  } | null;
}

type FilterTab = "all" | "active" | "unassigned" | "suspended";

export function PatientsClient({
  patients,
  practitionerOptions,
  pracNameMap,
}: {
  patients: PatientRow[];
  practitionerOptions: { id: string; name: string }[];
  pracNameMap: Record<string, string>;
}) {
  const [tab, setTab] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<PatientRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rows, setRows] = useState(patients);
  const [search, setSearch] = useState("");
  const [reassignId, setReassignId] = useState<string>("");
  const [reassignMode, setReassignMode] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const filtered = rows.filter((p) => {
    const name = [p.profiles?.first_name, p.profiles?.last_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const email = p.profiles?.email?.toLowerCase() ?? "";
    const q = search.toLowerCase();
    if (q && !name.includes(q) && !email.includes(q)) return false;
    if (tab === "active") return !p.profiles?.suspended && !!p.practitioner_id;
    if (tab === "unassigned") return !p.practitioner_id && !p.profiles?.suspended;
    if (tab === "suspended") return p.profiles?.suspended;
    return true;
  });

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

  function updateRow(id: string, patch: Partial<PatientRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function reassign(p: PatientRow) {
    if (!reassignId) return;
    const ok = await callAction(`/api/admin/patients/${p.id}/reassign`, {
      practitionerId: reassignId,
    });
    if (ok) {
      updateRow(p.id, { practitioner_id: reassignId });
      showToast("Patient reassigned.");
      setReassignMode(false);
      setReassignId("");
      setSelected((prev) => (prev ? { ...prev, practitioner_id: reassignId } : prev));
    }
  }

  async function suspend(p: PatientRow) {
    const ok = await callAction(`/api/admin/patients/${p.id}/suspend`);
    if (ok) {
      updateRow(p.id, {
        profiles: p.profiles ? { ...p.profiles, suspended: true } : p.profiles,
      });
      showToast("Patient suspended.");
      setSelected(null);
    }
  }

  async function deletePatient(p: PatientRow) {
    const ok = await callAction(`/api/admin/patients/${p.id}/delete`);
    if (ok) {
      setRows((prev) => prev.filter((r) => r.id !== p.id));
      showToast("Patient account deleted.");
      setDeleteModal(false);
      setSelected(null);
    }
  }

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "unassigned", label: "No practitioner" },
    { id: "suspended", label: "Suspended" },
  ];

  function daysSince(dateStr: string | null) {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / 86400000);
  }

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

      <h1 className="font-serif text-3xl text-nesema-t1 mb-6">Patients</h1>

      {/* Search + tabs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-nesema-bdr rounded-xl px-3 py-2 text-sm bg-nesema-bg text-nesema-t1 placeholder:text-nesema-t4 focus:outline-none focus:ring-2 w-full sm:w-64"
        />
        <div className="flex gap-1 bg-nesema-bg rounded-2xl p-1 border border-nesema-bdr w-fit">
          {tabs.map((t) => {
            const count =
              t.id === "all"
                ? rows.length
                : t.id === "active"
                ? rows.filter((r) => !r.profiles?.suspended && !!r.practitioner_id).length
                : t.id === "unassigned"
                ? rows.filter((r) => !r.practitioner_id && !r.profiles?.suspended).length
                : rows.filter((r) => r.profiles?.suspended).length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  tab === t.id ? "text-white shadow-sm" : "text-nesema-t3 hover:text-nesema-t2"
                }`}
                style={tab === t.id ? { backgroundColor: "#C27D30" } : {}}
              >
                {t.label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                      tab === t.id ? "bg-white/30" : "bg-nesema-bdr"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-nesema-t3 text-sm">No patients match this filter.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-nesema-bdr">
              <tr>
                {["Name", "Practitioner", "Week", "Last check-in", "Joined", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-nesema-t3 uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-nesema-bdr">
              {filtered.map((p) => {
                const name =
                  [p.profiles?.first_name, p.profiles?.last_name]
                    .filter(Boolean)
                    .join(" ") || "—";
                const days = daysSince(p.last_checkin);
                return (
                  <tr key={p.id} className="hover:bg-nesema-bg/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-nesema-t1">{name}</div>
                      <div className="text-xs text-nesema-t3">{p.profiles?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-nesema-t2 text-sm">
                      {p.practitioner_id ? pracNameMap[p.practitioner_id] ?? "—" : (
                        <span className="text-nesema-t4 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-nesema-t2 text-center">
                      {p.programme_weeks ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-nesema-t3">
                      {days === null ? (
                        <span className="text-nesema-t4 italic">Never</span>
                      ) : days === 0 ? (
                        <span className="text-green-600 font-medium">Today</span>
                      ) : (
                        <span className={days >= 3 ? "text-amber-600 font-medium" : ""}>
                          {days}d ago
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-nesema-t3 text-xs">
                      {new Date(p.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {p.profiles?.suspended ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Suspended
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelected(p);
                          setReassignMode(false);
                          setReassignId(p.practitioner_id ?? "");
                        }}
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

      {/* Slide-over */}
      {selected && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="w-full max-w-md bg-nesema-surf border-l border-nesema-bdr overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-nesema-bdr">
              <h2 className="font-serif text-xl text-nesema-t1">
                {[selected.profiles?.first_name, selected.profiles?.last_name]
                  .filter(Boolean)
                  .join(" ") || "Patient"}
              </h2>
              <button onClick={() => setSelected(null)} className="text-nesema-t3 hover:text-nesema-t1">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Email", value: selected.profiles?.email },
                  {
                    label: "Practitioner",
                    value: selected.practitioner_id
                      ? pracNameMap[selected.practitioner_id]
                      : "Unassigned",
                  },
                  { label: "Programme week", value: selected.programme_weeks?.toString() },
                  {
                    label: "Last check-in",
                    value: selected.last_checkin
                      ? `${daysSince(selected.last_checkin)}d ago`
                      : "Never",
                  },
                  {
                    label: "Joined",
                    value: new Date(selected.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }),
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-nesema-t3 font-medium mb-0.5">{label}</p>
                    <p className="text-nesema-t1">{value ?? "—"}</p>
                  </div>
                ))}
              </div>

              {selected.current_health && (
                <div>
                  <p className="text-xs text-nesema-t3 font-medium mb-1">Health background</p>
                  <p className="text-nesema-t2 leading-relaxed text-xs">{selected.current_health}</p>
                </div>
              )}

              {selected.goals && (
                <div>
                  <p className="text-xs text-nesema-t3 font-medium mb-1">Goals</p>
                  <p className="text-nesema-t2 leading-relaxed text-xs">{selected.goals}</p>
                </div>
              )}

              {/* Reassign */}
              {reassignMode && (
                <div className="border border-nesema-bdr rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-nesema-t2">Reassign to practitioner</p>
                  <select
                    value={reassignId}
                    onChange={(e) => setReassignId(e.target.value)}
                    className="w-full border border-nesema-bdr rounded-lg px-2 py-1.5 text-sm bg-nesema-bg text-nesema-t1 focus:outline-none"
                  >
                    <option value="">Select practitioner…</option>
                    {practitionerOptions.map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setReassignMode(false); setReassignId(selected.practitioner_id ?? ""); }}
                      className="flex-1 py-1.5 border border-nesema-bdr rounded-full text-xs text-nesema-t2 hover:bg-nesema-bg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => reassign(selected)}
                      disabled={loading || !reassignId}
                      className="flex-1 py-1.5 rounded-full text-xs text-white disabled:opacity-50"
                      style={{ backgroundColor: "#4E7A5F" }}
                    >
                      {loading ? "Saving…" : "Confirm"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-nesema-bdr space-y-2">
              {!reassignMode && !selected.profiles?.suspended && (
                <button
                  onClick={() => { setReassignMode(true); setReassignId(selected.practitioner_id ?? ""); }}
                  className="w-full py-2.5 rounded-full text-sm font-medium border border-nesema-bdr text-nesema-t1 hover:bg-nesema-bg"
                >
                  Reassign practitioner
                </button>
              )}

              {!selected.profiles?.suspended && (
                <button
                  onClick={() => suspend(selected)}
                  disabled={loading}
                  className="w-full py-2.5 rounded-full text-sm font-medium border border-amber-300 text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                >
                  {loading ? "Processing…" : "Suspend account"}
                </button>
              )}

              <button
                onClick={() => setDeleteModal(true)}
                disabled={loading}
                className="w-full py-2.5 rounded-full text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-nesema-surf rounded-2xl p-6 max-w-sm w-full mx-4 border border-nesema-bdr">
            <h3 className="font-serif text-lg text-nesema-t1 mb-1">Delete patient account?</h3>
            <p className="text-sm text-nesema-t2 mb-5">
              This will permanently delete{" "}
              <strong>
                {[selected.profiles?.first_name, selected.profiles?.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </strong>
              &apos;s account and all associated data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal(false)}
                className="flex-1 py-2 border border-nesema-bdr rounded-full text-sm text-nesema-t2 hover:bg-nesema-bg"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePatient(selected)}
                disabled={loading}
                className="flex-1 py-2 bg-red-600 text-white rounded-full text-sm disabled:opacity-50 hover:bg-red-700"
              >
                {loading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
