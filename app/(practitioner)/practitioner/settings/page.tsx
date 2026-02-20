"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Save, LogOut } from "lucide-react";

export default function PractitionerSettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [bio, setBio] = useState("");
  const [pracId, setPracId] = useState("");

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

      const { data: prac } = (await supabase
        .from("practitioners")
        .select("id, practice_name, discipline, bio")
        .eq("profile_id", user.id)
        .single()) as {
        data: {
          id: string;
          practice_name: string | null;
          discipline: string | null;
          bio: string | null;
        } | null;
        error: unknown;
      };

      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setEmail(profile.email ?? user.email ?? "");
      }
      if (prac) {
        setPracId(prac.id);
        setPracticeName(prac.practice_name ?? "");
        setDiscipline(prac.discipline ?? "");
        setBio(prac.bio ?? "");
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

    const profileRes = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      .eq("id", user.id);

    const pracRes = pracId
      ? await supabase
          .from("practitioners")
          .update({
            practice_name: practiceName.trim() || null,
            discipline: discipline.trim() || null,
            bio: bio.trim() || null,
          })
          .eq("id", pracId)
      : null;

    if (profileRes.error || pracRes?.error) {
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal */}
        <section>
          <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
            Personal
          </h2>
          <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6 space-y-4">
            <p className="text-sm text-nesema-t3">{email}</p>
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
          </div>
        </section>

        {/* Practice */}
        <section>
          <h2 className="text-xs font-semibold tracking-widest text-nesema-t3 uppercase mb-4">
            Practice
          </h2>
          <div className="rounded-2xl bg-white border border-nesema-sage/20 p-6 space-y-4">
            <div>
              <label className="block text-xs text-nesema-t3 mb-1.5">
                Practice name
              </label>
              <input
                type="text"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nesema-sage/40"
              />
            </div>
            <div>
              <label className="block text-xs text-nesema-t3 mb-1.5">
                Discipline
              </label>
              <input
                type="text"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                placeholder="e.g. Nutritional Therapy"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nesema-sage/40"
              />
            </div>
            <div>
              <label className="block text-xs text-nesema-t3 mb-1.5">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="A brief description of your practice and approach…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-nesema-sage/40 resize-none"
              />
            </div>
          </div>
        </section>

        {error && <p className="text-red-600 text-xs">{error}</p>}
        {saved && (
          <p className="text-green-700 text-xs">Changes saved successfully.</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-nesema-bark text-white text-sm rounded-full disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      {/* Account */}
      <section className="mt-10">
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
