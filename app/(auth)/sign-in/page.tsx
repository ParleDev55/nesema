"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Profile } from "@/types/database";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Fetch profile to determine role
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const profile = profileData as Pick<Profile, "role"> | null;

    if (profile?.role === "practitioner") {
      router.push("/dashboard");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-nesema-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-serif text-4xl font-semibold text-nesema-bark mb-1">
            Nesema
          </h1>
          <p className="text-nesema-t3 text-sm font-sans">Health, felt whole.</p>
        </div>

        {/* Card */}
        <div className="bg-nesema-surf rounded-2xl border border-nesema-bdr p-8 shadow-sm">
          <h2 className="font-serif text-2xl text-nesema-t1 mb-1">Welcome back</h2>
          <p className="text-nesema-t3 text-sm mb-7">
            Sign in to continue to your Nesema account.
          </p>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs text-nesema-sage hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-nesema-t3 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-nesema-sage font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
