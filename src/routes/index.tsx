import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import AppShell from "@/components/AppShell";
import { AuthzProvider } from "@/hooks/useAuthz";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ADO International Transport Nepal — Cargo Dashboard" },
      {
        name: "description",
        content:
          "Track China-to-Nepal cargo: warehouse stock, consignments, transit checkpoints, lots, clients and freight analytics.",
      },
      { property: "og:title", content: "ADO International Transport Nepal — Cargo Dashboard" },
      {
        property: "og:description",
        content:
          "Live logistics dashboard for Guangzhou and Yiwu warehouses, Tibetan transit checkpoints and Nepal deliveries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setChecked(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (checked && !session) navigate({ to: "/auth" });
  }, [checked, session, navigate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }, [navigate]);

  if (!checked || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <AuthzProvider session={session} onRevoked={signOut}>
      <AppShell userEmail={session.user.email ?? ""} onSignOut={signOut} />
    </AuthzProvider>
  );
}

