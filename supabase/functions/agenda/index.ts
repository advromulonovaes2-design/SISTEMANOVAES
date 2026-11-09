// Agenda do escritório para o Google Agenda, o calendário do iPhone ou o Outlook.
// Cada pessoa tem um link secreto (?t=...). Com "&escopo=todos", traz o escritório inteiro;
// sem isso, só os prazos e compromissos em que a pessoa é responsável.
// (O plenário do júri já vira um compromisso na agenda, por isso entra junto.)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

function chaveServico(): string {
  try {
    const d = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const v = Object.values(d).find(Boolean);
    if (v) return String(v);
  } catch (_) { /* usa a antiga */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}
const esc = (s: unknown) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function dobra(l: string): string {
  const b = new TextEncoder().encode(l);
  if (b.length <= 74) return l;
  const out: string[] = [];
  let atual = "";
  for (const ch of l) {
    if (new TextEncoder().encode(atual + ch).length > 73) { out.push(atual); atual = " " + ch; } else atual += ch;
  }
  out.push(atual);
  return out.join("\r\n");
}
const dia = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const proxDia = (iso: string) => { const d = new Date(iso.slice(0, 10) + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); };
// Belém é UTC-3 o ano todo
const utc = (data: string, hora: string) => {
  const [h, m] = (hora || "00:00").split(":").map(Number);
  const d = new Date(Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10), (h || 0) + 3, m || 0));
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
};
const AGENDA = new Set(["Audiência", "Perícia judicial", "Perícia administrativa (INSS)", "Plenário do Júri", "Sessão de julgamento",
  "Reunião com cliente", "Atendimento", "Diligência", "Visita ao cliente preso", "Outro compromisso"]);

Deno.serve(async (req: Request) => {
  const u = new URL(req.url);
  const token = u.searchParams.get("t") || "";
  const todos = u.searchParams.get("escopo") === "todos";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Link incompleto.", { status: 400 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, chaveServico(), { auth: { persistSession: false } });
  const { data: ac } = await sb.from("acesso").select("email").eq("agenda_token", token).maybeSingle();
  if (!ac) return new Response("Este link de agenda foi trocado ou desativado.", { status: 404 });
  const email = String(ac.email).toLowerCase();

  const ler = async (t: string) => ((await sb.from(t).select("id,dados")).data || []).map((r: { id: string; dados: Record<string, unknown> }) => ({ id: r.id, ...r.dados })) as Record<string, any>[];
  const [equipe, processos, clientes, prazos, eventos] = await Promise.all(
    ["equipe", "processos", "clientes", "prazos", "eventos"].map(ler),
  );
  const eu = equipe.find((m) => String(m.email || "").toLowerCase() === email);
  const meu = (x: Record<string, any>) => todos || (eu && x.responsavelId === eu.id);
  const proc = new Map(processos.map((p) => [p.id, p]));
  const cli = new Map(clientes.map((c) => [c.id, c]));
  const pessoa = new Map(equipe.map((m) => [m.id, m.nome]));
  const desde = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ev: string[] = [];
  const add = (linhas: string[]) => ev.push("BEGIN:VEVENT", `DTSTAMP:${agora}`, ...linhas, "END:VEVENT");

  for (const p of prazos) {
    const venc = String(p.vencManual || p.vencimento || "");
    if (p.cumprido || !/^\d{4}-\d{2}-\d{2}/.test(venc) || venc < desde || !meu(p)) continue;
    const pr = proc.get(p.processoId) || {};
    const c = cli.get(pr.clienteId) || {};
    add([
      `UID:prazo-${p.id}@palha-novaes`,
      `DTSTART;VALUE=DATE:${dia(venc)}`, `DTEND;VALUE=DATE:${proxDia(venc)}`,
      `SUMMARY:${esc(`PRAZO: ${p.descricao || "Prazo"}${c.nome ? " – " + c.nome : ""}`)}`,
      `DESCRIPTION:${esc([pr.numero ? "Processo " + pr.numero : "", pr.vara || "", pessoa.get(p.responsavelId) ? "Responsável: " + pessoa.get(p.responsavelId) : "",
        p.conferidoPor ? "Conferido" : "Ainda não conferido por uma segunda pessoa"].filter(Boolean).join("\n"))}`,
      "TRANSP:TRANSPARENT",
    ]);
  }
  for (const e of eventos) {
    const d = String(e.data || "");
    if (!/^\d{4}-\d{2}-\d{2}/.test(d) || d < desde || !(AGENDA.has(e.tipo) || e.hora) || !meu(e)) continue;
    const pr = proc.get(e.processoId) || {};
    const c = cli.get(e.clienteId || pr.clienteId) || {};
    const ini = e.hora ? `DTSTART:${utc(d, e.hora)}` : `DTSTART;VALUE=DATE:${dia(d)}`;
    const fimH = e.horaFim || (e.hora ? `${String((+e.hora.slice(0, 2) + 1) % 24).padStart(2, "0")}:${e.hora.slice(3, 5)}` : "");
    const fim = e.hora ? `DTEND:${utc(d, fimH)}` : `DTEND;VALUE=DATE:${proxDia(d)}`;
    add([
      `UID:evento-${e.id}@palha-novaes`, ini, fim,
      `SUMMARY:${esc(`${e.tipo && e.tipo !== e.titulo ? e.tipo + ": " : ""}${e.titulo || ""}${c.nome ? " – " + c.nome : ""}`)}`,
      `LOCATION:${esc(e.link || e.local || "")}`,
      `DESCRIPTION:${esc([e.modalidade || "", e.link ? "Sala virtual: " + e.link : "", e.linkInfo || "", pr.numero ? "Processo " + pr.numero : "",
        pessoa.get(e.responsavelId) ? "Responsável: " + pessoa.get(e.responsavelId) : "", e.descricao || ""].filter(Boolean).join("\n"))}`,
    ]);
  }
  const cal = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Palha Novaes Advocacia//Sistema//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(todos ? "Escritório – prazos e agenda" : "Meus prazos e compromissos")}`,
    "X-WR-TIMEZONE:America/Belem", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
    ...ev, "END:VCALENDAR",
  ].map(dobra).join("\r\n") + "\r\n";
  return new Response(cal, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" } });
});
