"""Leitura do texto das intimações para lançar sozinho audiências e prazos.

Tudo o que sai daqui entra no sistema marcado como "lançado automaticamente —
conferir": o robô adianta o cadastro, mas uma pessoa sempre confere.
Funções puras (sem banco), para poderem ser testadas: python robo/teste_automatico.py
"""
import re
import unicodedata
from datetime import date

MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
NUM_EXT = {"um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6, "sete": 7, "oito": 8,
           "nove": 9, "dez": 10, "onze": 11, "doze": 12, "quinze": 15, "vinte": 20, "trinta": 30, "quarenta": 40,
           "sessenta": 60, "noventa": 90}


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn")


def limpo(s):
    """Minúsculo, sem acento e com espaços simples (os índices batem com o texto original sem acento)."""
    return re.sub(r"\s+", " ", sem_acento(s).lower())


# ---------------------------------------------------------------- área e justiça
def area_de(intimacao, processo=None):
    if processo and processo.get("area"):
        return processo["area"]
    s = limpo(" ".join(str(intimacao.get(k) or "") for k in ("tribunal", "orgao", "classe", "tipo_documento")))
    trib = str(intimacao.get("tribunal") or "").upper()
    if re.search(r"crim|penal|juri|custodia|inquerito|flagrante|habeas", s):
        return "Criminal"
    if re.search(r"trabalh|\btrt\b", s) or trib.startswith("TRT"):
        return "Trabalhista"
    if re.search(r"previd|inss|benef|juizado especial federal|\bjef\b|aposentad|auxilio|loas|bpc", s) or trib.startswith("TRF"):
        return "Previdenciário"
    return "Cível"


def justica_de(tribunal):
    t = str(tribunal or "").upper()
    return "federal" if t.startswith("TRF") else "trabalho" if t.startswith("TRT") else "estadual"


def eh_juizado(intimacao):
    return bool(re.search(r"juizado|\bjef\b|\bjec\b|turma recursal", limpo(f"{intimacao.get('orgao')} {intimacao.get('classe')}")))


# ---------------------------------------------------------------- prazo pelo texto
def dias_no_texto(t):
    """Mesmas regras do botão "Lançar prazo" (extras.js › sugerirDias)."""
    t = sem_acento(t)
    m = re.search(r"(?:prazo(?:\s+(?:legal|comum|sucessivo|improrrogavel))?\s+de|no\s+prazo\s+de|dentro\s+de|pelo\s+prazo\s+de|\bem)\s+"
                  r"(\d{1,3})\s*(?:\([^)]{2,40}\))?\s*\(?dias?\)?(\s+uteis|\s+corridos)?", t, re.I)
    if m and 0 < int(m.group(1)) <= 365:
        return int(m.group(1)), m.group(0).strip()[:80]
    m = re.search(r"(\d{1,3})\s*\([a-z\s]{3,30}\)\s*dias", t, re.I)
    if m and 0 < int(m.group(1)) <= 365:
        return int(m.group(1)), m.group(0).strip()[:80]
    m = re.search(r"prazo\s+de\s+(" + "|".join(NUM_EXT) + r")\s+dias", t, re.I)
    if m:
        return NUM_EXT[m.group(1).lower()], m.group(0).strip()
    return None, ""


def classificar_prazo(intimacao, processo=None):
    """Devolve o prazo a lançar ou None. Só lança o que dá para reconhecer com segurança."""
    texto = str(intimacao.get("texto") or "")
    t = limpo(texto)
    tipo_doc = limpo(intimacao.get("tipo_documento"))
    area = area_de(intimacao, processo)
    crim, trab, jui = area == "Criminal", area == "Trabalhista", eh_juizado(intimacao)
    dias_txt, trecho = dias_no_texto(texto)
    corr = "corridos" if crim else "uteis"
    regra = None

    sentenca = "sentenc" in tipo_doc or bool(re.search(r"\bjulgo (im)?procedente|julgo parcialmente procedente|ante o exposto,? julgo|extingo o processo", t))
    if sentenca and "sentenc" in tipo_doc:
        regra = None  # resolvido abaixo: numa sentença, "contrarrazões" ou "alegações" no texto são só menções
    elif re.search(r"resposta (escrita )?a acusacao|responder a acusacao|art(igo)?\.? ?396", t):
        regra = ("Resposta à acusação", 10, "corridos", "CPP, art. 396")
    elif (re.search(r"contestacao|contestar|apresentar defesa|oferecer defesa|apresentar resposta", t)
          and re.search(r"citacao|cite-se|citad[oa]|fica citad|para,? querendo,? contestar", t)
          and not trab and not jui
          and not re.search(r"cite-se o (inss|instituto|reu inss)|citacao do inss|cite-se a (uniao|autarquia|fazenda)", t)):
        regra = ("Contestação", 15, "uteis", "CPC, art. 335")
    elif re.search(r"\breplica\b|impugnacao a contestacao|manifest[\w-]+ (sobre|acerca d\w)\s+(a )?contestacao", t):
        regra = ("Réplica (manifestação sobre a contestação)", 15, "uteis", "CPC, arts. 350 e 351")
    elif re.search(r"alegacoes finais|memoriais", t):
        regra = ("Alegações finais / memoriais", 5, "corridos", "CPP, art. 403") if crim else ("Alegações finais / memoriais", 15, "uteis", "CPC, art. 364")
    elif re.search(r"contrarrazoes|contra-razoes", t):
        regra = (("Contrarrazões", 8, "corridos", "CPP, art. 600") if crim else ("Contrarrazões", 8, "uteis", "CLT, art. 900") if trab
                 else ("Contrarrazões", 10, "uteis", "Lei 9.099/95, art. 42") if jui else ("Contrarrazões", 15, "uteis", "CPC, art. 1.010"))
    if regra is None and sentenca:
        regra = (("Avaliar recurso contra a sentença (apelação)", 5, "corridos", "CPP, art. 593") if crim
                 else ("Avaliar recurso contra a sentença (recurso ordinário)", 8, "uteis", "CLT, art. 895") if trab
                 else ("Avaliar recurso contra a sentença (recurso inominado)", 10, "uteis", "Lei 9.099/95, art. 42") if jui
                 else ("Avaliar recurso contra a sentença (apelação)", 15, "uteis", "CPC, art. 1.003"))

    if regra:
        desc, dias, cont, base = regra
        if dias_txt:  # o prazo escrito na intimação vale mais que o da lei
            return {"descricao": desc, "dias": dias_txt, "contagem": cont, "base": f"prazo escrito na intimação (“{trecho}”)"}
        return {"descricao": desc, "dias": dias, "contagem": cont, "base": f"prazo da lei ({base})"}
    if dias_txt and re.search(r"manifest|intime-se|intimad[oa]|junt(e|ar)|apresent(e|ar)|comprov(e|ar)|emend(e|ar)|cumpr(a|ir)|especific(ar|em)", t):
        desc = "Emenda à inicial" if re.search(r"emend(e|ar|a) a (petição )?inicial|emenda a inicial", t) else \
               "Especificar provas" if re.search(r"especific\w+ (as )?provas", t) else "Manifestação"
        return {"descricao": desc, "dias": dias_txt, "contagem": corr, "base": f"prazo escrito na intimação (“{trecho}”)"}
    return None


# ---------------------------------------------------------------- audiências e perícias
_DATA_NUM = r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})"
_DATA_EXT = r"(\d{1,2})o? de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de (\d{4})"
_GATILHOS = [
    ("Plenário do Júri", r"plenario|sessao (de julgamento )?do (tribunal do )?juri"),
    ("Perícia judicial", r"pericia"),
    ("Audiência", r"audiencia"),
]


def _data_de(m, ext):
    try:
        if ext:
            return date(int(m.group(3)), MESES.index(m.group(2)) + 1, int(m.group(1)))
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except (ValueError, IndexError):
        return None


def extrair_compromisso(texto, hoje=None):
    """Acha a audiência (ou perícia, ou plenário) marcada no texto. Devolve None se não houver data futura."""
    hoje = hoje or date.today()
    t = limpo(texto)
    melhor = None
    for tipo, chave in _GATILHOS:
        for k in re.finditer(chave, t):
            for padrao, ext in ((_DATA_NUM, False), (_DATA_EXT, True)):
                m = re.compile(padrao).search(t, k.end(), k.end() + 260)
                if not m:
                    continue
                d = _data_de(m, ext)
                if not d or d < hoje or d.year > hoje.year + 3:
                    continue
                dist = m.start() - k.end()
                if melhor is None or dist < melhor[0]:
                    melhor = (dist, tipo, d, m.end(), k.start())
    if not melhor:
        return None
    _, tipo, d, fim, ini = melhor
    if tipo == "Perícia judicial" and re.search(r"\binss\b|administrativ", t[max(0, ini - 120):fim + 120]):
        tipo = "Perícia administrativa (INSS)"
    depois = t[fim:fim + 50]
    hm = re.search(r"(?:as|a partir das|,|-|\s)\s*(\d{1,2})\s*(?:h|:)\s*(\d{2})?\s*(?:h|min|horas)?", depois)
    hora = ""
    if hm and 0 <= int(hm.group(1)) <= 23:
        hora = f"{int(hm.group(1)):02d}:{int(hm.group(2) or 0):02d}"
    janela = t[max(0, ini - 200):fim + 700]
    virtual = bool(re.search(r"virtual|telepresencial|videoconferencia|zoom|teams|google meet|webex|por video", janela))
    presencial = bool(re.search(r"(?<!tele)presencial|sala de audiencias? (da|desta|do)|comparecer (pessoalmente|a sede|ao forum)", janela))
    modalidade = ("Semipresencial (híbrida)" if virtual and presencial else "Telepresencial (virtual)" if virtual
                  else "Presencial" if presencial else "")
    link = ""
    urls = re.findall(r"https?://[^\s<>\"')\]]+", str(texto or ""))
    urls = [u.rstrip(".,;:") for u in urls]
    pref = [u for u in urls if re.search(r"zoom\.us|teams\.microsoft|teams\.live|meet\.google|webex|jitsi|balcao|salavirtual|sala-virtual|videoconf|audienciavirtual", u, re.I)
            and not re.search(r"consulta|visualizacao|/pje", u, re.I)]
    if pref:
        link = pref[0]
    info = []
    orig = re.sub(r"\s+", " ", sem_acento(texto))  # mantém maiúsculas (a senha da sala diferencia)
    mi = re.search(r"id da reuni[aã]o:?\s*([\d ]{9,15}\d)", orig, re.I)
    if mi:
        info.append("ID da reunião: " + mi.group(1).strip())
    ms = re.search(r"senha(?: de acesso)?:?\s*([A-Za-z0-9]{3,20})", orig, re.I)
    if ms and mi:
        info.append("Senha: " + ms.group(1))
    if not link and "teams" in janela:
        info.append("Link da sala do Microsoft Teams no texto da intimação")
    return {"tipo": tipo, "data": d.isoformat(), "hora": hora, "modalidade": modalidade, "link": link, "linkInfo": " · ".join(info)}
