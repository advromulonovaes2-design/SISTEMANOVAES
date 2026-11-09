// Ponte para o DJEN a partir do Brasil.
// O DJEN recusa pedidos de servidores fora do Brasil (o GitHub roda nos EUA).
// O robô chama esta função pedindo a região sa-east-1 (São Paulo) e ela repassa
// a consulta ao DJEN. Só aceita a chave secreta do próprio projeto e só a
// consulta de comunicações, com os filtros usados pelo robô.
const DJEN = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";
const PERMITIDOS = new Set([
  "numeroOab", "ufOab", "nomeParte", "numeroProcesso",
  "dataDisponibilizacaoInicio", "dataDisponibilizacaoFim", "pagina", "itensPorPagina",
]);

function chavesValidas(): string[] {
  const l: string[] = [];
  try {
    const d = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    for (const v of Object.values(d)) if (v) l.push(String(v));
  } catch (_) { /* sem chaves novas */ }
  const legado = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legado) l.push(legado);
  return l;
}

Deno.serve(async (req: Request) => {
  const chave = req.headers.get("apikey") || (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!chave || !chavesValidas().includes(chave)) {
    return new Response(JSON.stringify({ erro: "sem_permissao" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const u = new URL(req.url);
  const q = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (PERMITIDOS.has(k)) q.set(k, v);
  try {
    const r = await fetch(`${DJEN}?${q}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; robo-escritorio/1.0)" },
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json", "x-regiao": Deno.env.get("SB_REGION") || "" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erro: "djen_fora", detalhe: String(e) }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
});
