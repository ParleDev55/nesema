"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Role = "practitioner" | "patient";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("patient");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    window.location.href =
      role === "practitioner"
        ? "/onboarding/practitioner"
        : "/onboarding/patient";
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
          <h2 className="font-serif text-2xl text-nesema-t1 mb-1">
            Create your account
          </h2>
          <p className="text-nesema-t3 text-sm mb-7">
            Join Nesema and start your health journey.
          </p>

          {/* Role toggle */}
          <div className="mb-6">
            <Label className="mb-2 block">I am a…</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["patient", "practitioner"] as Role[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-xl border-2 py-3 text-sm font-medium capitalize transition-all",
                    role === r
                      ? "border-nesema-sage bg-nesema-sage-p text-nesema-sage"
                      : "border-nesema-bdr bg-white text-nesema-t2 hover:border-nesema-sage-m"
                  )}
                >
                  {r === "practitioner" ? "Practitioner" : "Patient"}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-nesema-t3 mt-6">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-nesema-sage font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
