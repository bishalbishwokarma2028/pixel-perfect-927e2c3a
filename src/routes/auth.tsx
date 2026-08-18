import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import adoLogoFull from "@/assets/ado-logo-full.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ADO International Transport Nepal" },
      {
        name: "description",
        content: "Sign in to the ADO International Transport Nepal cargo tracking dashboard.",
      },
      { property: "og:title", content: "Sign in — ADO International Transport Nepal" },
      {
        property: "og:description",
        content: "Team access to consignments, warehouse stock and transit tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(
        /banned|disabled/i.test(message)
          ? "This account has been disabled. Please contact your administrator."
          : message,
      );
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={adoLogoFull}
            alt="ADO International"
            className="h-28 w-auto max-w-full object-contain"
          />
          <span className="mt-2 text-sm font-extrabold text-sky-800 tracking-wide">
            ADO International Transport Nepal
          </span>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-white p-6 shadow-xl shadow-sky-900/5">
          <h1 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Package size={18} className="text-sky-500" />
            Team sign in
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Accounts are created by your administrator. Public sign-up is disabled.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-600 disabled:opacity-60"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-slate-400">
            Need access? Ask your administrator to create your staff account.
          </p>
        </div>
      </div>
    </div>
  );
}
