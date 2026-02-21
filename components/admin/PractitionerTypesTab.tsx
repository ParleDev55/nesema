"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";

interface PractitionerType {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export function PractitionerTypesTab() {
  const [types, setTypes] = useState<PractitionerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PractitionerType | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/practitioner-types");
    const d = await res.json();
    setTypes(d.types ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addType() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const res = await fetch("/api/admin/practitioner-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = await res.json();
    if (!res.ok) {
      showToast(d.error ?? "Failed to add type", false);
    } else {
      setTypes(prev => [d.type, ...prev]);
      setNewName("");
      showToast(`"${d.type.name}" added`);
    }
    setAdding(false);
  }

  async function toggleType(t: PractitionerType) {
    setToggling(t.id);
    const res = await fetch(`/api/admin/practitioner-types/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !t.is_active }),
    });
    const d = await res.json();
    if (!res.ok) {
      showToast(d.error ?? "Failed to update", false);
    } else {
      setTypes(prev => prev.map(x => x.id === t.id ? { ...x, is_active: d.type.is_active } : x));
      showToast(d.type.is_active ? `"${t.name}" enabled` : `"${t.name}" hidden`);
    }
    setToggling(null);
  }

  async function deleteType(t: PractitionerType) {
    setDeleting(t.id);
    setConfirmDelete(null);
    const res = await fetch(`/api/admin/practitioner-types/${t.id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) {
      showToast(d.error ?? "Failed to delete", false);
    } else if (d.deactivated) {
      setTypes(prev => prev.map(x => x.id === t.id ? { ...x, is_active: false } : x));
      showToast(d.message ?? `"${t.name}" hidden (in use)`);
    } else {
      setTypes(prev => prev.filter(x => x.id !== t.id));
      showToast(`"${t.name}" deleted`);
    }
    setDeleting(null);
  }

  return (
    <div className="max-w-2xl">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg transition-all`}
          style={{ backgroundColor: toast.ok ? "#4E7A5F" : "#C23030" }}
        >
          {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h2 className="font-semibold text-nesema-t1 text-lg mb-1">Practitioner types</h2>
        <p className="text-sm text-nesema-t3">
          These disciplines appear in the practitioner sign-up form. Disabled types are hidden from new registrations but preserved for existing accounts.
        </p>
      </div>

      {/* Add new type */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !adding && addType()}
          placeholder="e.g. Integrative Medicine Doctor"
          className="flex-1 rounded-xl border border-nesema-bdr bg-nesema-surf px-4 py-2.5 text-sm text-nesema-t1 placeholder:text-nesema-t4 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F]"
        />
        <button
          onClick={addType}
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: "#4E7A5F" }}
        >
          <Plus size={15} />
          {adding ? "Adding…" : "Add"}
        </button>
      </div>

      {/* Types list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : types.length === 0 ? (
        <div className="text-center py-12 text-nesema-t3 text-sm">No practitioner types yet.</div>
      ) : (
        <div className="space-y-2">
          {types.map(t => (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                t.is_active ? "border-nesema-bdr bg-nesema-surf" : "border-nesema-bdr bg-nesema-bg opacity-60"
              }`}
            >
              <GripVertical size={14} className="text-nesema-t4 flex-shrink-0 cursor-grab" />

              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-nesema-t1">{t.name}</span>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                  t.is_active
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {t.is_active ? "Active" : "Hidden"}
              </span>

              <button
                onClick={() => toggleType(t)}
                disabled={toggling === t.id}
                title={t.is_active ? "Hide from sign-up" : "Show in sign-up"}
                className="p-1.5 rounded-lg hover:bg-nesema-bdr/30 text-nesema-t3 hover:text-nesema-t1 transition-colors disabled:opacity-40"
              >
                {t.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>

              <button
                onClick={() => setConfirmDelete(t)}
                disabled={deleting === t.id}
                title="Delete"
                className="p-1.5 rounded-lg hover:bg-red-50 text-nesema-t3 hover:text-red-600 transition-colors disabled:opacity-40"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-nesema-t1 mb-2">Delete &quot;{confirmDelete.name}&quot;?</h3>
            <p className="text-sm text-nesema-t3 mb-5">
              If any practitioners currently use this discipline, it will be hidden instead of deleted to preserve existing data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-full border border-nesema-bdr text-sm font-medium text-nesema-t2 hover:bg-nesema-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteType(confirmDelete)}
                className="flex-1 py-2.5 rounded-full bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
