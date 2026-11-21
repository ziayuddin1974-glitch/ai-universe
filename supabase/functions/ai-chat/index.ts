import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type OpenAIResponse = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ??
    "https://ziayuddin1974-glitch.github.io,https://localhost,http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function corsHeaders(origin: string | null): Record<string, string> | null {
  if (origin && !allowedOrigins.has(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  headers: Record<string, string>,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, { status, headers });
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("Origin"));
  if (!headers) return new Response("Origin not allowed", { status: 403 });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") {
    return jsonResponse(headers, { error: "Method not allowed." }, 405);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(headers, { error: "Sign in to use AI chat." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(headers, { error: "Chat backend is not configured." }, 503);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return jsonResponse(headers, { error: "Your session expired. Sign in again." }, 401);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return jsonResponse(headers, { error: "Chat backend is not configured." }, 503);
  }

  let body: {
    provider?: unknown;
    message?: unknown;
    history?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(headers, { error: "Request body must be valid JSON." }, 400);
  }

  if (body.provider !== "openai") {
    return jsonResponse(headers, { error: "This AI provider is not configured." }, 400);
  }
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 12000) {
    return jsonResponse(headers, { error: "Enter a message up to 12,000 characters." }, 400);
  }

  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history.slice(-20).flatMap((item): ChatMessage[] => {
      if (!item || typeof item !== "object") return [];
      const message = item as Record<string, unknown>;
      if (
        (message.role !== "user" && message.role !== "assistant") ||
        typeof message.content !== "string" ||
        !message.content.trim() ||
        message.content.length > 12000
      ) return [];
      return [{ role: message.role, content: message.content }];
    })
    : [];

  const { data: withinLimit, error: limitError } = await supabase.rpc(
    "consume_ai_chat_quota",
  );
  if (limitError) {
    console.error("AI chat rate-limit check failed.");
    return jsonResponse(headers, { error: "Chat service is temporarily unavailable." }, 503);
  }
  if (!withinLimit) {
    return jsonResponse(headers, { error: "Chat limit reached. Try again in a minute." }, 429);
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [...history, { role: "user", content: body.message.trim() }],
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    console.error("AI provider request could not be completed.");
    return jsonResponse(headers, { error: "AI provider is temporarily unavailable." }, 502);
  }

  let result: OpenAIResponse;
  try {
    result = await upstream.json() as OpenAIResponse;
  } catch {
    return jsonResponse(headers, { error: "AI provider returned an invalid response." }, 502);
  }

  if (!upstream.ok) {
    const status = upstream.status === 429 ? 429 : 502;
    const error = status === 429
      ? "AI provider rate limit reached. Please try again shortly."
      : "AI provider could not complete the request.";
    return jsonResponse(headers, { error }, status);
  }

  const text = (result.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n")
    .trim();

  if (!text) {
    return jsonResponse(headers, { error: "AI provider returned an empty response." }, 502);
  }

  return jsonResponse(headers, { provider: "openai", text });
});
