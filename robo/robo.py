#!/usr/bin/env python3
"""
Robô do escritório (roda sozinho no GitHub Actions, de segunda a sexta).

O que ele faz:
  1. Busca no DJEN as intimações de cada OAB cadastrada na Equipe e dos clientes
     marcados como "monitorar", e guarda as novas no sistema.
  2. Busca na API pública do CNJ (DataJud) a última movimentação de cada processo.
  3. De manhã, avisa cada responsável sobre prazos (vencidos, hoje e próximos 3 dias)
     e sobre parcelas de honorários vencendo.
  4. Manda os avisos por Telegram, e-mail, WhatsApp (CallMeBot) e notificação no
     celular (push), conforme o que cada pessoa cadastrou.
  5. Avisa quando um cliente manda documentos pelo link.
  6. Toda segunda de manhã, faz uma cópia de segurança de todos os dados, guarda
     no Supabase (pasta "backups", privada) e manda para o e-mail do escritório.

Usa a biblioteca padrão do Python. Só a notificação no celular precisa do pacote
"cryptography", que o GitHub instala sozinho (passo no arquivo robo.yml).
As senhas e chaves ficam nos "Secrets" do GitHub, nunca neste arquivo.
"""
import base64
import gzip
import hashlib
import hmac
import html
import json
import os
import re
import smtplib
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

TZ = timezone(timedelta(hours=-3))  # Belém (sem horário de verão)
HOJE = datetime.now(TZ).date()
MODO = os.environ.get("MODO", "manha")  # manha = tudo; tarde = só intimações e movimentações; busca = botão "Buscar agora"
STATUS = {"djen": "não consultado", "consultas": 0, "novas": 0, "antigas": 0}
SB_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
TG_TOKEN = os.environ.get("TELEGRAM_TOKEN", "").strip()
TG_GRUPO = os.environ.get("TELEGRAM_GRUPO", "").strip()
GM_USER = os.environ.get("GMAIL_USER", "").strip()
GM_PASS = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "").strip()
ALERTA_EMAIL = os.environ.get("ALERTA_EMAIL", "").strip()
APP_URL = os.environ.get("APP_URL", "").strip()
# Chave pública do DataJud divulgada pelo CNJ. Se parar de funcionar, pegue a nova em
# https://datajud-wiki.cnj.jus.br/api-publica/acesso e cadastre no Secret DATAJUD_KEY.
VAPID_PRIVATE = os.environ.get("VAPID_PRIVATE", "").strip()
FORCAR_BACKUP = os.environ.get("FORCAR_BACKUP", "").strip() in ("1", "sim", "true")
DATAJUD_KEY = os.environ.get("DATAJUD_KEY", "").strip() or "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
DIAS_DJEN = int(os.environ.get("DIAS_DJEN", "3") or 3)
# botão "Buscar agora": qual OAB (vazio = todas) e quantos dias para trás
BUSCA_OAB = os.environ.get("BUSCA_OAB", "").strip().upper()
try:
    BUSCA_DIAS = max(1, min(int(os.environ.get("BUSCA_DIAS", "") or 0), 800))
except ValueError:
    BUSCA_DIAS = 0
DIAS_RECENTE = 7  # comunicações mais antigas que isso entram como "antiga", sem encher a lista de novas
UA = "Mozilla/5.0 (compatible; robo-escritorio/1.0)"
# o Supabase recusa a chave secreta quando o pedido parece vir de um navegador ("Mozilla")
UA_SB = "robo-escritorio/1.0 (python-urllib)"
DJEN_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao"


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- HTTP
def http(method, url, body=None, headers=None, timeout=60, tentativas=3):
    h = {"User-Agent": UA, "Accept": "application/json"}
    h.update(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    ultimo = None
    for t in range(tentativas):
        try:
            req = urllib.request.Request(url, data=data, method=method, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                txt = r.read().decode("utf-8", "replace")
                return json.loads(txt) if txt.strip() else None
        except urllib.error.HTTPError as e:
            ultimo = e
            corpo = e.read().decode("utf-8", "replace")[:300]
            if e.code in (429, 500, 502, 503, 504) and t < tentativas - 1:
                time.sleep(3 * (t + 1))
                continue
            raise RuntimeError(f"HTTP {e.code} em {url.split('?')[0]}: {corpo}") from None
        except (urllib.error.URLError, TimeoutError) as e:
            ultimo = e
            if t < tentativas - 1:
                time.sleep(3 * (t + 1))
                continue
            raise RuntimeError(f"Sem conexão com {url.split('?')[0]}: {e}") from None
    raise RuntimeError(str(ultimo))


def sb(method, path, body=None, params=None, prefer=None):
    url = f"{SB_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, safe=",.()*:\"")
    h = {"apikey": SB_KEY, "User-Agent": UA_SB}
    if SB_KEY.startswith("eyJ"):  # chave antiga (JWT); as novas sb_secret_ vão só no apikey
        h["Authorization"] = "Bearer " + SB_KEY
    if prefer:
        h["Prefer"] = prefer
    return http(method, url, body, h)


def registros(tabela):
    rows = sb("GET", tabela, params={"select": "id,dados"}) or []
    return [{**(r.get("dados") or {}), "id": r["id"]} for r in rows]


# ---------------------------------------------------------------- utilidades
def digitos(s):
    return re.sub(r"\D", "", str(s or ""))


def fmt_cnj(d):
    return f"{d[0:7]}-{d[7:9]}.{d[9:13]}.{d[13]}.{d[14:16]}.{d[16:20]}" if len(d) == 20 else d


def g(obj, *chaves):
    for c in chaves:
        v = obj.get(c)
        if v not in (None, ""):
            return v
    return None


def para_data(s):
    s = str(s or "").strip()
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m[1]}-{m[2]}-{m[3]}"
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", s)
    if m:
        return f"{m[3]}-{m[2]}-{m[1]}"
    return None


def para_dt(s):
    """Converte datas do DataJud/Supabase em datetime com fuso, para comparar."""
    s = str(s or "").strip()
    if not s:
        return None
    if re.fullmatch(r"\d{14}", s):
        return datetime.strptime(s, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    s = s.replace("Z", "+00:00")
    s = re.sub(r"\.(\d{1,6})\d*", r".\1", s)
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        try:
            d = datetime.fromisoformat(s[:19])
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def br(d):
    if isinstance(d, str):
        d = date.fromisoformat(d[:10])
    return d.strftime("%d/%m/%Y")


def sem_html(t):
    t = re.sub(r"<br\s*/?>|</p>", "\n", str(t or ""), flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t).replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n\n", t).strip()


UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SE SP TO".split()


def parse_oab(s):
    t = str(s or "").upper()
    uf = next((u for u in re.findall(r"(?<![A-Z])([A-Z]{2})(?![A-Z])", t) if u in UFS), None)
    num = re.findall(r"\d+", t.replace(".", ""))
    return (uf, num[0]) if uf and num else (None, None)


# ---------------------------------------------------------------- DJEN
# O DJEN recusa servidores fora do Brasil. Por isso o robô consulta pela função "djen"
# do Supabase, que roda em São Paulo. DJEN_DIRETO=1 consulta direto (ex.: robô num PC no Brasil).
DJEN_DIRETO = os.environ.get("DJEN_DIRETO", "").strip() in ("1", "sim", "true")
_PONTE = {"ok": None}


def djen_get(q):
    qs = urllib.parse.urlencode(q)
    if not DJEN_DIRETO and _PONTE["ok"] is not False:
        h = {"apikey": SB_KEY, "User-Agent": UA_SB, "x-region": "sa-east-1"}
        if SB_KEY.startswith("eyJ"):
            h["Authorization"] = "Bearer " + SB_KEY
        try:
            j = http("GET", f"{SB_URL}/functions/v1/djen?{qs}", headers=h, timeout=90)
            if _PONTE["ok"] is None:
                log("DJEN: consultando pela ponte do Supabase em São Paulo.")
            _PONTE["ok"] = True
            return j
        except Exception as e:
            if _PONTE["ok"] is None and re.search(r"HTTP (401|404)", str(e)):
                _PONTE["ok"] = False  # função não instalada ou chave recusada: tenta direto
                log(f"DJEN: ponte do Supabase indisponível ({str(e)[:120]}); tentando direto.")
            else:
                raise
    return http("GET", DJEN_URL + "?" + qs, timeout=90)


def djen(params):
    itens = []
    for pag in range(1, 21):
        q = {**params, "pagina": pag, "itensPorPagina": 100}
        j = djen_get(q) or {}
        lote = j.get("items") or j.get("itens") or j.get("content") or []
        itens += lote
        if len(lote) < 100:
            break
        time.sleep(1.5)
    return itens


POLO = {"A": "ativo", "P": "passivo", "T": "terceiro"}


def normaliza(it):
    num = g(it, "numeroprocessocommascara", "numeroProcessoComMascara") or g(it, "numero_processo", "numeroProcesso", "numeroprocesso") or ""
    n20 = digitos(num)
    data = para_data(g(it, "data_disponibilizacao", "dataDisponibilizacao", "datadisponibilizacao"))
    dest = it.get("destinatarios") or []
    partes = "; ".join(
        (d.get("nome") or "").strip() + (f" ({POLO.get(d.get('polo'), d.get('polo'))})" if d.get("polo") else "")
        for d in dest if isinstance(d, dict) and d.get("nome")
    )[:600]
    texto = sem_html(g(it, "texto") or "")
    h = g(it, "hash") or hashlib.sha1(f"{g(it, 'id')}|{n20}|{data}|{texto[:300]}".encode()).hexdigest()
    link = g(it, "link") or ""
    return {
        "hash": str(h), "djen_id": str(g(it, "id") or ""),
        "numero": fmt_cnj(n20) if len(n20) == 20 else str(num),
        "tribunal": g(it, "siglaTribunal", "sigla_tribunal", "tribunal") or "",
        "orgao": g(it, "nomeOrgao", "nome_orgao", "orgao") or "",
        "classe": g(it, "nomeClasse", "nome_classe", "classe") or "",
        "tipo": g(it, "tipoComunicacao", "tipo_comunicacao") or "",
        "tipo_documento": g(it, "tipoDocumento", "tipo_documento") or "",
        "data_disponibilizacao": data,
        "texto": texto[:20000], "link": link if str(link).startswith("http") else "",
        "partes": partes, "bruto": it,
    }


# ---------------------------------------------------------------- DataJud (CNJ)
UF_TR = {"01": "ac", "02": "al", "03": "ap", "04": "am", "05": "ba", "06": "ce", "07": "df", "08": "es", "09": "go",
         "10": "ma", "11": "mt", "12": "ms", "13": "mg", "14": "pa", "15": "pb", "16": "pr", "17": "pe", "18": "pi",
         "19": "rj", "20": "rn", "21": "rs", "22": "ro", "23": "rr", "24": "sc", "25": "se", "26": "sp", "27": "to"}


def alias_datajud(n20):
    if len(n20) != 20:
        return None
    j, tr = n20[13], n20[14:16]
    if j == "4":
        return f"trf{int(tr)}" if tr != "00" else None
    if j == "8":
        return ("tjdft" if tr == "07" else f"tj{UF_TR[tr]}") if tr in UF_TR else None
    if j == "5":
        return "tst" if tr == "00" else f"trt{int(tr)}"
    if j == "6":
        return "tse" if tr == "00" else (f"tre-{UF_TR[tr]}" if tr in UF_TR else None)
    if j == "9":
        return {"13": "tjmmg", "21": "tjmrs", "26": "tjmsp"}.get(tr)
    if j == "3":
        return "stj"
    if j == "7":
        return "stm"
    return None


_cache_mov = {}


def ultima_mov(n20):
    if n20 in _cache_mov:
        return _cache_mov[n20]
    a = alias_datajud(n20)
    res = None
    if a:
        try:
            j = http("POST", f"https://api-publica.datajud.cnj.jus.br/api_publica_{a}/_search",
                     {"query": {"match": {"numeroProcesso": n20}}, "size": 5},
                     {"Authorization": "APIKey " + DATAJUD_KEY}, timeout=60) or {}
            for hit in (j.get("hits") or {}).get("hits") or []:
                src = hit.get("_source") or {}
                for m in src.get("movimentos") or []:
                    dt = para_dt(m.get("dataHora"))
                    if not dt:
                        continue
                    if res is None or dt > res["_dt"]:
                        comp = [c.get("nome") for c in (m.get("complementosTabelados") or []) if isinstance(c, dict) and c.get("nome")]
                        res = {"nome": (m.get("nome") or "Movimentação") + (f" ({', '.join(comp)})" if comp else ""),
                               "_dt": dt, "classe": (src.get("classe") or {}).get("nome", ""),
                               "orgao": (src.get("orgaoJulgador") or {}).get("nome", "")}
            time.sleep(0.4)
        except Exception as e:
            log(f"  DataJud: não consegui consultar {fmt_cnj(n20)}: {e}")
    _cache_mov[n20] = res
    return res


# ---------------------------------------------------------------- envio de avisos
def tg(chat, texto):
    for i in range(0, len(texto), 3900):
        http("POST", f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage",
             {"chat_id": chat, "text": texto[i:i + 3900], "disable_web_page_preview": True}, tentativas=2)


def email(para, assunto, texto):
    msg = MIMEText(texto, "plain", "utf-8")
    msg["Subject"] = assunto
    msg["From"] = formataddr(("Robô do escritório", GM_USER))
    msg["To"] = para
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=30) as s:
        s.login(GM_USER, GM_PASS)
        s.sendmail(GM_USER, [para], msg.as_string())


def whatsapp(fone, chave, texto):
    d = digitos(fone)
    if not d.startswith("55"):
        d = "55" + d
    url = "https://api.callmebot.com/whatsapp.php?" + urllib.parse.urlencode({"phone": "+" + d, "text": texto[:1800], "apikey": chave})
    urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40).read()


ENVIADOS = {"telegram": 0, "email": 0, "whatsapp": 0, "push": 0, "falhas": 0}


# ---------------------------------------------------------------- notificação no celular (Web Push)
def b64u_dec(s):
    s = str(s).strip()
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def b64u(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _hkdf(salt, ikm, info, n):
    prk = hmac.new(salt, ikm, hashlib.sha256).digest()
    return hmac.new(prk, info + b"\x01", hashlib.sha256).digest()[:n]


def cifrar_push(assinatura, dados):
    """Criptografa a mensagem para o aparelho (RFC 8291, aes128gcm)."""
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives import serialization
    chaves = assinatura.get("keys") or {}
    ua_pub = b64u_dec(chaves["p256dh"])
    auth = b64u_dec(chaves["auth"])
    priv = ec.generate_private_key(ec.SECP256R1())
    as_pub = priv.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    segredo = priv.exchange(ec.ECDH(), ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), ua_pub))
    ikm = _hkdf(auth, segredo, b"WebPush: info\x00" + ua_pub + as_pub, 32)
    salt = os.urandom(16)
    cek = _hkdf(salt, ikm, b"Content-Encoding: aes128gcm\x00", 16)
    nonce = _hkdf(salt, ikm, b"Content-Encoding: nonce\x00", 12)
    cifrado = AESGCM(cek).encrypt(nonce, dados + b"\x02", None)
    return salt + (4096).to_bytes(4, "big") + bytes([len(as_pub)]) + as_pub + cifrado


_VAPID = {}


def vapid_cabecalho(endpoint):
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    from cryptography.hazmat.primitives import hashes, serialization
    if "chave" not in _VAPID:
        _VAPID["chave"] = ec.derive_private_key(int.from_bytes(b64u_dec(VAPID_PRIVATE), "big"), ec.SECP256R1())
        _VAPID["pub"] = b64u(_VAPID["chave"].public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    u = urllib.parse.urlparse(endpoint)
    contato = GM_USER or ALERTA_EMAIL or "robo@escritorio.adv.br"
    cab = b64u(json.dumps({"typ": "JWT", "alg": "ES256"}, separators=(",", ":")).encode())
    corpo = b64u(json.dumps({"aud": f"{u.scheme}://{u.netloc}", "exp": int(time.time()) + 12 * 3600, "sub": "mailto:" + contato}, separators=(",", ":")).encode())
    der = _VAPID["chave"].sign(f"{cab}.{corpo}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s_ = decode_dss_signature(der)
    jwt = f"{cab}.{corpo}.{b64u(r.to_bytes(32, 'big') + s_.to_bytes(32, 'big'))}"
    return f"vapid t={jwt}, k={_VAPID['pub']}"


PUSH = {"lista": None, "ok": None}


def push_disponivel():
    if PUSH["ok"] is None:
        PUSH["ok"] = False
        if not VAPID_PRIVATE:
            return False
        try:
            import cryptography  # noqa: F401
        except ImportError:
            log("Notificação no celular: falta o pacote cryptography (confira o passo de instalação no robo.yml).")
            return False
        try:
            PUSH["lista"] = sb("GET", "push", params={"select": "endpoint,email,membro_id,assinatura"}) or []
            PUSH["ok"] = True
            log(f"Aparelhos com notificação: {len(PUSH['lista'])}")
        except Exception as e:
            log(f"Notificação no celular: não li a tabela push ({e}). Rode banco/2-atualizacao.sql.")
    return PUSH["ok"]


def enviar_push(assinatura, titulo, corpo, url="", tag=""):
    ep = assinatura.get("endpoint", "")
    dados = json.dumps({"titulo": titulo[:80], "corpo": corpo[:400], "url": url or APP_URL or "./", "tag": tag}, ensure_ascii=False).encode()
    req = urllib.request.Request(ep, data=cifrar_push(assinatura, dados), method="POST", headers={
        "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
        "TTL": "86400", "Urgency": "high", "Authorization": vapid_cabecalho(ep)})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


CABECALHOS = {"PRAZOS": "Prazos", "INTIMAÇÕES": "Intimações novas", "AUDIÊNCIAS": "Compromissos", "HONORÁRIOS": "Honorários",
              "NOVAS MOVIMENTAÇÕES": "Movimentações", "DOCUMENTOS ENVIADOS": "Documentos de cliente"}


def resumo_push(texto):
    linhas = [l.strip() for l in texto.splitlines() if l.strip()]
    titulos = [l for l in linhas if l.startswith(tuple(CABECALHOS))]
    resto = [l for l in linhas if l not in titulos]
    cab = " · ".join(next(v for k, v in CABECALHOS.items() if t.startswith(k)) for t in titulos[:4])
    return cab + ("\n" + "\n".join(resto[:3]) if resto else "")


def enviar_push_membro(membro, assunto, texto, so_emails=None):
    if not push_disponivel():
        return 0
    em = str(membro.get("email") or "").lower()
    alvos = [p for p in PUSH["lista"] if p.get("membro_id") == membro.get("id") or (em and str(p.get("email") or "").lower() == em)]
    n = 0
    for p in alvos:
        try:
            st = enviar_push(p.get("assinatura") or {}, assunto, resumo_push(texto), tag="avisos-" + HOJE.isoformat())
            if st in (200, 201, 202):
                n += 1
                ENVIADOS["push"] += 1
            elif st in (404, 410):  # aparelho desinstalou ou desligou: tira da lista
                sb("DELETE", "push", params={"endpoint": "eq." + p["endpoint"]})
                PUSH["lista"] = [x for x in PUSH["lista"] if x["endpoint"] != p["endpoint"]]
                log(f"  Aparelho de {membro.get('nome', '?')} não aceita mais avisos; removido.")
            else:
                ENVIADOS["falhas"] += 1
                log(f"  Push para {membro.get('nome', '?')} recusado (HTTP {st}).")
        except Exception as e:
            ENVIADOS["falhas"] += 1
            log(f"  Push para {membro.get('nome', '?')} falhou: {e}")
    return n


def entregar(membro, assunto, texto):
    """Envia para todos os canais cadastrados da pessoa. Retorna True se algum funcionou."""
    ok = False
    corpo = texto + (f"\n\nAbrir o sistema: {APP_URL}" if APP_URL else "")
    nome = membro.get("nome", "?")
    if TG_TOKEN and membro.get("telegram"):
        try:
            tg(str(membro["telegram"]).strip(), f"{assunto}\n\n{corpo}")
            ENVIADOS["telegram"] += 1
            ok = True
        except Exception as e:
            ENVIADOS["falhas"] += 1
            log(f"  Telegram para {nome} falhou: {e}")
    if GM_USER and GM_PASS and membro.get("email"):
        try:
            email(membro["email"], assunto, corpo)
            ENVIADOS["email"] += 1
            ok = True
        except Exception as e:
            ENVIADOS["falhas"] += 1
            log(f"  E-mail para {nome} falhou: {e}")
    enviar_push_membro(membro, assunto, texto)
    if membro.get("callmebot") and membro.get("telefone"):
        try:
            whatsapp(membro["telefone"], str(membro["callmebot"]).strip(), f"{assunto}\n\n{texto}")
            ENVIADOS["whatsapp"] += 1
            ok = True
        except Exception as e:
            ENVIADOS["falhas"] += 1
            log(f"  WhatsApp para {nome} falhou: {e}")
    return ok


# ---------------------------------------------------------------- tarefas do robô
def janelas(dias):
    """Divide o período em blocos de 30 dias (o DJEN responde melhor a períodos curtos)."""
    out, d = [], HOJE - timedelta(days=dias)
    while d <= HOJE:
        f = min(d + timedelta(days=29), HOJE)
        out.append((d.isoformat(), f.isoformat()))
        d = f + timedelta(days=1)
    return out


def buscar_intimacoes(equipe, clientes, processos, avisos):
    dias = BUSCA_DIAS if (MODO == "busca" and BUSCA_DIAS) else DIAS_DJEN
    ini = (HOJE - timedelta(days=dias)).isoformat()
    fim = HOJE.isoformat()
    periodos = janelas(dias)
    achadas = {}  # hash -> registro
    falhas = sucesso = 0
    STATUS["periodo_dias"] = dias
    STATUS["oab"] = BUSCA_OAB if MODO == "busca" else ""

    def guardar(itens, origem, oab=None, resp_id=None, cli_id=None):
        for it in itens:
            n = normaliza(it)
            if n["hash"] in achadas:
                continue
            n.update({"origem": origem, "oab": oab, "responsavel_id": resp_id, "cliente_id": cli_id})
            achadas[n["hash"]] = n

    alvo = parse_oab(BUSCA_OAB) if (MODO == "busca" and BUSCA_OAB) else None
    for m in equipe:
        uf, num = parse_oab(m.get("oab"))
        if not uf:
            continue
        if alvo and (uf, str(int(num))) != (alvo[0], str(int(alvo[1]))):
            continue
        rotulo = f"{uf} {num}"
        try:
            itens = []
            for a, b in periodos:
                lote = djen({"numeroOab": str(int(num)), "ufOab": uf, "dataDisponibilizacaoInicio": a, "dataDisponibilizacaoFim": b})
                if not lote and num != str(int(num)):
                    lote = djen({"numeroOab": num, "ufOab": uf, "dataDisponibilizacaoInicio": a, "dataDisponibilizacaoFim": b})
                itens += lote
                if len(periodos) > 1:
                    time.sleep(0.5)
            log(f"DJEN OAB {rotulo} ({m.get('nome')}): {len(itens)} comunicação(ões) de {br(ini)} a {br(fim)}")
            guardar(itens, "oab", rotulo, m["id"])
            sucesso += 1
        except Exception as e:
            falhas += 1
            log(f"DJEN OAB {rotulo}: ERRO {e}")
        time.sleep(1)

    for c in ([] if alvo else clientes):
        if not c.get("monitorar") or not c.get("nome"):
            continue
        pr = next((p for p in processos if p.get("clienteId") == c["id"] and p.get("responsavelId")), None)
        try:
            itens = djen({"nomeParte": c["nome"], "dataDisponibilizacaoInicio": ini, "dataDisponibilizacaoFim": fim})
            log(f"DJEN cliente {c['nome']}: {len(itens)} comunicação(ões)")
            guardar(itens, "nome", None, pr.get("responsavelId") if pr else None, c["id"])
            sucesso += 1
        except Exception as e:
            falhas += 1
            log(f"DJEN cliente {c['nome']}: ERRO {e}")
        time.sleep(1)

    STATUS["consultas"] = sucesso
    STATUS["djen"] = "falhou" if falhas and not sucesso else ("ok" if sucesso else "sem OAB cadastrada")
    STATUS["falhasSeguidas"] = (int(ANTERIOR.get("falhasSeguidas") or 0) + 1) if STATUS["djen"] == "falhou" else 0
    if falhas and not sucesso and STATUS["falhasSeguidas"] >= 2 and MODO != "busca":
        avisos["_geral"].append(f"ATENÇÃO: é a {STATUS['falhasSeguidas']}ª vez seguida que o robô não consegue acessar o DJEN. "
                                "Confira as intimações manualmente em comunica.pje.jus.br e veja Ajustes › Saúde do sistema. ")
    if falhas and not sucesso:
        log("ATENÇÃO: todas as consultas ao DJEN falharam. Se o erro for 403, o DJEN pode estar bloqueando servidores fora do Brasil: veja o plano B no passo a passo.")

    if not achadas:
        return 0
    # descarta as que já estão no sistema
    hashes = list(achadas)
    existentes = set()
    for i in range(0, len(hashes), 40):
        lote = ",".join('"' + h.replace('"', "") + '"' for h in hashes[i:i + 40])
        for r in sb("GET", "intimacoes", params={"select": "hash", "hash": f"in.({lote})"}) or []:
            existentes.add(r["hash"])
    novas = [achadas[h] for h in hashes if h not in existentes]
    if not novas:
        log("Nenhuma intimação nova.")
        return 0
    por_num = {digitos(p.get("numero")): p for p in processos if digitos(p.get("numero"))}
    corte = (HOJE - timedelta(days=DIAS_RECENTE)).isoformat()
    for n in novas:
        n20 = digitos(n["numero"])
        pr = por_num.get(n20)
        if pr and not n.get("responsavel_id"):
            n["responsavel_id"] = pr.get("responsavelId")
        n["status"] = "antiga" if (n.get("data_disponibilizacao") or fim) < corte else "nova"
        if n["status"] == "antiga":
            n["bruto"] = None  # economiza espaço no banco grátis: a cópia completa só fica nas recentes
            n["texto"] = (n.get("texto") or "")[:3000]
            continue  # antigas não pedem a última movimentação (seriam centenas de consultas)
        mv = ultima_mov(n20) if len(n20) == 20 else None
        if mv:
            n["ultima_mov"] = mv["nome"]
            n["ultima_mov_data"] = mv["_dt"].isoformat()
    campos = ["hash", "djen_id", "origem", "oab", "cliente_id", "responsavel_id", "numero", "tribunal", "orgao", "classe", "tipo",
              "tipo_documento", "data_disponibilizacao", "texto", "link", "partes", "ultima_mov", "ultima_mov_data", "bruto", "status"]
    linhas = [{k: n.get(k) for k in campos} for n in novas]  # o Supabase exige as mesmas colunas em todas
    for i in range(0, len(linhas), 50):
        sb("POST", "intimacoes", linhas[i:i + 50], params={"on_conflict": "hash"}, prefer="resolution=ignore-duplicates,return=minimal")
    antigas = sum(1 for n in novas if n["status"] == "antiga")
    STATUS["antigas"] = antigas
    novas = [n for n in novas if n["status"] == "nova"]
    if antigas:
        log(f"{antigas} comunicação(ões) com mais de {DIAS_RECENTE} dias guardada(s) como antigas (aba Processos da OAB).")
    for n in novas:
        ja = " (processo já cadastrado)" if digitos(n["numero"]) in por_num else ""
        txt = (f"• {n['tribunal']} {n['numero']}{ja}\n  {n['orgao']}\n  Disponibilizada em {br(n['data_disponibilizacao']) if n['data_disponibilizacao'] else '?'}"
               f"{' · ' + n['tipo_documento'] if n['tipo_documento'] else ''}"
               f"{chr(10) + '  Última movimentação: ' + n['ultima_mov'] if n.get('ultima_mov') else ''}"
               f"\n  {n['texto'][:280].replace(chr(10), ' ')}{'…' if len(n['texto']) > 280 else ''}")
        avisos[n.get("responsavel_id") or "_geral"].append(("int", txt))
    log(f"{len(novas)} intimação(ões) nova(s) guardada(s).")
    return len(novas)


def atualizar_movimentacoes(processos, avisos):
    try:
        atuais = {m["numero"]: m for m in (sb("GET", "movimentacoes", params={"select": "*"}) or [])}
    except Exception as e:
        log(f"Movimentações: não consegui ler a tabela: {e}")
        return 0
    mudou = 0
    for p in processos:
        n20 = digitos(p.get("numero"))
        if len(n20) != 20:
            continue
        mv = ultima_mov(n20)
        if not mv:
            continue
        antes = atuais.get(n20)
        if antes and para_dt(antes.get("data")) == mv["_dt"] and (antes.get("nome") or "") == mv["nome"]:
            continue
        sb("POST", "movimentacoes", [{"numero": n20, "nome": mv["nome"], "data": mv["_dt"].isoformat(), "classe": mv["classe"],
                                      "orgao": mv["orgao"], "atualizado_em": datetime.now(timezone.utc).isoformat()}],
           params={"on_conflict": "numero"}, prefer="resolution=merge-duplicates,return=minimal")
        mudou += 1
        if antes:  # na primeira leitura não avisa, para não lotar as mensagens
            avisos[p.get("responsavelId") or "_geral"].append(
                ("mov", f"• {p.get('numero')}\n  {mv['nome']} — {mv['_dt'].astimezone(TZ).strftime('%d/%m/%Y')}"))
    log(f"Movimentações atualizadas: {mudou}")
    return mudou


def calcular_avisos_prazos(prazos, processos, clientes, avisos):
    procs = {p["id"]: p for p in processos}
    clis = {c["id"]: c for c in clientes}
    n = 0
    for pz in prazos:
        if pz.get("cumprido") or not pz.get("vencimento"):
            continue
        try:
            venc = date.fromisoformat(pz["vencimento"][:10])
        except ValueError:
            continue
        dd = (venc - HOJE).days
        if dd > 3 or dd < -30:
            continue
        quando = "VENCIDO há %d dia(s)" % -dd if dd < 0 else "VENCE HOJE" if dd == 0 else "vence amanhã" if dd == 1 else f"vence em {dd} dias"
        pr = procs.get(pz.get("processoId")) or {}
        cli = clis.get(pr.get("clienteId")) or {}
        conf = "" if pz.get("conferidoPor") else "\n  ⚠ Ainda não conferido por uma segunda pessoa."
        txt = f"• {quando} ({br(venc)}): {pz.get('descricao', 'Prazo')}\n  {pr.get('numero', 'sem processo')}{' — ' + cli['nome'] if cli.get('nome') else ''}{conf}"
        avisos[pz.get("responsavelId") or "_geral"].append(("prazo", (dd, txt)))
        n += 1
    log(f"Prazos para avisar: {n}")


AGENDA = {"Audiência", "Perícia judicial", "Perícia administrativa (INSS)", "Plenário do Júri", "Sessão de julgamento",
          "Reunião com cliente", "Atendimento", "Diligência", "Visita ao cliente preso", "Outro compromisso"}


def calcular_avisos_agenda(eventos, processos, clientes, avisos):
    procs = {p["id"]: p for p in processos}
    clis = {c["id"]: c for c in clientes}
    n = 0
    for e in eventos:
        if e.get("concluido") or not e.get("data") or not (e.get("tipo") in AGENDA or e.get("hora")):
            continue
        try:
            d = date.fromisoformat(e["data"][:10])
        except ValueError:
            continue
        dd = (d - HOJE).days
        if dd < 0 or dd > 2:
            continue
        quando = "HOJE" if dd == 0 else "amanhã" if dd == 1 else f"em {dd} dias"
        pr = procs.get(e.get("processoId")) or {}
        cli = clis.get(e.get("clienteId") or pr.get("clienteId")) or {}
        txt = (f"• {quando} ({br(d)}{' às ' + e['hora'] if e.get('hora') else ''}): {e.get('titulo') or e.get('tipo')}"
               f"{chr(10) + '  ' + e['local'] if e.get('local') else ''}"
               f"{chr(10) + '  ' + e['modalidade'] if e.get('modalidade') and e['modalidade'] != 'Presencial' else ''}"
               f"{chr(10) + '  Link: ' + e['link'] if str(e.get('link') or '').startswith('http') else ''}"
               f"{chr(10) + '  ' + e['linkInfo'] if e.get('linkInfo') and e.get('link') else ''}"
               f"{chr(10) + '  ' + pr['numero'] if pr.get('numero') else ''}{' — ' + cli['nome'] if cli.get('nome') else ''}")
        avisos[e.get("responsavelId") or pr.get("responsavelId") or "_geral"].append(("agenda", (dd, e.get("hora") or "99", txt)))
        n += 1
    log(f"Compromissos para avisar: {n}")


def calcular_avisos_financeiro(honorarios, clientes, equipe, avisos):
    clis = {c["id"]: c for c in clientes}
    fin = [m["id"] for m in equipe if re.search(r"Financ|Secret", m.get("funcao", ""))]
    n = 0
    for h in honorarios:
        if h.get("status") == "cancelado":
            continue
        for p in h.get("parcelas") or []:
            if p.get("pago") or not p.get("venc"):
                continue
            dd = (date.fromisoformat(p["venc"][:10]) - HOJE).days
            if dd > 2 or dd < -60:
                continue
            quando = f"ATRASADA há {-dd} dia(s)" if dd < 0 else "vence HOJE" if dd == 0 else f"vence em {dd} dia(s)"
            valor = f"{float(p.get('valor') or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            txt = f"• {clis.get(h.get('clienteId'), {}).get('nome', 'Cliente')}: {p.get('desc', 'parcela')} de R$ {valor} — {quando} ({br(p['venc'])})"
            destinos = [h["responsavelId"]] if h.get("responsavelId") else (fin or ["_geral"])
            for d in destinos:
                avisos[d].append(("fin", (dd, txt)))
            n += 1
    log(f"Parcelas para avisar: {n}")


def avisar_envios(equipe, processos, clientes, avisos):
    """Documentos que clientes mandaram pelo link e ninguém foi avisado ainda."""
    try:
        novos = sb("GET", "envios_arquivos", params={"select": "id,token,cliente_id,rotulo,item", "notificado": "eq.false", "order": "id", "limit": "500"}) or []
    except Exception as e:
        log(f"Documentos de clientes: não li a tabela ({e}). Rode banco/2-atualizacao.sql.")
        return
    if not novos:
        return
    tokens = sorted({n["token"] for n in novos})
    links = {}
    try:
        for l in sb("GET", "envios", params={"select": "token,criado_por", "token": "in.(" + ",".join(tokens) + ")"}) or []:
            links[l["token"]] = str(l.get("criado_por") or "").lower()
    except Exception:
        pass
    por_email = {str(m.get("email") or "").lower(): m for m in equipe if m.get("email")}
    nome_cli = {c["id"]: c.get("nome", "Cliente") for c in clientes}
    grupos = defaultdict(list)
    for n in novos:
        grupos[(n["cliente_id"], n["token"])].append(n)
    for (cid, tok), lst in grupos.items():
        resp = por_email.get(links.get(tok, ""))
        if not resp:
            pr = next((p for p in processos if p.get("clienteId") == cid and p.get("responsavelId")), None)
            rid = pr["responsavelId"] if pr else "_geral"
        else:
            rid = resp["id"]
        rot = ", ".join(sorted({x.get("rotulo") or x.get("item") or "documento" for x in lst}))[:300]
        avisos[rid].append(("doc", f"• {nome_cli.get(cid, 'Cliente')}: {len(lst)} {'arquivo' if len(lst) == 1 else 'arquivos'} ({rot}) — confira no cadastro do cliente"))
    try:
        ids = ",".join(str(n["id"]) for n in novos)
        sb("PATCH", "envios_arquivos", {"notificado": True}, params={"id": "in.(" + ids + ")"}, prefer="return=minimal")
    except Exception as e:
        log(f"Documentos de clientes: não marquei como avisado ({e}).")
    log(f"Documentos enviados por clientes: {len(novos)} novos")


TABELAS_BACKUP = ["config", "acesso", "equipe", "clientes", "processos", "prazos", "tarefas", "honorarios", "documentos",
                  "eventos", "juri", "modelos", "intimacoes", "movimentacoes", "envios", "envios_arquivos", "push", "historico"]


def ler_tudo(tabela):
    out, ini = [], 0
    while True:
        lote = sb("GET", tabela, params={"select": "*", "limit": "1000", "offset": str(ini)}) or []
        out += lote
        if len(lote) < 1000:
            return out
        ini += 1000


def storage(method, caminho, corpo=None, tipo="application/json", extra=None):
    h = {"apikey": SB_KEY, "User-Agent": UA_SB}
    if SB_KEY.startswith("eyJ"):
        h["Authorization"] = "Bearer " + SB_KEY
    h.update(extra or {})
    if corpo is not None and not isinstance(corpo, bytes):
        corpo = json.dumps(corpo).encode()
    if corpo is not None:
        h["Content-Type"] = tipo
    req = urllib.request.Request(f"{SB_URL}/storage/v1/{caminho}", data=corpo, method=method, headers=h)
    with urllib.request.urlopen(req, timeout=120) as r:
        t = r.read().decode("utf-8", "replace")
        return json.loads(t) if t.strip() else None


def fazer_backup():
    log("Cópia de segurança: lendo todas as tabelas…")
    dados, contagem = {"gerado_em": datetime.now(TZ).isoformat(), "versao": 3, "tabelas": {}}, {}
    for t in TABELAS_BACKUP:
        try:
            linhas = ler_tudo(t)
            dados["tabelas"][t] = linhas
            contagem[t] = len(linhas)
        except Exception as e:
            log(f"  {t}: não li ({e})")
    gz = gzip.compress(json.dumps(dados, ensure_ascii=False, default=str).encode("utf-8"), 9)
    nome = f"backup-{HOJE.isoformat()}.json.gz"
    tam = f"{len(gz) / 1024 / 1024:.1f} MB"
    salvo = False
    try:
        storage("POST", f"object/backups/{nome}", gz, "application/gzip", {"x-upsert": "true"})
        salvo = True
        log(f"  Guardado no Supabase: backups/{nome} ({tam})")
        STATUS["ultimoBackup"] = datetime.now(TZ).isoformat()
        STATUS["backupTamanho"] = tam
    except Exception as e:
        log(f"  Não guardei no Supabase ({e}). Rode banco/2-atualizacao.sql para criar a pasta backups.")
    if salvo:  # mantém as 12 cópias mais novas (cerca de 3 meses)
        try:
            lst = storage("POST", "object/list/backups", {"prefix": "", "limit": 200, "sortBy": {"column": "name", "order": "desc"}}) or []
            velhos = sorted((o["name"] for o in lst if str(o.get("name", "")).startswith("backup-")), reverse=True)[12:]
            if velhos:
                storage("DELETE", "object/backups", {"prefixes": velhos})
                log(f"  Apaguei {len(velhos)} cópias antigas.")
        except Exception as e:
            log(f"  Limpeza das cópias antigas falhou: {e}")
    para = ALERTA_EMAIL or GM_USER
    if GM_USER and GM_PASS and para:
        resumo = "\n".join(f"  {t}: {n}" for t, n in contagem.items())
        texto = (f"Cópia de segurança semanal de {HOJE.strftime('%d/%m/%Y')} ({tam}).\n\n"
                 f"Registros por tabela:\n{resumo}\n\n"
                 + ("A cópia também está guardada no Supabase, em Storage › backups.\n" if salvo else "")
                 + "Guarde este e-mail: o arquivo tem dados sigilosos de clientes (LGPD). Não encaminhe."
                 + " As senhas gov.br continuam embaralhadas pela senha do cofre.")
        try:
            msg = MIMEMultipart()
            msg["Subject"] = f"Cópia de segurança do escritório — {HOJE.strftime('%d/%m/%Y')}"
            msg["From"] = formataddr(("Robô do escritório", GM_USER))
            msg["To"] = para
            if len(gz) < 18 * 1024 * 1024:
                msg.attach(MIMEText(texto, "plain", "utf-8"))
                anexo = MIMEApplication(gz, "gzip")
                anexo.add_header("Content-Disposition", "attachment", filename=nome)
                msg.attach(anexo)
            else:
                msg.attach(MIMEText(texto + "\n\nO arquivo ficou grande demais para o e-mail; baixe pelo Supabase.", "plain", "utf-8"))
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ssl.create_default_context(), timeout=60) as s_:
                s_.login(GM_USER, GM_PASS)
                s_.sendmail(GM_USER, [para], msg.as_string())
            log(f"  Mandei a cópia para {para}.")
        except Exception as e:
            log(f"  E-mail da cópia falhou: {e}")


def montar_mensagem(itens):
    blocos = []
    pz = sorted([x[1] for x in itens if isinstance(x, tuple) and x[0] == "prazo"])
    if pz:
        blocos.append("PRAZOS\n" + "\n".join(t for _, t in pz))
    it = [x[1] for x in itens if isinstance(x, tuple) and x[0] == "int"]
    if it:
        blocos.append(f"INTIMAÇÕES NOVAS NO DJEN ({len(it)}) — cadastre na aba Intimações\n" + "\n".join(it))
    mv = [x[1] for x in itens if isinstance(x, tuple) and x[0] == "mov"]
    if mv:
        blocos.append("NOVAS MOVIMENTAÇÕES\n" + "\n".join(mv))
    ag = sorted([x[1] for x in itens if isinstance(x, tuple) and x[0] == "agenda"])
    if ag:
        blocos.insert(1 if pz else 0, "AUDIÊNCIAS, PERÍCIAS E COMPROMISSOS\n" + "\n".join(t for _, _, t in ag))
    dc = [x[1] for x in itens if isinstance(x, tuple) and x[0] == "doc"]
    if dc:
        blocos.append("DOCUMENTOS ENVIADOS PELO CLIENTE\n" + "\n".join(dc))
    fn = sorted([x[1] for x in itens if isinstance(x, tuple) and x[0] == "fin"])
    if fn:
        blocos.append("HONORÁRIOS A RECEBER\n" + "\n".join(t for _, t in fn))
    soltos = [x for x in itens if isinstance(x, str)]
    if soltos:
        blocos.append("\n".join(soltos))
    return "\n\n".join(blocos)


ANTERIOR = {}


def ler_status_anterior():
    try:
        r = sb("GET", "config", params={"select": "dados", "id": "eq.robo"}) or []
        ANTERIOR.update((r[0].get("dados") or {}) if r else {})
    except Exception:
        pass


def registrar_status(equipe=None):
    """Guarda quando e como o robô rodou: o sistema mostra "última busca" e o painel Saúde do sistema."""
    agora = datetime.now(TZ).isoformat()
    d = {**ANTERIOR, **STATUS, "ultimaExecucao": agora, "modo": MODO}
    if MODO in ("manha", "tarde"):
        d["ultimaRotina"] = agora
    d["canais"] = {"telegram": bool(TG_TOKEN), "gmail": bool(GM_USER and GM_PASS), "push": bool(VAPID_PRIVATE),
                   "grupo": bool(TG_TOKEN and TG_GRUPO), "alertaEmail": bool(ALERTA_EMAIL)}
    if equipe is not None:
        sem = []
        for m in equipe:
            tem = (TG_TOKEN and m.get("telegram")) or (GM_USER and GM_PASS and m.get("email")) or (m.get("callmebot") and m.get("telefone"))
            if not tem and VAPID_PRIVATE and PUSH.get("lista"):
                em = str(m.get("email") or "").lower()
                tem = any(x.get("membro_id") == m.get("id") or str(x.get("email") or "").lower() == em for x in PUSH["lista"])
            if not tem:
                sem.append(m.get("nome") or "?")
        d["semCanal"] = sem
    d["versaoRobo"] = "3.2"
    try:
        sb("POST", "config", {"id": "robo", "dados": d}, prefer="resolution=merge-duplicates,return=minimal")
        ANTERIOR.update(d)
    except Exception as e:
        log(f"Não registrei o horário da busca: {e}")


def main():
    log(f"Robô do escritório — {HOJE.strftime('%d/%m/%Y')} — modo {MODO}")
    if not SB_URL or not SB_KEY:
        log("ERRO: faltam os Secrets SUPABASE_URL e SUPABASE_SERVICE_KEY.")
        sys.exit(1)
    try:
        equipe = [m for m in registros("equipe") if m.get("ativo") is not False]
        clientes = registros("clientes")
        processos = registros("processos")
    except Exception as e:
        log(f"ERRO ao ler o banco de dados: {e}")
        sys.exit(1)
    log(f"Equipe ativa: {len(equipe)} · clientes: {len(clientes)} · processos: {len(processos)}")
    avisos = defaultdict(list)
    ler_status_anterior()

    try:
        STATUS["novas"] = buscar_intimacoes(equipe, clientes, processos, avisos) or 0
    except Exception as e:
        STATUS["djen"] = f"erro: {e}"
        log(f"Busca no DJEN: erro {e}")
    atualizar_movimentacoes(processos, avisos)
    if MODO == "busca":  # botão "Buscar agora": quem apertou está olhando a tela, então não manda avisos
        registrar_status(equipe)
        log(f"Busca pelo botão concluída: {STATUS}")
        return
    avisar_envios(equipe, processos, clientes, avisos)
    if MODO not in ("tarde", "busca"):
        try:
            calcular_avisos_prazos(registros("prazos"), processos, clientes, avisos)
            calcular_avisos_financeiro(registros("honorarios"), clientes, equipe, avisos)
        except Exception as e:
            log(f"Avisos de prazos/financeiro: erro {e}")
        try:
            calcular_avisos_agenda(registros("eventos"), processos, clientes, avisos)
        except Exception as e:
            log(f"Avisos de compromissos: erro {e} (se a tabela eventos não existe, rode banco/2-atualizacao.sql)")

    por_id = {m["id"]: m for m in equipe}
    advogados = [m for m in equipe if re.search(r"Advog", m.get("funcao", ""))]
    assunto = f"Escritório — avisos de {HOJE.strftime('%d/%m')}"
    geral = avisos.pop("_geral", [])
    for mid, itens in avisos.items():
        m = por_id.get(mid)
        texto = montar_mensagem(itens)
        if not texto:
            continue
        if not m or not entregar(m, assunto, texto):
            geral += itens  # sem canal: vai para o grupo / e-mail geral
    if geral:
        texto = montar_mensagem(geral)
        entregue = False
        if TG_TOKEN and TG_GRUPO:
            try:
                tg(TG_GRUPO, f"{assunto}\n\n{texto}")
                ENVIADOS["telegram"] += 1
                entregue = True
            except Exception as e:
                log(f"Telegram do grupo falhou: {e}")
        if ALERTA_EMAIL and GM_USER and GM_PASS:
            try:
                email(ALERTA_EMAIL, assunto, texto)
                ENVIADOS["email"] += 1
                entregue = True
            except Exception as e:
                log(f"E-mail geral falhou: {e}")
        if not entregue:
            for m in advogados:
                entregar(m, assunto + " (sem responsável definido)", texto)
        else:
            for m in advogados:  # o grupo recebeu o texto; os advogados recebem o aviso no celular
                enviar_push_membro(m, assunto, texto)
    log(f"Avisos enviados: {ENVIADOS}")
    push_disponivel()
    registrar_status(equipe)
    if (MODO != "tarde" and HOJE.weekday() == 0) or FORCAR_BACKUP:
        try:
            fazer_backup()
            if STATUS.get("ultimoBackup"):
                registrar_status(equipe)
        except Exception as e:
            log(f"Cópia de segurança falhou: {e}")


if __name__ == "__main__":
    main()
