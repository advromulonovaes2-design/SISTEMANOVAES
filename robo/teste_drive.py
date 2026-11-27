"""Testes da cópia no Google Drive (robo/drive.py) com um Google e um banco de mentira.
Rode: python robo/teste_drive.py  (também roda dentro de node testes/calculos.js)"""
import io
import json
import os
import sys
import urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drive as D  # noqa: E402

FALHAS = []


def confere(cond, msg):
    print(("OK  " if cond else "ERRO ") + msg)
    if not cond:
        FALHAS.append(msg)


class Resp(io.BytesIO):
    def __init__(self, status, corpo, headers=None):
        super().__init__(json.dumps(corpo).encode() if not isinstance(corpo, bytes) else corpo)
        self.status, self.headers = status, headers or {}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class GoogleFalso:
    def __init__(self):
        self.arquivos, self.n, self.chamadas, self.token_ok = {}, 0, [], True

    def novo(self, meta):
        self.n += 1
        fid = f"g{self.n}"
        self.arquivos[fid] = {**meta, "id": fid, "trashed": False}
        return fid

    def __call__(self, req, timeout):
        url, m = req.full_url, req.get_method()
        self.chamadas.append((m, url.split("?")[0]))
        if "oauth2" in url:
            if not self.token_ok:
                raise urllib.error.HTTPError(url, 400, "x", {}, io.BytesIO(b'{"error":"invalid_grant"}'))
            return Resp(200, {"access_token": "tk", "expires_in": 3600})
        assert req.headers.get("Authorization") == "Bearer tk", "sem token"
        if "uploadType=multipart" in url:
            corpo = req.data.decode("latin-1")
            meta = json.loads(corpo.split("\r\n\r\n", 1)[1].split("\r\n", 1)[0])
            return Resp(200, {"id": self.novo({**meta, "tamanho": len(req.data), "modo": "multipart"})})
        if "uploadType=resumable" in url:
            meta = json.loads(req.data)
            self.pendente = meta
            return Resp(200, b"", {"Location": "https://upload.falso/sessao1"})
        if url.startswith("https://upload.falso/"):
            return Resp(200, {"id": self.novo({**self.pendente, "tamanho": len(req.data), "modo": "resumable"})})
        fid = url.split("/files/")[1].split("?")[0] if "/files/" in url else ""
        if m == "POST":
            return Resp(200, {"id": self.novo(json.loads(req.data))})
        if m == "GET":
            if fid not in self.arquivos:
                raise urllib.error.HTTPError(url, 404, "x", {}, io.BytesIO(b'{"error":{"message":"File not found"}}'))
            return Resp(200, self.arquivos[fid])
        if m == "PATCH":
            self.arquivos[fid].update(json.loads(req.data))
            return Resp(200, {"id": fid})
        raise AssertionError(f"chamada inesperada {m} {url}")


class BancoFalso:
    def __init__(self, tabelas, objetos):
        self.t, self.objetos = tabelas, objetos
        self.t.setdefault("drive_pastas", [])
        self.t.setdefault("drive_sync", [])

    def __call__(self, method, path, body=None, params=None, prefer=None):
        if path == "rpc/drive_pendentes":
            feitos = {s["caminho"] for s in self.t["drive_sync"] if s.get("drive_id") or s.get("tentativas", 0) >= 3}
            fila = [o for o in self.objetos if f"{o['bucket']}:{o['caminho']}" not in feitos]
            return [{**o, "total": len(fila)} for o in fila[:body["p_limite"]]]
        if path == "rpc/drive_falhou":
            r = next((s for s in self.t["drive_sync"] if s["caminho"] == body["p_caminho"]), None)
            if not r:
                self.t["drive_sync"].append({"caminho": body["p_caminho"], "tentativas": 1, "erro": body["p_erro"]})
            elif not r.get("drive_id"):
                r["tentativas"] += 1
            return None
        if method == "GET":
            return self.t.get(path, [])
        if method == "POST":
            chave = "chave" if path == "drive_pastas" else "caminho"
            lista = self.t[path]
            lista[:] = [x for x in lista if x[chave] != body[chave]] + [body]
            return None
        raise AssertionError(path)


def montar():
    cli = [{"id": "c1", "dados": {"nome": "Maria da Silva", "cpf": "111.222.333-44",
                                  "docIdentidade": "clientes/c1/1795043735535-aaaaa.pdf",
                                  "checklist": {"cnis": {"ok": True, "arquivo": "clientes/c1/1795043790638-bbbbb.pdf"}}}},
           {"id": "c2", "dados": {"nome": "José Souza", "cpf": "999.888.777-66"}},
           {"id": "c3", "dados": {"nome": "José  Souza"}}]
    procs = [{"id": "p1", "dados": {"numero": "0801234-56.2026.8.14.0301", "clienteId": "c1",
                                    "checklist": {"ctps": {"ok": True, "arquivo": "processos/p1/1795043800000-ccccc.pdf"}}}}]
    docs = [{"id": "d1", "dados": {"tipo": "procuracao", "clienteId": "c1", "processoId": "p1", "nomeArquivo": "procuracao-maria.pdf",
                                   "arquivo": "documentos/d1/1795044000000-ddddd.pdf", "assinado": "documentos/d1/1795045000000-eeeee.pdf"}},
            {"id": "d2", "dados": {"tipo": "recibo", "clienteId": "c2", "nomeArquivo": "recibo-jose.pdf"}}]
    env = [{"caminho": "tok1/1795046000000-fffff.jpg", "cliente_id": "c2", "rotulo": "RG (frente)", "nome_original": "IMG_2031.JPG"}]
    obj = [{"bucket": "arquivos", "caminho": "clientes/c1/1795043735535-aaaaa.pdf", "tipo": "application/pdf"},
           {"bucket": "arquivos", "caminho": "clientes/c1/1795043790638-bbbbb.pdf", "tipo": "application/pdf"},
           {"bucket": "arquivos", "caminho": "processos/p1/1795043800000-ccccc.pdf", "tipo": "application/pdf"},
           {"bucket": "arquivos", "caminho": "documentos/d1/1795044000000-ddddd.pdf", "tipo": "application/pdf"},
           {"bucket": "arquivos", "caminho": "documentos/d1/1795045000000-eeeee.pdf", "tipo": "application/pdf"},
           {"bucket": "arquivos", "caminho": "documentos/d2/1795044100000-ggggg.pdf", "tipo": "application/pdf"},
           {"bucket": "envios", "caminho": "tok1/1795046000000-fffff.jpg", "tipo": "image/jpeg"},
           {"bucket": "arquivos", "caminho": "documentos/sumiu/1795044200000-hhhhh.pdf", "tipo": "application/pdf"},
           {"bucket": "arquivos", "caminho": "clientes/c3/1795044300000-iiiii.jpeg", "tipo": "image/jpeg"}]
    return BancoFalso({"clientes": cli, "processos": procs, "documentos": docs, "juri": [], "envios_arquivos": env}, obj)


def caminho_no_drive(g, fid):
    partes, a = [], g.arquivos[fid]
    while True:
        partes.append(a["name"])
        pais = a.get("parents") or []
        if not pais:
            return " / ".join(reversed(partes))
        a = g.arquivos[pais[0]]


def main():
    app_js = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app.js")
    rot = D.rotulos_checklist(app_js)
    confere(rot.get("cnis", "").startswith("CNIS") and rot.get("procuracao") == "Procuração assinada", "lê os nomes do checklist no app.js")

    g, banco = GoogleFalso(), montar()
    grandes = {"documentos/d2/1795044100000-ggggg.pdf"}
    baixar = lambda b, c: (b"%PDF" + b"x" * (6 * 1024 * 1024)) if c in grandes else b"conteudo"
    dv = D.Drive("id", "seg", "ref", abrir=g)
    logs = []
    st = D.sincronizar(banco, baixar, logs.append, "Palha Novaes Advocacia", app_js, drive=dv)
    confere(st["enviados"] == 9 and st["erros"] == 0 and st["pendentes"] == 0, f"copia os 9 arquivos ({st})")
    nomes = sorted(caminho_no_drive(g, s["drive_id"]) for s in banco.t["drive_sync"])
    esperado = [
        "Palha Novaes Advocacia – Clientes / José Souza (CPF final 7766) / Documentos do escritório / 2026-11-18 recibo-jose.pdf",
        "Palha Novaes Advocacia – Clientes / José Souza (CPF final 7766) / Enviados pelo cliente / 2026-11-18 RG (frente) – IMG_2031.jpg",
        "Palha Novaes Advocacia – Clientes / José Souza (c3) / Documentos pessoais / 2026-11-18 Documento.jpeg",
        "Palha Novaes Advocacia – Clientes / Maria da Silva / Documentos pessoais / 2026-11-18 CNIS (extrato previdenciário).pdf",
        "Palha Novaes Advocacia – Clientes / Maria da Silva / Documentos pessoais / 2026-11-18 RG e CPF (ou CNH).pdf",
        "Palha Novaes Advocacia – Clientes / Maria da Silva / Processo 0801234-56.2026.8.14.0301 / 2026-11-18 Carteiras de trabalho (todas as páginas).pdf",
        "Palha Novaes Advocacia – Clientes / Maria da Silva / Processo 0801234-56.2026.8.14.0301 / 2026-11-18 Procuração assinada.pdf",
        "Palha Novaes Advocacia – Clientes / Maria da Silva / Processo 0801234-56.2026.8.14.0301 / 2026-11-18 procuracao-maria.pdf",
        "Palha Novaes Advocacia – Clientes / Sem cliente identificado / 2026-11-18 Documento.pdf",
    ]
    if nomes != esperado:
        print("\n".join(nomes))
    confere(nomes == esperado, "pastas por cliente, subpastas e nomes legíveis")
    modos = {g.arquivos[s["drive_id"]]["modo"] for s in banco.t["drive_sync"]}
    confere(modos == {"multipart", "resumable"}, "arquivo pequeno vai direto; arquivo de mais de 5 MB vai em partes")
    confere(len([x for x in g.arquivos.values() if x.get("mimeType") == D.PASTA and x["name"] == "Maria da Silva"]) == 1,
            "não cria a mesma pasta duas vezes")

    # segunda rodada: nada novo para copiar
    n = len(g.arquivos)
    st = D.sincronizar(banco, baixar, logs.append, "Palha Novaes Advocacia", app_js, drive=dv)
    confere(st["enviados"] == 0 and len(g.arquivos) == n, "segunda rodada não copia de novo")

    # cliente mudou de nome e alguém apagou a pasta do processo no Drive
    banco.t["clientes"][0]["dados"]["nome"] = "Maria da Silva Santos"
    pid = next(r["drive_id"] for r in banco.t["drive_pastas"] if r["chave"] == "proc:p1")
    g.arquivos[pid]["trashed"] = True
    banco.objetos.append({"bucket": "arquivos", "caminho": "processos/p1/1795050000000-jjjjj.pdf", "tipo": "application/pdf"})
    st = D.sincronizar(banco, baixar, logs.append, "Palha Novaes Advocacia", app_js, drive=dv)
    cli = next(r["drive_id"] for r in banco.t["drive_pastas"] if r["chave"] == "cli:c1")
    novo_pid = next(r["drive_id"] for r in banco.t["drive_pastas"] if r["chave"] == "proc:p1")
    confere(g.arquivos[cli]["name"] == "Maria da Silva Santos", "renomeia a pasta quando o nome do cliente muda")
    confere(st["enviados"] == 1 and novo_pid != pid and g.arquivos[novo_pid]["parents"] == [cli], "recria a pasta apagada no Drive")

    # arquivo que não baixa: marca a falha e segue
    banco.objetos.append({"bucket": "arquivos", "caminho": "clientes/c2/1795060000000-kkkkk.pdf", "tipo": "application/pdf"})

    def baixar_ruim(b, c):
        raise RuntimeError("HTTP 404 no Storage")
    for _ in range(3):
        st = D.sincronizar(banco, baixar_ruim, logs.append, "Palha Novaes Advocacia", app_js, drive=dv)
    st = D.sincronizar(banco, baixar_ruim, logs.append, "Palha Novaes Advocacia", app_js, drive=dv)
    confere(st["erros"] == 0 and st["pendentes"] == 0, "depois de 3 falhas o arquivo sai da fila")

    # autorização vencida
    g2 = GoogleFalso()
    g2.token_ok = False
    st = D.sincronizar(montar(), baixar, logs.append, "X", app_js, drive=D.Drive("id", "seg", "ref", abrir=g2))
    confere("GOOGLE_REFRESH_TOKEN" in st.get("erro", "") and st["enviados"] == 0, "explica quando o Google recusa a autorização")

    confere(D.limpar_nome('a/b:c*?"<>|d') == "a b c d", "tira do nome os caracteres proibidos")
    if FALHAS:
        print(f"\n{len(FALHAS)} teste(s) do Google Drive falharam.")
        sys.exit(1)
    print("Cópia no Google Drive: tudo confere.")


if __name__ == "__main__":
    main()
