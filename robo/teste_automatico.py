"""Testes da leitura automática de audiências e prazos. Roda com: python robo/teste_automatico.py"""
import sys, os
from datetime import date
sys.path.insert(0, os.path.dirname(__file__))
from automatico import classificar_prazo, extrair_compromisso, dias_no_texto

HOJE = date(2026, 11, 11)
falhas = 0


def confere(nome, obtido, esperado):
    global falhas
    ok = obtido == esperado
    print(("OK  " if ok else "ERRO") + " " + nome + ("" if ok else f" — esperado {esperado!r}, veio {obtido!r}"))
    falhas += 0 if ok else 1


TRT = ("INTIMAÇÃO - DJEN Destinatário(a): EMPRESA LTDA AUDIÊNCIA INAUGURAL DE CONCILIAÇÃO, DE FORMA VIRTUAL , a ser realizada pelo "
       "CEJUSC JT BELÉM. Fica a parte indicada intimada para comparecer à AUDIÊNCIA INAUGURAL DE CONCILIAÇÃO, que será realizada no dia "
       "25/11/2026 11:00 horas, de forma telepresencial. A audiência será realizada através do link "
       "https://trt8-jus-br.zoom.us/j/83816473998?pwd=AbC123 ID da reunião: 838 1647 3998 Senha de acesso: Xy7Pq2")
c = extrair_compromisso(TRT, HOJE)
confere("TRT: data", c["data"], "2026-11-25")
confere("TRT: hora", c["hora"], "11:00")
confere("TRT: virtual", c["modalidade"], "Telepresencial (virtual)")
confere("TRT: link zoom", c["link"], "https://trt8-jus-br.zoom.us/j/83816473998?pwd=AbC123")
confere("TRT: senha com maiúsculas", c["linkInfo"], "ID da reunião: 838 1647 3998 · Senha: Xy7Pq2")

JEC = ("CERTIDÃO E INTIMAÇÃO Certifico que designei a Audiência Una de Conciliação, Instrução e Julgamento para o dia 17/06/2027 09:00 horas, "
       "que se realizará PRESENCIALMENTE nesta 7ª Vara do Juizado Especial Cível de Belém, bem como VIRTUALMENTE pela Plataforma de "
       "Comunicação Microsoft Teams, por meio do link abaixo: Link para Sala de Audiência Virtual: Ingresso na Reunião | Microsoft Teams")
c = extrair_compromisso(JEC, HOJE)
confere("JEC: data", c["data"], "2027-06-17")
confere("JEC: hora", c["hora"], "09:00")
confere("JEC: híbrida", c["modalidade"], "Semipresencial (híbrida)")
confere("JEC: sem URL, avisa do Teams", c["linkInfo"], "Link da sala do Microsoft Teams no texto da intimação")

c = extrair_compromisso("Designo perícia médica para o dia 3 de dezembro de 2026, às 8h30, no consultório do perito.", HOJE)
confere("perícia por extenso", (c["tipo"], c["data"], c["hora"]), ("Perícia judicial", "2026-12-03", "08:30"))
confere("audiência no passado não entra", extrair_compromisso("Realizada a audiência em 10/03/2025 às 10h.", HOJE), None)
confere("sem audiência", extrair_compromisso("Intime-se a parte autora para juntar documentos.", HOJE), None)

civ = {"tribunal": "TJPA", "orgao": "3ª Vara Cível de Belém", "tipo_documento": "Despacho"}
p = classificar_prazo({**civ, "texto": "Cite-se a parte ré para, querendo, contestar no prazo legal."})
confere("contestação cível: 15 úteis", (p["descricao"], p["dias"], p["contagem"]), ("Contestação", 15, "uteis"))
confere("contestação no JEC não lança (é na audiência)",
        classificar_prazo({**civ, "orgao": "7ª Vara do Juizado Especial Cível", "texto": "Cite-se o réu para apresentar contestação."}), None)
confere("contestação do INSS não é nossa",
        classificar_prazo({"tribunal": "TRF1", "orgao": "Vara Federal", "texto": "Cite-se o INSS para contestar."}), None)
p = classificar_prazo({"tribunal": "TJPA", "orgao": "Vara Criminal", "texto": "Cite-se o acusado para apresentar resposta à acusação, nos termos do art. 396 do CPP."})
confere("resposta à acusação: 10 corridos", (p["descricao"], p["dias"], p["contagem"]), ("Resposta à acusação", 10, "corridos"))
p = classificar_prazo({**civ, "texto": "Intime-se a parte autora para, no prazo de 5 (cinco) dias, manifestar-se sobre a contestação."})
confere("réplica com prazo escrito: 5", (p["descricao"], p["dias"]), ("Réplica (manifestação sobre a contestação)", 5))
p = classificar_prazo({**civ, "texto": "Intime-se a parte autora para emendar a inicial no prazo de 15 (quinze) dias."})
confere("emenda à inicial", (p["descricao"], p["dias"]), ("Emenda à inicial", 15))
p = classificar_prazo({"tribunal": "TRT8", "orgao": "7ª Vara do Trabalho", "tipo_documento": "Sentença", "texto": "Ante o exposto, julgo procedentes os pedidos."})
confere("sentença trabalhista: RO 8 úteis", (p["dias"], p["contagem"]), (8, "uteis"))
confere("ato sem prazo não lança", classificar_prazo({**civ, "texto": "Junte-se. Aguarde-se o retorno do AR."}), None)
confere("dias por extenso", dias_no_texto("no prazo de quinze dias")[0], 15)

print("\nTODOS OS TESTES DA LEITURA AUTOMÁTICA PASSARAM" if not falhas else f"\n{falhas} TESTE(S) FALHARAM")
sys.exit(1 if falhas else 0)
