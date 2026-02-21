"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Eye, EyeOff, Tag, Gift } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  applies_to: "all" | "initial" | "followup";
  max_uses: number | null;
  uses_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface ReferralCode {
  id: string;
  code: string;
  description: string | null;
  referrer_reward_type: "percentage" | "fixed" | "none";
  referrer_reward_value: number;
  referee_reward_type: "percentage" | "fixed" | "none";
  referee_reward_value: number;
  max_uses: number | null;
  uses_count: number;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

// ── Shared helpers ────────────────────────────────────────────

const iCls = "w-full rounded-xl border border-nesema-bdr bg-nesema-surf px-4 py-2.5 text-sm text-nesema-t1 placeholder:text-nesema-t4 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F] transition-colors";
const sCls = "w-full rounded-xl border border-nesema-bdr bg-nesema-surf px-4 py-2.5 text-sm text-nesema-t1 focus:outline-none focus:ring-2 focus:ring-[#4E7A5F] transition-colors";
const lCls = "block text-xs font-medium text-nesema-t2 mb-1";

function StatusBadge({ active, usesCount, maxUses }: { active: boolean; usesCount: number; maxUses: number | null }) {
  if (!active) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">Inactive</span>;
  if (maxUses !== null && usesCount >= maxUses) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Exhausted</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Active</span>;
}

function UsageBar({ uses, max }: { uses: number; max: number | null }) {
  if (max === null) return <span className="text-xs text-nesema-t3">{uses} uses · unlimited</span>;
  const pct = Math.min(100, (uses / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-nesema-bdr overflow-hidden">
        <div className="h-full rounded-full bg-[#4E7A5F]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-nesema-t3">{uses}/{max}</span>
    </div>
  );
}

// ── Discount Codes section ────────────────────────────────────

function DiscountSection() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DiscountCode | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [appliesTo, setAppliesTo] = useState<"all" | "initial" | "followup">("all");
  const [maxUses, setMaxUses] = useState("");
  const [validUntil, setValidUntil] = useState("");

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function resetForm() {
    setCode(""); setDescription(""); setDiscountType("percentage"); setDiscountValue("");
    setAppliesTo("all"); setMaxUses(""); setValidUntil("");
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/discount-codes");
    const d = await res.json();
    setCodes(d.codes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setSaving(true);
    const res = await fetch("/api/admin/discount-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        applies_to: appliesTo,
        max_uses: maxUses ? parseInt(maxUses) : null,
        valid_until: validUntil || null,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      showToast(d.error ?? "Failed to create", false);
    } else {
      setCodes(prev => [d.code, ...prev]);
      setOpen(false);
      resetForm();
      showToast(`Discount code "${d.code.code}" created`);
    }
    setSaving(false);
  }

  async function toggleCode(c: DiscountCode) {
    setToggling(c.id);
    const res = await fetch(`/api/admin/discount-codes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !c.is_active }),
    });
    const d = await res.json();
    if (res.ok) setCodes(prev => prev.map(x => x.id === c.id ? { ...x, is_active: d.code.is_active } : x));
    else showToast(d.error ?? "Failed", false);
    setToggling(null);
  }

  async function deleteCode(c: DiscountCode) {
    setDeleting(c.id);
    setConfirmDelete(null);
    const res = await fetch(`/api/admin/discount-codes/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setCodes(prev => prev.filter(x => x.id !== c.id));
      showToast(`"${c.code}" deleted`);
    } else {
      const d = await res.json();
      showToast(d.error ?? "Failed to delete", false);
    }
    setDeleting(null);
  }

  return (
    <section>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg" style={{ backgroundColor: toast.ok ? "#4E7A5F" : "#C23030" }}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-nesema-t1 flex items-center gap-2"><Tag size={16} />Discount codes</h3>
          <p className="text-xs text-nesema-t3 mt-0.5">Applied at checkout to reduce the session fee.</p>
        </div>
        <button
          onClick={() => { resetForm(); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white"
          style={{ backgroundColor: "#C27D30" }}
        >
          <Plus size={13} /> New code
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin" /></div>
      ) : codes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-nesema-bdr py-8 text-center text-sm text-nesema-t3">No discount codes yet.</div>
      ) : (
        <div className="rounded-xl border border-nesema-bdr overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nesema-bg border-b border-nesema-bdr">
              <tr>
                {["Code", "Discount", "Applies to", "Uses", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-nesema-t3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nesema-bdr">
              {codes.map(c => (
                <tr key={c.id} className="bg-nesema-surf hover:bg-nesema-bg/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-nesema-t1">{c.code}</span>
                    {c.description && <p className="text-xs text-nesema-t3 mt-0.5">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-nesema-t1">
                    {c.discount_type === "percentage" ? `${c.discount_value}%` : `£${c.discount_value}`}
                  </td>
                  <td className="px-4 py-3 text-nesema-t2 capitalize">{c.applies_to}</td>
                  <td className="px-4 py-3"><UsageBar uses={c.uses_count} max={c.max_uses} /></td>
                  <td className="px-4 py-3"><StatusBadge active={c.is_active} usesCount={c.uses_count} maxUses={c.max_uses} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => toggleCode(c)} disabled={toggling === c.id} className="p-1.5 rounded-lg hover:bg-nesema-bdr/40 text-nesema-t3 hover:text-nesema-t1 disabled:opacity-40">
                        {c.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button onClick={() => setConfirmDelete(c)} disabled={deleting === c.id} className="p-1.5 rounded-lg hover:bg-red-50 text-nesema-t3 hover:text-red-600 disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-nesema-t1 mb-4">New discount code</h3>
            <div className="space-y-4">
              <div>
                <label className={lCls}>Code *</label>
                <input className={iCls} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME20" />
              </div>
              <div>
                <label className={lCls}>Description</label>
                <input className={iCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional note" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lCls}>Discount type *</label>
                  <select className={sCls} value={discountType} onChange={e => setDiscountType(e.target.value as "percentage" | "fixed")}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (£)</option>
                  </select>
                </div>
                <div>
                  <label className={lCls}>Value *</label>
                  <input type="number" min="0.01" max={discountType === "percentage" ? 100 : undefined} step="0.01" className={iCls} value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 15"} />
                </div>
              </div>
              <div>
                <label className={lCls}>Applies to</label>
                <select className={sCls} value={appliesTo} onChange={e => setAppliesTo(e.target.value as "all" | "initial" | "followup")}>
                  <option value="all">All sessions</option>
                  <option value="initial">Initial consultation only</option>
                  <option value="followup">Follow-up sessions only</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lCls}>Max uses</label>
                  <input type="number" min="1" className={iCls} value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" />
                </div>
                <div>
                  <label className={lCls}>Valid until</label>
                  <input type="date" className={iCls} value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-full border border-nesema-bdr text-sm font-medium text-nesema-t2">Cancel</button>
              <button onClick={create} disabled={saving || !code.trim() || !discountValue} className="flex-1 py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#C27D30" }}>
                {saving ? "Creating…" : "Create code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-nesema-t1 mb-2">Delete &quot;{confirmDelete.code}&quot;?</h3>
            <p className="text-sm text-nesema-t3 mb-5">This cannot be undone. Existing bookings will not be affected.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-full border border-nesema-bdr text-sm font-medium text-nesema-t2">Cancel</button>
              <button onClick={() => deleteCode(confirmDelete)} className="flex-1 py-2.5 rounded-full bg-red-600 text-sm font-medium text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Referral Codes section ────────────────────────────────────

function rewardLabel(type: string, value: number): string {
  if (type === "none" || value === 0) return "None";
  if (type === "percentage") return `${value}% off`;
  return `£${value} off`;
}

function ReferralSection() {
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReferralCode | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // form state
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [referrerType, setReferrerType] = useState<"none" | "percentage" | "fixed">("none");
  const [referrerValue, setReferrerValue] = useState("");
  const [refereeType, setRefereeType] = useState<"none" | "percentage" | "fixed">("percentage");
  const [refereeValue, setRefereeValue] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [validUntil, setValidUntil] = useState("");

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function resetForm() {
    setCode(""); setDescription(""); setReferrerType("none"); setReferrerValue("");
    setRefereeType("percentage"); setRefereeValue(""); setMaxUses(""); setValidUntil("");
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/referral-codes");
    const d = await res.json();
    setCodes(d.codes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setSaving(true);
    const res = await fetch("/api/admin/referral-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        referrer_reward_type: referrerType,
        referrer_reward_value: referrerType !== "none" && referrerValue ? parseFloat(referrerValue) : 0,
        referee_reward_type: refereeType,
        referee_reward_value: refereeType !== "none" && refereeValue ? parseFloat(refereeValue) : 0,
        max_uses: maxUses ? parseInt(maxUses) : null,
        valid_until: validUntil || null,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      showToast(d.error ?? "Failed to create", false);
    } else {
      setCodes(prev => [d.code, ...prev]);
      setOpen(false);
      resetForm();
      showToast(`Referral code "${d.code.code}" created`);
    }
    setSaving(false);
  }

  async function toggleCode(c: ReferralCode) {
    setToggling(c.id);
    const res = await fetch(`/api/admin/referral-codes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !c.is_active }),
    });
    const d = await res.json();
    if (res.ok) setCodes(prev => prev.map(x => x.id === c.id ? { ...x, is_active: d.code.is_active } : x));
    else showToast(d.error ?? "Failed", false);
    setToggling(null);
  }

  async function deleteCode(c: ReferralCode) {
    setDeleting(c.id);
    setConfirmDelete(null);
    const res = await fetch(`/api/admin/referral-codes/${c.id}`, { method: "DELETE" });
    if (res.ok) {
      setCodes(prev => prev.filter(x => x.id !== c.id));
      showToast(`"${c.code}" deleted`);
    } else {
      const d = await res.json();
      showToast(d.error ?? "Failed to delete", false);
    }
    setDeleting(null);
  }

  return (
    <section>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg" style={{ backgroundColor: toast.ok ? "#4E7A5F" : "#C23030" }}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-nesema-t1 flex items-center gap-2"><Gift size={16} />Referral codes</h3>
          <p className="text-xs text-nesema-t3 mt-0.5">Reward patients who refer friends. Set rewards for both the referrer and referee.</p>
        </div>
        <button
          onClick={() => { resetForm(); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white"
          style={{ backgroundColor: "#4E7A5F" }}
        >
          <Plus size={13} /> New code
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-[#4E7A5F] border-t-transparent rounded-full animate-spin" /></div>
      ) : codes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-nesema-bdr py-8 text-center text-sm text-nesema-t3">No referral codes yet.</div>
      ) : (
        <div className="rounded-xl border border-nesema-bdr overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-nesema-bg border-b border-nesema-bdr">
              <tr>
                {["Code", "Referrer gets", "Referee gets", "Uses", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-nesema-t3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-nesema-bdr">
              {codes.map(c => (
                <tr key={c.id} className="bg-nesema-surf hover:bg-nesema-bg/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-nesema-t1">{c.code}</span>
                    {c.description && <p className="text-xs text-nesema-t3 mt-0.5">{c.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-nesema-t2">{rewardLabel(c.referrer_reward_type, c.referrer_reward_value)}</td>
                  <td className="px-4 py-3 text-nesema-t2">{rewardLabel(c.referee_reward_type, c.referee_reward_value)}</td>
                  <td className="px-4 py-3"><UsageBar uses={c.uses_count} max={c.max_uses} /></td>
                  <td className="px-4 py-3"><StatusBadge active={c.is_active} usesCount={c.uses_count} maxUses={c.max_uses} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => toggleCode(c)} disabled={toggling === c.id} className="p-1.5 rounded-lg hover:bg-nesema-bdr/40 text-nesema-t3 hover:text-nesema-t1 disabled:opacity-40">
                        {c.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button onClick={() => setConfirmDelete(c)} disabled={deleting === c.id} className="p-1.5 rounded-lg hover:bg-red-50 text-nesema-t3 hover:text-red-600 disabled:opacity-40">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-nesema-t1 mb-4">New referral code</h3>
            <div className="space-y-4">
              <div>
                <label className={lCls}>Code *</label>
                <input className={iCls} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="e.g. FRIEND2024" />
              </div>
              <div>
                <label className={lCls}>Description</label>
                <input className={iCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Winter referral campaign" />
              </div>

              <div className="rounded-xl border border-nesema-bdr p-4 space-y-3">
                <p className="text-xs font-semibold text-nesema-t2 uppercase tracking-wide">Referrer reward (person sharing the code)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Type</label>
                    <select className={sCls} value={referrerType} onChange={e => setReferrerType(e.target.value as "none" | "percentage" | "fixed")}>
                      <option value="none">No reward</option>
                      <option value="percentage">Percentage off</option>
                      <option value="fixed">Fixed amount off</option>
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Value</label>
                    <input type="number" min="0" step="0.01" className={iCls} value={referrerValue} onChange={e => setReferrerValue(e.target.value)} placeholder={referrerType === "percentage" ? "%" : "£"} disabled={referrerType === "none"} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-nesema-bdr p-4 space-y-3">
                <p className="text-xs font-semibold text-nesema-t2 uppercase tracking-wide">Referee reward (new patient using code)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lCls}>Type</label>
                    <select className={sCls} value={refereeType} onChange={e => setRefereeType(e.target.value as "none" | "percentage" | "fixed")}>
                      <option value="none">No reward</option>
                      <option value="percentage">Percentage off</option>
                      <option value="fixed">Fixed amount off</option>
                    </select>
                  </div>
                  <div>
                    <label className={lCls}>Value</label>
                    <input type="number" min="0" step="0.01" className={iCls} value={refereeValue} onChange={e => setRefereeValue(e.target.value)} placeholder={refereeType === "percentage" ? "%" : "£"} disabled={refereeType === "none"} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lCls}>Max uses</label>
                  <input type="number" min="1" className={iCls} value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="Unlimited" />
                </div>
                <div>
                  <label className={lCls}>Valid until</label>
                  <input type="date" className={iCls} value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-full border border-nesema-bdr text-sm font-medium text-nesema-t2">Cancel</button>
              <button onClick={create} disabled={saving || !code.trim()} className="flex-1 py-2.5 rounded-full text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#4E7A5F" }}>
                {saving ? "Creating…" : "Create code"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-semibold text-nesema-t1 mb-2">Delete &quot;{confirmDelete.code}&quot;?</h3>
            <p className="text-sm text-nesema-t3 mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-full border border-nesema-bdr text-sm font-medium text-nesema-t2">Cancel</button>
              <button onClick={() => deleteCode(confirmDelete)} className="flex-1 py-2.5 rounded-full bg-red-600 text-sm font-medium text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────

export function PromoCodesTab() {
  return (
    <div className="max-w-3xl space-y-10">
      <div className="mb-2">
        <h2 className="font-semibold text-nesema-t1 text-lg mb-1">Promo codes</h2>
        <p className="text-sm text-nesema-t3">Manage discount and referral codes for patients.</p>
      </div>
      <DiscountSection />
      <div className="border-t border-nesema-bdr" />
      <ReferralSection />
    </div>
  );
}
