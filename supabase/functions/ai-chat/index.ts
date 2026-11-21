// Deploy with: supabase functions deploy ai-chat
// Set provider secrets with: supabase secrets set OPENAI_API_KEY=...
// Never expose provider keys in the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return Response.json({ error: "Authentication required" }, { status: 401, headers: cors });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ error: "Invalid session" }, { status: 401, headers: cors });
    const body = await req.json();
    const provider = String(body.provider ?? "");
    const message = String(body.message ?? "").trim();
    if (!message || message.length > 12000) return Response.json({ error: "Message is required (max 12,000 characters)." }, { status: 400, headers: cors });
    if (provider !== "openai") return Response.json({ error: "This provider is not configured yet." }, { status: 400, headers: cors });
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return Response.json({ error: "OPENAI_API_KEY secret is not configured." }, { status: 503, headers: cors });
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4.1-mini", input: message })
    });
    const result = await upstream.json();
    if (!upstream.ok) return Response.json({ error: result.error?.message ?? "AI provider request failed." }, { status: upstream.status, headers: cors });
    const output = (result.output ?? []).flatMap((item: any) => item.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join("\\n");
    return Response.json({ provider, text: output }, { headers: { ...cors, "Content-Type": "application/json" } });
  } catch {
    return Response.json({ error: "Unexpected server error." }, { status: 500, headers: cors });
  }
});