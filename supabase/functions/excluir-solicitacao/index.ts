// Botão "Excluir solicitação" da aba Acessos.
// Um gestor apaga a conta de quem fez o "Primeiro acesso" mas não foi liberado.
// Só apaga contas que NÃO estão liberadas na tabela acesso (para tirar o acesso
// de quem já está liberado, use "Tirar acesso" primeiro).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

function chaveServico(): string {
  try {
    const d = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    for (const v of Object.values(d)) if (v) return String(v);
  } catch (_) { /* sem chaves novas */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") || "";
  const chave = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!auth.startsWith("Bearer ")) return json({ erro: "sem_permissao" }, 401);

  // 1) quem pediu é gestor?
  const eu = createClient(url, chave, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: gestor, error: e1 } = await eu.rpc("eh_gestor");
  if (e1 || gestor !== true) return json({ erro: "sem_permissao" }, 403);
  const { data: quem } = await eu.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  const meuEmail = (quem?.user?.email || "").toLowerCase();

  let pedido: { email?: string } = {};
  try { pedido = await req.json(); } catch (_) { /* vazio */ }
  const email = String(pedido.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: "email_invalido" }, 400);
  if (email === meuEmail) return json({ erro: "proprio" }, 400);

  const svc = chaveServico();
  if (!svc) return json({ erro: "sem_chave_servico" }, 500);
  const adm = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });

  // 2) não apaga quem está liberado
  const { data: lib, error: e2 } = await adm.from("acesso").select("email").ilike("email", email).limit(1);
  if (e2) return json({ erro: "banco", detalhe: e2.message }, 500);
  if (lib && lib.length) return json({ erro: "liberado" }, 409);

  // 3) acha a conta e apaga
  let alvo: { id: string } | null = null;
  for (let pagina = 1; pagina <= 20 && !alvo; pagina++) {
    const { data, error } = await adm.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error) return json({ erro: "auth", detalhe: error.message }, 500);
    alvo = data.users.find((u) => (u.email || "").toLowerCase() === email) || null;
    if (data.users.length < 200) break;
  }
  if (!alvo) return json({ erro: "nao_encontrado" }, 404);
  const { error: e3 } = await adm.auth.admin.deleteUser(alvo.id);
  if (e3) return json({ erro: "auth", detalhe: e3.message }, 500);
  console.log(`Solicitação de ${email} excluída por ${meuEmail}`);
  return json({ ok: true });
});
