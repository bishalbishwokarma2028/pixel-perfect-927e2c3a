import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { buildAssistantPrompt } from "./ai-prompt";

export const AskAssistantInput = z.object({ message: z.string().min(1).max(4000) });

export async function runAssistant(message: string): Promise<string> {
  const openRouterKey = process.env["OPENROUTER_API_KEY"];
  if (!openRouterKey) {
    throw new Error("OPENROUTER_API_KEY is not configured on this deployment.");
  }

  const request = getRequest();
  const authorization = request?.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Unauthorized");

  // Vercel commonly exposes the public browser variables but not duplicate
  // server-only aliases. These values are publishable and safe for this RLS client.
  const backendUrl = process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"];
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!backendUrl || !publishableKey) {
    throw new Error("The backend connection is not configured on this deployment.");
  }

  const accessToken = authorization.slice("Bearer ".length);
  const database = createClient<Database>(backendUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (
          publishableKey.startsWith("sb_publishable_") &&
          headers.get("Authorization") === `Bearer ${publishableKey}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", publishableKey);
        headers.set("Authorization", `Bearer ${accessToken}`);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data: claims, error: authError } = await database.auth.getClaims(accessToken);
  if (authError || !claims?.claims?.sub) throw new Error("Unauthorized");

  const { data: rows, error } = await database
    .from("consignments")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`Could not load cargo data: ${error.message}`);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": request.url,
      "X-Title": "ADO's Assistant",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [
        {
          role: "user",
          content: buildAssistantPrompt(JSON.stringify(rows ?? []), message),
        },
      ],
      max_tokens: 800,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  if (!response.ok) {
    const providerMessage = payload?.error?.message ?? `HTTP ${response.status}`;
    if (response.status === 429) throw new Error(`OpenRouter rate limit reached: ${providerMessage}`);
    if (response.status === 402) throw new Error(`OpenRouter credits are unavailable: ${providerMessage}`);
    if (response.status === 401 || response.status === 403) {
      throw new Error(`OpenRouter rejected the configured API key: ${providerMessage}`);
    }
    throw new Error(`OpenRouter request failed: ${providerMessage}`);
  }

  const answer = payload?.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("OpenRouter returned an empty answer.");
  return answer;
}