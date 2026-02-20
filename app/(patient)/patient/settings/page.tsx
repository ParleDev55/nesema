"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User, LogOut, Save } from "lucide-react";

export default function PatientSettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: profile } = (await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", user.id)
        .single()) as {
        data: {
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        } | null;
        error: unknown;
      };

      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setEmail(profile.email ?? user.email ?? "");
      }
      setLoading(false);
    }
    load();
  }, [router, supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ first_name: firstName.trim(), last_name: lastName.trim() })
      .eq("id", user.id);

    if (updateError) {
      setError("Failed to save changes. Please try again.");
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/sign-in");
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-nesema-sage border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-xl mx-auto">
      <h1 className="font-serif text-3xl text-nesema-t1 mb-8">Settings</h1>

      {/* Profile */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
          Profile
        </h2>
        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-white border border-nesema-sage/20 p-6 space-y-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-nesema-sage/15 flex items-center justify-center">
              <User className="text-nesema-bark" size={18} />
            </div>
            <p className="text-sm text-nesema-t2">{email}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-nesema-t3 mb-1.5">
                First name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nesema-sage/40"
              />
            </div>
            <div>
              <label className="block text-xs text-nesema-t3 mb-1.5">
                Last name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nesema-sage/40"
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}
          {saved && (
            <p className="text-green-700 text-xs">Changes saved successfully.</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nesema-bark text-white text-sm rounded-full disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      {/* Account */}
      <section>
        <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
          Account
        </h2>
        <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6">
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
