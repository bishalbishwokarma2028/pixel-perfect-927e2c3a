import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { buildAssistantPrompt } from "./ai-prompt";

export const AskAssistantInput = z.object({ message: z.string().min(1).max(4000) });

const OPENROUTER_MODEL = "google/gemini-2.5-flash";

type AiPayload = {
  error?: { message?: string };
  message?: string;
  choices?: Array<{ message?: { content?: string } }>;
} | null;

async function callOpenRouter(apiKey: string, prompt: string) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "ADO Assistant",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });
  const payload = (await response.json().catch(() => null)) as AiPayload;
  return { response, payload };
}

async function callLovable(apiKey: string, prompt: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
    }),
  });
  const payload = (await response.json().catch(() => null)) as AiPayload;
  return { response, payload };
}

export async function runAssistant(message: string): Promise<string> {
  const openRouterKeys = [
    process.env["OPENROUTER_API_KEY"],
    process.env["OPENROUTER_API_KEY_2"],
  ].filter((key): key is string => Boolean(key));
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  if (openRouterKeys.length === 0 && !lovableApiKey) {
    throw new Error("The AI service is not configured on this deployment.");
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

  const prompt = buildAssistantPrompt(JSON.stringify(rows ?? []), message);

  let lastError = "AI request failed.";
  const attempts: Array<() => Promise<{ response: Response; payload: AiPayload }>> = [
    ...openRouterKeys.map((key) => () => callOpenRouter(key, prompt)),
    ...(lovableApiKey ? [() => callLovable(lovableApiKey, prompt)] : []),
  ];

  for (const attempt of attempts) {
    let response: Response;
    let payload: AiPayload;
    try {
      ({ response, payload } = await attempt());
    } catch (networkError) {
      lastError = networkError instanceof Error ? networkError.message : "Network error";
      continue;
    }

    if (!response.ok) {
      lastError =
        payload?.error?.message ?? payload?.message ?? `HTTP ${response.status}`;
      continue;
    }

    const answer = payload?.choices?.[0]?.message?.content?.trim();
    if (answer) return answer;
    lastError = "The assistant returned an empty answer.";
  }

  throw new Error(`AI request failed: ${lastError}`);

  return answer;
}