// Assistente de IA dentro do sistema (Claude, pela API da Anthropic).
// Só responde a quem está logado e liberado. A chave fica no secret ANTHROPIC_API_KEY
// (nunca no navegador). Modelo: secret IA_MODELO (padrão claude-sonnet-5-5).
// Limite por pessoa: secret IA_LIMITE_DIA (padrão 60 pedidos por dia).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
function chaveServico(): string {
  try {
    const d = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const v = Object.values(d).find(Boolean);
    if (v) return String(v);
  } catch (_) { /* usa a antiga */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const BASE = `Você é o assistente jurídico do sistema de um escritório de advocacia em Belém/PA que atua em direito previdenciário, criminal e trabalhista. Fala com advogados e com a equipe do escritório.
Responda em português do Brasil, de forma objetiva e organizada (use títulos curtos e listas quando ajudar).
Regras:
- Não invente artigos, súmulas, temas, julgados ou números de processos. Se não tiver certeza de uma referência, diga claramente que precisa ser conferida.
- Não dê prazo processual como definitivo: o prazo oficial é o calculado e conferido no sistema do escritório. Você pode comentar o tipo de prazo e a forma de contagem, sempre pedindo conferência.
- Aponte o que precisa ser conferido nos autos antes de qualquer providência.
- Rascunhos de peças: deixe entre colchetes [assim] tudo o que precisar ser completado ou conferido.
- Mensagens para clientes: linguagem simples, acolhedora, sem prometer resultado.
- O advogado responsável revisa tudo antes de usar.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const chave = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!auth.startsWith("Bearer ")) return json({ erro: "sem_permissao" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, chave, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ok, error } = await sb.rpc("autorizado");
  if (error || ok !== true) return json({ erro: "sem_permissao" }, 403);
  const { data: u } = await sb.auth.getUser(auth.replace(/^Bearer\s+/, ""));
  const email = String(u?.user?.email || "").toLowerCase();

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || "";
  const modelo = Deno.env.get("IA_MODELO") || "claude-sonnet-5-5";
  const limite = Number(Deno.env.get("IA_LIMITE_DIA") || 60);
  let corpo: { status?: boolean; mensagens?: { role: string; content: string }[]; contexto?: string } = {};
  try { corpo = await req.json(); } catch (_) { /* vazio */ }

  const adm = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico(), { auth: { persistSession: false } });
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // dia em Belém
  const { count } = await adm.from("ia_uso").select("id", { count: "exact", head: true }).eq("email", email).gte("quando", hoje + "T03:00:00Z");
  if (corpo.status) return json({ ok: true, chave: !!apiKey, modelo, usadosHoje: count || 0, limite });
  if (!apiKey) return json({ erro: "sem_chave" }, 503);
  if ((count || 0) >= limite) return json({ erro: "limite", limite }, 429);

  const msgs = (corpo.mensagens || []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 20000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ erro: "sem_pergunta" }, 400);
  const contexto = String(corpo.contexto || "").slice(0, 60000);
  const system = contexto ? `${BASE}\n\nDADOS DO SISTEMA DO ESCRITÓRIO (use como base; não invente o que não estiver aqui):\n${contexto}` : BASE;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: modelo, max_tokens: 4096, system, messages: msgs, stream: true }),
  });
  if (!r.ok || !r.body) {
    const t = await r.text();
    console.error(`Anthropic recusou: HTTP ${r.status} ${t.slice(0, 300)}`);
    const motivo = r.status === 401 || r.status === 403 ? "chave_invalida" : /credit|billing|balance/i.test(t) ? "sem_credito"
      : r.status === 429 || r.status === 529 ? "ocupado" : r.status === 404 ? "modelo" : "ia_fora";
    return json({ erro: motivo, status: r.status }, 502);
  }
  // repassa o texto aos poucos e anota o uso no fim
  let tin = 0, tout = 0;
  const dec = new TextDecoder(), enc = new TextEncoder();
  let resto = "";
  const saida = new ReadableStream({
    async start(ctrl) {
      const leitor = r.body!.getReader();
      try {
        while (true) {
          const { value, done } = await leitor.read();
          if (done) break;
          resto += dec.decode(value, { stream: true });
          const linhas = resto.split("\n");
          resto = linhas.pop() || "";
          for (const l of linhas) {
            if (!l.startsWith("data:")) continue;
            try {
              const ev = JSON.parse(l.slice(5).trim());
              if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") ctrl.enqueue(enc.encode(ev.delta.text));
              else if (ev.type === "message_start") tin = ev.message?.usage?.input_tokens || 0;
              else if (ev.type === "message_delta") tout = ev.usage?.output_tokens || tout;
              else if (ev.type === "error") ctrl.enqueue(enc.encode("\n\n[A IA interrompeu a resposta. Tente de novo.]"));
            } catch (_) { /* linha incompleta */ }
          }
        }
      } finally {
        ctrl.close();
        await adm.from("ia_uso").insert({ email, modelo, tokens_entrada: tin, tokens_saida: tout });
      }
    },
  });
  return new Response(saida, { headers: { ...cors, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
});
