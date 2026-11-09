// Botão "Buscar agora" da aba Intimações.
// Confere se quem apertou está liberado no sistema e pede ao GitHub para rodar
// o robô na hora, só buscando intimações (sem mandar avisos).
// Precisa do secret GITHUB_TOKEN (token do GitHub com permissão de Actions neste repositório).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const REPO = "advromulonovaes2-design/SISTEMANOVAES";
const WORKFLOW = "robo.yml";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  // 1) quem apertou está liberado?
  const auth = req.headers.get("Authorization") || "";
  const chave = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!auth.startsWith("Bearer ")) return json({ erro: "sem_permissao" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, chave, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: ok, error } = await sb.rpc("autorizado");
  if (error || ok !== true) return json({ erro: "sem_permissao" }, 403);

  // 2) pede ao GitHub para rodar o robô
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return json({ erro: "sem_token" }, 500);
  const gh = (caminho: string, init: RequestInit = {}) =>
    fetch(`https://api.github.com/repos/${REPO}${caminho}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "palha-novaes-sistema",
        ...(init.headers || {}),
      },
    });

  const runs = await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=5`);
  if (runs.status === 401 || runs.status === 403 || runs.status === 404) {
    return json({ erro: "token_invalido", status: runs.status }, 500);
  }
  if (runs.ok) {
    const d = await runs.json();
    const ativo = (d.workflow_runs || []).find((r: { status: string }) =>
      ["queued", "in_progress", "waiting", "requested", "pending"].includes(r.status)
    );
    if (ativo) return json({ ok: true, jaRodando: true, desde: ativo.created_at });
  }
  const r = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main", inputs: { busca: true } }),
  });
  if (r.status === 204) return json({ ok: true });
  return json({ erro: "github", status: r.status, detalhe: (await r.text()).slice(0, 300) }, 502);
});
