"""Cópia dos arquivos dos clientes no Google Drive do escritório.

Cada cliente ganha uma pasta com o nome dele dentro de uma pasta principal
("<Escritório> – Clientes"). Dentro dela:
  • Documentos pessoais        (arquivos anexados no cadastro do cliente)
  • Enviados pelo cliente      (o que ele mandou pelo link de envio)
  • Processo <número>          (checklist do processo, procuração, contrato, peças)
  • Documentos do escritório   (procuração, contrato e recibos sem processo)

O robô só ACRESCENTA: nunca apaga nada no Drive. Se um arquivo for apagado no
sistema, a cópia continua no Drive. Usa a permissão "drive.file" do Google: o
robô só enxerga as pastas e arquivos que ele mesmo criou.

Secrets (GitHub › Settings › Secrets): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
GOOGLE_REFRESH_TOKEN. Sem eles a cópia fica desligada.
"""
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone, timedelta

G_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
G_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
G_REFRESH = os.environ.get("GOOGLE_REFRESH_TOKEN", "").strip()

PASTA = "application/vnd.google-apps.folder"
API = "https://www.googleapis.com/drive/v3"
UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
LIMITE_SIMPLES = 5 * 1024 * 1024
TZ = timezone(timedelta(hours=-3))


def configurado():
    return bool(G_ID and G_SECRET and G_REFRESH)


class ErroGoogle(RuntimeError):
    def __init__(self, codigo, msg):
        super().__init__(msg)
        self.codigo = codigo


class Drive:
    """Cliente mínimo da API do Google Drive v3 (só urllib)."""

    def __init__(self, client_id, secret, refresh, abrir=None):
        self.cid, self.secret, self.refresh = client_id, secret, refresh
        self.abrir = abrir or (lambda req, timeout: urllib.request.urlopen(req, timeout=timeout))
        self._token, self._expira = None, 0

    def _bruto(self, method, url, data=None, headers=None, timeout=120):
        req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
        try:
            with self.abrir(req, timeout) as r:
                return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers or {}), e.read()

    def token(self):
        if self._token and time.time() < self._expira - 60:
            return self._token
        corpo = urllib.parse.urlencode({"client_id": self.cid, "client_secret": self.secret,
                                        "refresh_token": self.refresh, "grant_type": "refresh_token"}).encode()
        st, _, b = self._bruto("POST", "https://oauth2.googleapis.com/token", corpo,
                               {"Content-Type": "application/x-www-form-urlencoded"}, 60)
        j = _json(b)
        if st != 200 or not j.get("access_token"):
            erro = j.get("error") or st
            if erro == "invalid_grant":
                raise ErroGoogle(st, "o Google recusou a autorização (GOOGLE_REFRESH_TOKEN vencido ou revogado). "
                                     "Gere outro no OAuth Playground e troque o Secret.")
            if erro == "invalid_client":
                raise ErroGoogle(st, "GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET errado.")
            raise ErroGoogle(st, f"não consegui entrar no Google ({erro}).")
        self._token, self._expira = j["access_token"], time.time() + int(j.get("expires_in") or 3000)
        return self._token

    def req(self, method, url, data=None, headers=None, timeout=120, json_body=None):
        if json_body is not None:
            data = json.dumps(json_body).encode()
            headers = {**(headers or {}), "Content-Type": "application/json; charset=UTF-8"}
        for t in range(4):
            h = {**(headers or {}), "Authorization": "Bearer " + self.token()}
            st, hd, b = self._bruto(method, url, data, h, timeout)
            if st == 401 and t == 0:
                self._token = None
                continue
            if st in (429, 500, 502, 503, 504) or (st == 403 and b"RateLimit" in b):
                time.sleep(2 ** t)
                continue
            if st >= 400:
                msg = (_json(b).get("error") or {})
                msg = msg.get("message") if isinstance(msg, dict) else msg
                raise ErroGoogle(st, f"Google Drive respondeu {st}: {msg or b[:200]!r}")
            return st, hd, b
        raise ErroGoogle(st, f"Google Drive indisponível ({st}).")

    def info(self, fid):
        try:
            _, _, b = self.req("GET", f"{API}/files/{fid}?fields=id,name,trashed")
            return _json(b)
        except ErroGoogle as e:
            if e.codigo == 404:
                return None
            raise

    def criar_pasta(self, nome, pai=None):
        meta = {"name": nome, "mimeType": PASTA}
        if pai:
            meta["parents"] = [pai]
        _, _, b = self.req("POST", f"{API}/files?fields=id", json_body=meta)
        return _json(b)["id"]

    def renomear(self, fid, nome):
        self.req("PATCH", f"{API}/files/{fid}?fields=id", json_body={"name": nome})

    def enviar(self, nome, pai, dados, mime, descricao=""):
        meta = {"name": nome, "parents": [pai]}
        if descricao:
            meta["description"] = descricao
        mime = mime or "application/octet-stream"
        if len(dados) <= LIMITE_SIMPLES:
            fr = "==sistema" + uuid.uuid4().hex
            corpo = (f"--{fr}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{json.dumps(meta)}\r\n"
                     f"--{fr}\r\nContent-Type: {mime}\r\n\r\n").encode() + dados + f"\r\n--{fr}--\r\n".encode()
            _, _, b = self.req("POST", f"{UPLOAD}?uploadType=multipart&fields=id", corpo,
                               {"Content-Type": f"multipart/related; boundary={fr}"}, timeout=300)
            return _json(b)["id"]
        _, hd, _ = self.req("POST", f"{UPLOAD}?uploadType=resumable&fields=id", json_body=meta,
                            headers={"X-Upload-Content-Type": mime, "X-Upload-Content-Length": str(len(dados))})
        local = hd.get("Location") or hd.get("location")
        if not local:
            raise ErroGoogle(0, "o Google não devolveu o endereço de envio.")
        _, _, b = self.req("PUT", local, dados, {"Content-Type": mime}, timeout=600)
        return _json(b)["id"]


def _json(b):
    try:
        return json.loads(b.decode("utf-8", "replace")) if b else {}
    except ValueError:
        return {}


# ---------------------------------------------------------------- nomes
def limpar_nome(s, maximo=120):
    s = re.sub(r"[\\/:*?\"<>|\r\n\t]+", " ", str(s or "")).strip()
    s = re.sub(r"\s+", " ", s).strip(" .")
    return s[:maximo].strip() or "Sem nome"


def _norm(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    return re.sub(r"\s+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn")).strip()


def rotulos_checklist(app_js):
    """Lê do app.js os nomes dos itens do checklist (['cnis','CNIS (extrato…)'])."""
    try:
        with open(app_js, encoding="utf-8") as f:
            txt = f.read()
    except OSError:
        return {}
    out = {}
    for k, v in re.findall(r"\['([a-z_0-9]+)','([^']{3,120})'\]", txt):
        out.setdefault(k, v)
    return out


ROTULOS_CAMPOS = {"docIdentidade": "RG e CPF (ou CNH)", "comprovante": "Comprovante de residência"}
TIPOS_DOC = {"procuracao": "Procuração", "contrato": "Contrato de honorários", "recibo": "Recibo",
             "peticao": "Petição", "declaracao": "Declaração"}


def chave_que_aponta(dados, caminho, rotulos):
    """Procura no cadastro qual campo guarda este arquivo e devolve um nome legível."""
    for k, v in (dados or {}).items():
        if isinstance(v, str) and v == caminho:
            return ROTULOS_CAMPOS.get(k) or rotulos.get(k) or k
        if isinstance(v, dict):
            for k2, v2 in v.items():
                if v2 == caminho or (isinstance(v2, dict) and caminho in [x for x in v2.values() if isinstance(x, str)]):
                    return rotulos.get(k2) or k2
    return ""


def data_do_arquivo(nome, criado_em=None):
    m = re.match(r"(\d{12,14})-", os.path.basename(nome or ""))
    if m:
        try:
            return datetime.fromtimestamp(int(m.group(1)) / 1000, TZ).strftime("%Y-%m-%d")
        except (ValueError, OSError):
            pass
    return str(criado_em or "")[:10] or datetime.now(TZ).strftime("%Y-%m-%d")


def extensao(nome):
    m = re.search(r"\.([A-Za-z0-9]{1,5})$", nome or "")
    return "." + m.group(1).lower() if m else ""


def nome_pasta_cliente(c, todos):
    base = limpar_nome(c.get("nome") or "Cliente sem nome", 100)
    iguais = [x for x in todos if _norm(x.get("nome")) == _norm(c.get("nome"))]
    if len(iguais) > 1:
        cpf = re.sub(r"\D", "", str(c.get("cpf") or ""))
        base += f" (CPF final {cpf[-4:]})" if len(cpf) >= 4 else f" ({c['id'][:4]})"
    return base


def nome_pasta_processo(p):
    num = str(p.get("numero") or "").strip()
    extra = p.get("acao") or p.get("tipoAcao") or p.get("beneficio") or p.get("area") or ""
    nome = f"Processo {num}" if num else "Processo sem número"
    if extra and not num:
        nome += f" – {extra}"
    return limpar_nome(nome, 110)


def destino(obj, ix, rotulos):
    """Para um arquivo do Storage, decide: cliente, subpasta e nome no Drive.

    obj: {bucket, caminho, criado_em}; ix: índices (clientes, processos, documentos, juri, envios).
    Devolve (cliente_id | None, (chave_subpasta, nome_subpasta) | None, nome_arquivo).
    """
    bucket, cam = obj["bucket"], obj["caminho"]
    data = data_do_arquivo(cam, obj.get("criado_em"))
    ext = extensao(cam)
    if bucket == "envios":
        e = ix["envios"].get(cam) or {}
        rot = limpar_nome(e.get("rotulo") or "Arquivo enviado", 70)
        orig = e.get("nome_original") or ""
        nome = f"{data} {rot}"
        if orig:
            nome += " – " + limpar_nome(re.sub(r"\.[A-Za-z0-9]{1,5}$", "", orig), 60)
        cid = e.get("cliente_id")
        return cid, (f"env:{cid}", "Enviados pelo cliente"), nome + (extensao(orig) or ext)
    partes = cam.split("/")
    col, rid = (partes[0], partes[1]) if len(partes) >= 3 else ("", "")
    if col == "clientes":
        c = ix["clientes"].get(rid) or {}
        rot = chave_que_aponta(c, cam, rotulos) or "Documento"
        return (rid if c else None), (f"pes:{rid}", "Documentos pessoais"), f"{data} {limpar_nome(rot, 80)}{ext}"
    if col == "documentos":
        d = ix["documentos"].get(rid) or {}
        tipo = TIPOS_DOC.get(d.get("tipo"), "")
        if d.get("assinado") == cam:
            rot = {"procuracao": "Procuração assinada", "contrato": "Contrato de honorários assinado",
                   "declaracao": "Declaração assinada"}.get(d.get("tipo"), f"{tipo or 'Documento'} – via assinada")
        elif d.get("nomeArquivo"):
            rot = re.sub(r"\.[A-Za-z0-9]{1,5}$", "", d["nomeArquivo"])
        else:
            rot = d.get("titulo") or tipo or "Documento"
        pid = d.get("processoId") or ""
        p = ix["processos"].get(pid)
        cid = d.get("clienteId") or (p or {}).get("clienteId")
        cid = cid if cid in ix["clientes"] else None
        sub = (f"proc:{pid}", nome_pasta_processo(p)) if p else ((f"esc:{cid}", "Documentos do escritório") if cid else None)
        return cid, sub, f"{data} {limpar_nome(rot, 90)}{ext}"
    if col in ("processos", "juri"):
        if col == "juri":
            j = ix["juri"].get(rid) or {}
            pid, rot = j.get("processoId") or "", "Júri – " + limpar_nome(j.get("titulo") or "prova", 60)
        else:
            pid, rot = rid, chave_que_aponta(ix["processos"].get(rid) or {}, cam, rotulos) or "Documento"
        p = ix["processos"].get(pid)
        if not p:
            return None, None, f"{data} {limpar_nome(rot, 90)}{ext}"
        cid = p.get("clienteId")
        return (cid if cid in ix["clientes"] else None), (f"proc:{pid}", nome_pasta_processo(p)), f"{data} {limpar_nome(rot, 90)}{ext}"
    return None, None, f"{data} {limpar_nome(os.path.basename(cam), 90)}"


# ---------------------------------------------------------------- sincronização
def sincronizar(sb, baixar, log, escritorio="Escritório", app_js="app.js", limite=150, segundos=420, drive=None):
    """Copia para o Drive os arquivos que ainda não foram copiados.

    sb(method, path, body=None, params=None, prefer=None) é o acesso ao banco do robô;
    baixar(bucket, caminho) devolve os bytes do arquivo no Storage.
    """
    st = {"ativo": True, "enviados": 0, "erros": 0, "pendentes": 0, "em": datetime.now(TZ).isoformat()}
    if drive is None:
        if not configurado():
            return {"ativo": False}
        drive = Drive(G_ID, G_SECRET, G_REFRESH)
    inicio = time.time()
    try:
        drive.token()
    except Exception as e:
        st["erro"] = str(e)
        log(f"Google Drive: {e}")
        return st

    try:
        pend = sb("POST", "rpc/drive_pendentes", {"p_limite": limite + 1}) or []
    except Exception as e:
        st["erro"] = "falta rodar banco/2-atualizacao.sql no Supabase (tabelas do Google Drive)." if "drive_pendentes" in str(e) else str(e)
        log(f"Google Drive: {st['erro']}")
        return st
    st["pendentes"] = int(pend[0].get("total") or len(pend)) if pend else 0
    pend = [x for x in pend if not str(x.get("caminho", "")).endswith(".emptyFolderPlaceholder")][:limite]

    def tabela(nome, campos="id,dados"):
        try:
            return sb("GET", nome, params={"select": campos, "limit": "10000"}) or []
        except Exception:
            return []
    lista_cli = [{**(r.get("dados") or {}), "id": r["id"]} for r in tabela("clientes")]
    ix = {"clientes": {c["id"]: c for c in lista_cli}}
    for t in ("processos", "documentos", "juri"):
        ix[t] = {r["id"]: {**(r.get("dados") or {}), "id": r["id"]} for r in tabela(t)}
    ix["envios"] = {r["caminho"]: r for r in tabela("envios_arquivos", "caminho,cliente_id,rotulo,nome_original")}
    pastas = {r["chave"]: r for r in tabela("drive_pastas", "chave,drive_id,nome")}
    conferidas = set()
    rotulos = rotulos_checklist(app_js)

    def guardar_pasta(chave, fid, nome):
        sb("POST", "drive_pastas", {"chave": chave, "drive_id": fid, "nome": nome, "atualizado_em": datetime.now(TZ).isoformat()},
           prefer="resolution=merge-duplicates,return=minimal")
        pastas[chave] = {"chave": chave, "drive_id": fid, "nome": nome}

    def pasta(chave, nome, pai):
        """Pasta guardada (renomeia se o nome mudou; recria se foi apagada) ou nova."""
        r = pastas.get(chave)
        if r and chave not in conferidas:
            i = drive.info(r["drive_id"])
            if not i or i.get("trashed"):
                r = None
        if r:
            if r.get("nome") != nome:
                drive.renomear(r["drive_id"], nome)
                guardar_pasta(chave, r["drive_id"], nome)
            conferidas.add(chave)
            return r["drive_id"]
        fid = drive.criar_pasta(nome, pai)
        guardar_pasta(chave, fid, nome)
        conferidas.add(chave)
        return fid

    try:
        raiz = pasta("raiz", limpar_nome(f"{escritorio} – Clientes"), None)
        st["pasta"] = raiz
        # clientes que mudaram de nome e processos que ganharam número: acerta o nome da pasta
        for chave, r in list(pastas.items()):
            if time.time() - inicio > segundos / 3:
                break
            tipo, _, rid = chave.partition(":")
            novo = None
            if tipo == "cli" and rid in ix["clientes"]:
                novo = nome_pasta_cliente(ix["clientes"][rid], lista_cli)
            elif tipo == "proc" and rid in ix["processos"]:
                novo = nome_pasta_processo(ix["processos"][rid])
            if novo and novo != r.get("nome"):
                try:
                    drive.renomear(r["drive_id"], novo)
                    guardar_pasta(chave, r["drive_id"], novo)
                except ErroGoogle as e:
                    if e.codigo != 404:
                        raise
    except Exception as e:
        st["erro"] = str(e)
        log(f"Google Drive: {e}")
        return st

    for obj in pend:
        if time.time() - inicio > segundos:
            log("Google Drive: tempo da rodada esgotado; o resto vai na próxima.")
            break
        chave_sync = f"{obj['bucket']}:{obj['caminho']}"
        try:
            cid, sub, nome = destino(obj, ix, rotulos)
            if cid:
                pai = pasta(f"cli:{cid}", nome_pasta_cliente(ix["clientes"][cid], lista_cli), raiz)
            else:
                pai = pasta("semcliente", "Sem cliente identificado", raiz)
            if sub:
                pai = pasta(sub[0] if cid else sub[0] + ":sem", sub[1], pai)
            dados = baixar(obj["bucket"], obj["caminho"])
            fid = drive.enviar(nome, pai, dados, obj.get("tipo"), f"Cópia automática do sistema ({obj['bucket']}/{obj['caminho']}).")
            sb("POST", "drive_sync", {"caminho": chave_sync, "drive_id": fid, "pasta_id": pai, "cliente_id": cid,
                                      "nome": nome, "enviado_em": datetime.now(TZ).isoformat(), "erro": None, "tentativas": 0},
               prefer="resolution=merge-duplicates,return=minimal")
            st["enviados"] += 1
        except Exception as e:
            st["erros"] += 1
            msg = str(e)[:300]
            log(f"Google Drive: não copiei {chave_sync}: {msg}")
            try:
                sb("POST", "rpc/drive_falhou", {"p_caminho": chave_sync, "p_erro": msg})
            except Exception:
                pass
            if isinstance(e, ErroGoogle) and e.codigo in (401, 403):  # sem permissão ou Drive cheio: para a rodada
                st["erro"] = msg
                break
    st["pendentes"] = max(0, st["pendentes"] - st["enviados"])
    log(f"Google Drive: {st['enviados']} arquivo(s) copiado(s), {st['erros']} com erro"
        f"{', ainda faltam ' + str(st['pendentes']) if st['pendentes'] else ''}.")
    return st
