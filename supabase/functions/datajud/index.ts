// Completa o cadastro do processo com os dados públicos do CNJ (DataJud):
// classe, assuntos, órgão julgador, data de ajuizamento e movimentações.
// Só responde a quem está logado e liberado no sistema.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// chave pública divulgada pelo CNJ (datajud-wiki.cnj.jus.br); se mudar, crie o secret DATAJUD_KEY
const CHAVE = Deno.env.get("DATAJUD_KEY") || "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const UF: Record<string, string> = { "01": "ac", "02": "al", "03": "ap", "04": "am", "05": "ba", "06": "ce", "07": "df", "08": "es", "09": "go",
  "10": "ma", "11": "mt", "12": "ms", "13": "mg", "14": "pa", "15": "pb", "16": "pr", "17": "pe", "18": "pi", "19": "rj", "20": "rn",
  "21": "rs", "22": "ro", "23": "rr", "24": "sc", "25": "se", "26": "sp", "27": "to" };
function alias(n: string): string | null {
  if (n.length !== 20) return null;
  const j = n[13], tr = n.slice(14, 16);
  if (j === "4") return tr !== "00" ? `trf${+tr}` : null;
  if (j === "8") return tr === "07" ? "tjdft" : UF[tr] ? `tj${UF[tr]}` : null;
  if (j === "5") return tr === "00" ? "tst" : `trt${+tr}`;
  if (j === "6") return tr === "00" ? "tse" : UF[tr] ? `tre-${UF[tr]}` : null;
  if (j === "9") return ({ "13": "tjmmg", "21": "tjmrs", "26": "tjmsp" } as Record<string, string>)[tr] || null;
  if (j === "3") return "stj";
  if (j === "7") return "stm";
  return null;
}
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization") || "";
  const chave = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!auth.startsWith("Bearer ")) return json({ erro: "sem_permissao" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, chave, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: ok, error } = await sb.rpc("autorizado");
  if (error || ok !== true) return json({ erro: "sem_permissao" }, 403);

  let numero = "";
  try { numero = String((await req.json()).numero || ""); } catch (_) { /* vazio */ }
  const n = numero.replace(/\D/g, "");
  const a = alias(n);
  if (!a) return json({ erro: "numero_invalido" }, 400);
  const r = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${a}/_search`, {
    method: "POST",
    headers: { Authorization: "APIKey " + CHAVE, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { match: { numeroProcesso: n } }, size: 10 }),
  });
  if (r.status === 401 || r.status === 403) return json({ erro: "chave_cnj" }, 502);
  if (!r.ok) return json({ erro: "cnj_fora", status: r.status }, 502);
  const d = await r.json();
  const hits = ((d.hits || {}).hits || []).map((h: { _source: Record<string, any> }) => h._source || {});
  if (!hits.length) return json({ ok: true, achou: false, tribunal: a.toUpperCase() });
  const movs: { data: string; nome: string; grau: string }[] = [];
  for (const s of hits) {
    for (const m of s.movimentos || []) {
      const comp = (m.complementosTabelados || []).map((c: { nome?: string }) => c && c.nome).filter(Boolean);
      movs.push({ data: m.dataHora || "", nome: (m.nome || "Movimentação") + (comp.length ? ` (${comp.join(", ")})` : ""), grau: s.grau || "" });
    }
  }
  movs.sort((x, y) => String(y.data).localeCompare(String(x.data)));
  const principal = hits.slice().sort((x: Record<string, any>, y: Record<string, any>) => String(y.dataHoraUltimaAtualizacao || "").localeCompare(String(x.dataHoraUltimaAtualizacao || "")))[0];
  const primeiro = hits.slice().sort((x: Record<string, any>, y: Record<string, any>) => String(x.dataAjuizamento || "9").localeCompare(String(y.dataAjuizamento || "9")))[0];
  const aj = String(primeiro.dataAjuizamento || "");
  return json({
    ok: true, achou: true,
    tribunal: principal.tribunal || a.toUpperCase(),
    classe: (principal.classe || {}).nome || "",
    assuntos: [...new Set(hits.flatMap((s: Record<string, any>) => (s.assuntos || []).map((x: { nome?: string }) => x && x.nome).filter(Boolean)))].slice(0, 6),
    orgao: (principal.orgaoJulgador || {}).nome || "",
    grau: principal.grau || "",
    graus: [...new Set(hits.map((s: Record<string, any>) => s.grau).filter(Boolean))],
    ajuizamento: /^\d{8}/.test(aj) ? `${aj.slice(0, 4)}-${aj.slice(4, 6)}-${aj.slice(6, 8)}` : aj.slice(0, 10),
    sigilo: Number(principal.nivelSigilo || 0),
    movimentos: movs.slice(0, 20),
  });
});
