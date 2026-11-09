# Passo a passo: colocar o sistema da Palha Novaes Advocacia no ar (grátis)

Você vai precisar de um computador para a instalação. Depois, tudo funciona no celular.
Tempo estimado: 1 a 2 horas, uma vez só. Custo: zero (planos gratuitos do Supabase, GitHub, Telegram e Gmail).

**O que tem na pasta**

| Arquivo | Para que serve |
|---|---|
| `index.html`, `estilo.css` e todos os arquivos `.js` da pasta principal | O sistema (site e app) |
| `lib/pdf-lib.min.js` | Gera os PDFs (procuração, contrato, recibo, petição). **Suba a pasta `lib` inteira** |
| `enviar.html` | Página que o cliente abre pelo link para mandar fotos dos documentos |
| `config.js` | Onde você cola as 2 chaves públicas do banco |
| `manifest.webmanifest`, `sw.js`, `icone-192.png`, `icone-512.png` | Deixam instalar no celular como app (ícone PN dourado) |
| `logo-documento.png`, `marca.png` | Logo Palha Novaes usada na procuração, no contrato e no sistema |
| `banco/1-criar-tabelas.sql` | Cria o banco de dados com segurança |
| `banco/2-atualizacao.sql` | Para quem já instalou uma versão anterior: atualiza o banco sem apagar nada |
| `robo/robo.py` | O robô do DJEN, da DataJud e dos avisos |
| `.github/workflows/robo.yml` | Agenda o robô de segunda a sexta, às 7h e às 16h |
| `VERSOES.md` | O que mudou em cada versão |

---

## 1. Criar o banco de dados (Supabase)

1. Entre em **supabase.com** → **Start your project** → entre com uma conta do GitHub ou e-mail.
2. **New project**. Dê um nome (ex.: `escritorio`), crie uma senha forte para o banco (guarde) e escolha a região **South America (São Paulo)**.
3. Espere o projeto ficar pronto (1 a 2 minutos).
4. Abra o arquivo `banco/1-criar-tabelas.sql` no Bloco de Notas. Lá no final, troque `SEU-EMAIL-AQUI@gmail.com` pelo **seu e-mail**.
5. No Supabase: menu lateral **SQL Editor** → **New query** → cole todo o conteúdo do arquivo → **Run**. Deve aparecer "Success".
6. Pegue as chaves em **Project Settings → API Keys** (e a URL em **Project Settings → Data API**, ou no botão **Connect**). Anote:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **Chave pública**: *Publishable key* (`sb_publishable_...`) ou, na aba *Legacy*, a *anon key* (`eyJ...`)
   - **Chave secreta**: *Secret key* (`sb_secret_...`) ou, na aba *Legacy*, a *service_role key*

7. Ainda no Supabase, abra **Authentication** e procure **Multi-Factor** (em alguns painéis fica em *Sign In / Providers*). Confira que **TOTP (App Authenticator)** está ligado. Ele já vem ligado nos projetos novos; é ele que permite o código do celular no login.

> A chave **secreta** dá acesso total ao banco. Ela só vai nos "Secrets" do GitHub (passo 9). Nunca no `config.js`, nunca no WhatsApp.

## 2. Colar as chaves públicas no sistema

Abra `config.js` no Bloco de Notas e troque os dois textos `COLE-AQUI...` pela **Project URL** e pela **chave pública**. Salve.

## 3. Subir o sistema para o GitHub

1. Crie uma conta em **github.com** (se ainda não tiver).
2. Canto superior direito **+ → New repository**. Nome: `escritorio`. Marque **Public** (o site grátis exige). Clique **Create repository**.
   > Público é só o código. Os dados dos clientes ficam no Supabase, protegidos por senha e liberação de e-mail.
3. Na página do repositório: **uploading an existing file** (ou **Add file → Upload files**). Arraste **todos os arquivos (inclusive as imagens `.png` e o `enviar.html`) e as pastas `lib`, `banco` e `robo`**. Clique **Commit changes**.
4. A pasta `.github` costuma ficar oculta no computador. Crie o arquivo dela à mão:
   **Add file → Create new file** → no nome, digite exatamente `.github/workflows/robo.yml` → abra o `robo.yml` da pasta no Bloco de Notas, copie tudo e cole → **Commit changes**.

## 4. Publicar o site

1. No repositório: **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**. Branch **main**, pasta **/(root)** → **Save**.
3. Em 1 a 3 minutos aparece o endereço: `https://SEU-USUARIO.github.io/escritorio/`. Esse é o seu sistema.
4. Volte ao Supabase: **Authentication → URL Configuration**:
   - **Site URL**: cole o endereço do sistema.
   - **Redirect URLs**: adicione o mesmo endereço.
   Isso faz os e-mails de confirmação e de "esqueci a senha" voltarem para o sistema.

## 5. Primeiro acesso

1. Abra o endereço do sistema.
2. Digite **o mesmo e-mail que você pôs no SQL** e uma senha (mínimo 8 caracteres) → **Primeiro acesso: criar senha**.
3. Abra o e-mail de confirmação, toque no link e depois entre no sistema.
4. Toque em **Ajustes** e preencha: nome do escritório, endereço, cidade, telefone, e-mail e chave Pix. Isso vai para a procuração e o contrato. A logo Palha Novaes já vem instalada.
5. Ainda em **Ajustes**, crie a **senha do cofre** (para as senhas gov.br das clientes) e cadastre os feriados locais (ex.: 15/08 Adesão do Pará; 08/12 N. Sra. da Conceição em Belém).
6. Na aba **Equipe**, cadastre-se: nome, função Advogado(a), **OAB** (ex.: `PA 012345`) e e-mail. O e-mail que você pôs no SQL já entra como **gestor**.
7. **Verificação em duas etapas (recomendado)**: em **Ajustes → Verificação em duas etapas**, toque **Ativar**. Instale no celular o **Google Authenticator** ou o **Microsoft Authenticator**, leia o QR code e digite o código de 6 números. A partir daí, além da senha, o sistema pede o código que muda a cada 30 segundos. Depois que todos tiverem ativado, ligue **Exigir de toda a equipe**: quem ainda não ativou é levado a ativar no próximo login.
8. Ainda em **Ajustes**, preencha **Nome do titular do Pix** e **Cidade do titular do Pix**. Com isso, as cobranças saem com o **Pix copia e cola** já com o valor da parcela.

**Para cada colega**: na aba **Acessos**, digite o e-mail dele, escolha **Equipe** ou **Gestor** e toque **Liberar acesso**. Ele abre o endereço e usa **Primeiro acesso** com esse e-mail. Cadastre-o também na **Equipe** (OAB e canais de aviso).

### Gestores e equipe
- **Gestor**: vê e faz tudo, inclusive Ajustes do escritório, Equipe, **Acessos**, Financeiro, Relatórios, Histórico e excluir registros.
- **Equipe**: trabalha em clientes, processos, prazos, intimações, tarefas, júri, documentos e agenda (vê, cadastra e edita). Não vê financeiro, relatórios nem histórico, e não exclui nada além de cartões de tarefa. No lugar de "Ajustes" aparece **Minha conta** (aviso no celular, duas etapas e os próprios canais de aviso).
- Cada pessoa entra com o próprio e-mail e senha. **Sair da conta** desconecta só aquele aparelho: os outros aparelhos e os outros logins continuam como estão. No mesmo computador, para trocar de pessoa, é só sair e entrar com o outro e-mail.
- Na aba **Acessos** o gestor vê quem está liberado, o último acesso, quem ativou as duas etapas e quem criou conta sem estar liberado (libere só quem você conhece).
- Ninguém consegue tirar o próprio acesso de gestor: isso evita o escritório ficar sem gestor. Se precisar, o outro gestor faz.
- Essas regras valem no banco de dados, não só na tela.

> Se alguém perder o celular do autenticador: outra pessoa com acesso pode entrar em Supabase → **Authentication → Users**, abrir o usuário e remover o fator de MFA. Ele entra só com a senha e ativa de novo.

## 6. Avisos pelo Telegram (grátis e oficial)

1. No Telegram, procure **@BotFather** → **/newbot** → dê um nome (ex.: `Avisos Novaes`) e um usuário terminado em `bot` (ex.: `novaes_avisos_bot`).
2. Ele responde com um **token** (algo como `123456:ABC...`). Guarde para o passo 9.
3. **Cada pessoa da equipe**:
   - abre o bot do escritório (`t.me/novaes_avisos_bot`) e toca **Iniciar** (sem isso o bot não consegue mandar mensagem);
   - procura **@userinfobot**, toca **Iniciar** e copia o número **Id**;
   - cola esse número no cadastro dela na Equipe, em **Telegram: ID do chat**.

## 7. Avisos por e-mail (Gmail, grátis)

1. Use uma conta Gmail do escritório. Ative a **Verificação em duas etapas** (Conta Google → Segurança).
2. Acesse **myaccount.google.com/apppasswords**, crie uma senha com o nome `robo` e copie as 16 letras.
3. O e-mail de cada pessoa vem do cadastro da Equipe.

## 8. WhatsApp (opcional, não oficial)

O WhatsApp oficial (Meta) é pago. A opção grátis é o **CallMeBot**, um serviço não oficial: funciona bem para avisos pessoais, mas pode parar sem aviso.
1. Cada pessoa entra em **callmebot.com**, vai em WhatsApp e segue as instruções para receber a **API key** (manda uma mensagem do próprio WhatsApp para o número indicado lá).
2. Cola a chave em **WhatsApp: chave CallMeBot** e confere o **WhatsApp (com DDD)** no cadastro da Equipe.

## 9. Guardar as senhas do robô (Secrets)

No repositório: **Settings → Secrets and variables → Actions → New repository secret**. Crie um por um:

| Nome (exatamente assim) | Valor |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | chave **secreta** do Supabase |
| `TELEGRAM_TOKEN` | token do BotFather |
| `GMAIL_USER` | e-mail Gmail do robô |
| `GMAIL_APP_PASSWORD` | as 16 letras da senha de app |
| `APP_URL` | endereço do sistema (vai no fim dos avisos) |
| `ALERTA_EMAIL` *(opcional)* | e-mail que recebe o que não tiver responsável |
| `TELEGRAM_GRUPO` *(opcional)* | ID de um grupo do Telegram com o bot dentro |
| `VAPID_PRIVATE` *(para o aviso no celular)* | a chave secreta que aparece em **Ajustes → Notificações no celular** (passo 12) |

## 10. Ligar e testar o robô

1. Aba **Actions** do repositório → se aparecer, clique **I understand my workflows, go ahead and enable them**.
2. Clique **Robô do escritório** → **Run workflow** → **Run workflow**.
3. Espere a bolinha ficar verde e clique nela → **rodar** → **Rodar o robô** para ver o relatório. Deve mostrar quantas comunicações achou por OAB.
4. Abra a aba **Intimações** do sistema. Toque **Cadastrar**: ele cria o processo (ou usa o existente), abre o prazo com a data do DJEN e você só informa os dias.

5. Para conferir a logo, vá em **Documentos → + Procuração**, escolha um cliente de teste e gere o PDF.

A partir daí ele roda sozinho de segunda a sexta, às 7h07 (prazos, honorários, intimações e documentos enviados por clientes) e às 16h07 (intimações, movimentações e documentos). **Toda segunda de manhã** ele também faz a cópia de segurança (veja abaixo).

Para testar a cópia de segurança na hora: **Run workflow** → marque **Fazer a cópia de segurança agora** → **Run workflow**.

## 11. Instalar no celular

- **Android (Chrome)**: abra o endereço → menu ⋮ → **Adicionar à tela inicial** / **Instalar app**.
- **iPhone (Safari)**: abra o endereço → botão Compartilhar → **Adicionar à Tela de Início**.

## 12. Avisos no celular (notificação do próprio sistema)

Funciona como a notificação de qualquer aplicativo, sem depender de Telegram ou WhatsApp.

1. **Uma vez só (um gestor)**, no computador: **Ajustes → Notificações no celular → Gerar chaves de notificação**. Aparece uma **chave secreta**: copie e crie no GitHub o Secret `VAPID_PRIVATE` com ela (passo 9). Ela aparece só nessa hora e não fica guardada no sistema. Se perder, gere chaves novas (aí todos ativam de novo).
2. **Cada pessoa, no próprio celular**: abra o sistema instalado (passo 11) → **Ajustes → Receber avisos neste aparelho** → permita as notificações. Use **Mandar aviso de teste** para conferir.
3. No iPhone, só funciona com o sistema instalado na Tela de Início (iOS 16.4 ou mais novo).

O robô manda o aviso para o celular de cada responsável junto com os outros canais. Aparelhos que desinstalaram o app saem da lista sozinhos.

## 13. Botão "Buscar agora" nas Intimações

Além das buscas automáticas (segunda a sexta, 7h e 16h), a aba **Intimações** tem o botão **Buscar agora**: ele pede ao robô uma busca no DJEN na hora, sem mandar avisos por Telegram, e-mail ou WhatsApp.
- Antes de tocar, escolha a **OAB** (ou "Todas as OABs") e o **período**: recentes (3 dias), 30 dias, 90 dias, 1 ano ou 2 anos. Quanto maior o período, mais demora (de 1 minuto a uns 20).
- Comunicações dos últimos 7 dias entram em **Novas**. As mais antigas entram como **antigas**, para não lotar a lista.
- A aba **Processos da OAB** mostra um cartão por processo encontrado, com quantas publicações teve e a última data, e o botão **Cadastrar processo** para os que ainda não estão no sistema. O DJEN só traz processos que tiveram alguma publicação no período escolhido: para montar a carteira, faça uma busca de "Últimos 2 anos" por OAB.

Para ligar o botão (uma vez só), o GitHub precisa de um token que só sabe rodar o robô:
1. No GitHub, clique na sua foto → **Settings** → no fim do menu, **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. **Token name**: `botao-buscar`. **Expiration**: a maior data que aparecer (anote para renovar).
3. **Repository access**: **Only select repositories** → escolha **SISTEMANOVAES**.
4. **Permissions** → **Repository permissions** → **Actions**: **Read and write**. Não marque mais nada.
5. **Generate token** e copie (começa com `github_pat_`). Ele só aparece uma vez.
6. No Supabase: **Edge Functions** → **Secrets** → **Add new secret**. Nome `GITHUB_TOKEN`, valor: o token. **Save**.

As funções `buscar-intimacoes` e `djen` já estão instaladas no Supabase (o código fica em `supabase/functions`). Ela confere se quem apertou está liberado no sistema antes de chamar o robô. Quando o token vencer, o botão avisa; é só gerar outro e trocar o secret.

---

## Como funciona a assinatura da procuração e do contrato

1. Na aba **Documentos**, gere a procuração ou o contrato. O texto aparece pronto, com a qualificação do cliente, os advogados, os poderes, o modo de pagamento e a logo. Você pode editar antes de gerar o PDF.
2. Toque **Enviar para assinar**: sai uma mensagem pronta para WhatsApp ou e-mail com o link do PDF (vale 7 dias) e o passo a passo para o cliente.
3. O cliente assina **de graça pelo gov.br** (assinador.iti.br ou app gov.br, conta prata ou ouro) e devolve o arquivo.
4. Toque **Anexar assinado**. O checklist do processo marca a procuração ou o contrato como entregue.

**Validade**: a assinatura gov.br é avançada (Lei 14.063/2020). Em fevereiro de 2026 o STJ decidiu (REsp 2.243.445) que procuração assinada pelo gov.br é válida e dispensa firma reconhecida, salvo impugnação específica. A assinatura com certificado ICP-Brasil continua sendo a mais aceita, se algum juízo exigir. Confira a assinatura do cliente em **validar.iti.gov.br**.

**Modelos**: em Documentos → **Modelos de procuração e contrato** você edita as cláusulas. Os campos entre chaves, como `{{OUTORGANTE}}`, são trocados automaticamente.

---

## Cofre de senhas gov.br das clientes

No cadastro da cliente (previdenciário) há o bloco **Acesso gov.br / Meu INSS**: login, nível da conta, senha, para quem ligar quando o gov.br pedir o código de verificação, e a autorização da cliente.

1. **Uma vez só**: em **Ajustes → Cofre de senhas gov.br**, crie a **senha do cofre** (mínimo 10 caracteres) e combine com a equipe.
2. Ao cadastrar a cliente, destranque o cofre, digite a senha gov.br dela, marque **A cliente autorizou** e salve.
3. Para usar: abra a cliente, destranque, e toque **Mostrar** (some sozinho em 20 segundos) ou **Copiar**.

Como protege:
- A senha é criptografada **no aparelho**, antes de ir para o banco (AES-256). O Supabase, o robô e a cópia de segurança só guardam a versão embaralhada.
- O cofre se tranca sozinho após 10 minutos sem uso e ao sair da conta.
- **Se a senha do cofre for esquecida, ninguém recupera as senhas guardadas**, nem você nem eu. Basta pedir à cliente e cadastrar de novo. Guarde a senha do cofre num lugar seguro.
- Quem sair do escritório: troque a senha do cofre em Ajustes (o sistema regrava todas as senhas com a nova).
- O contrato gerado ganha automaticamente um parágrafo com a autorização da cliente para guardar as credenciais.

---

## Checklist de documentos no cadastro do cliente

No cadastro do cliente, em **Checklist de documentos**, escolha **Qual caso você vai trabalhar**. A lista se monta sozinha e você só vai marcando o que o cliente já entregou (e pode anexar a foto ou o PDF de cada um).

- **Sempre na lista**: procuração, contrato de honorários, RG/CPF e comprovante de residência. RG/CPF e comprovante ficam marcados sozinhos quando você anexa esses arquivos no cadastro; procuração e contrato, quando o documento assinado é anexado na aba Documentos.
- **Previdenciário**: muda conforme o benefício (BPC/LOAS deficiente ou idoso, salário-maternidade, pensão por morte, auxílio-reclusão, incapacidade, aposentadorias, revisão…).
- **Criminal**: sempre a mesma lista.
- **Trabalhista**: base fixa (CTPS, contracheques, TRCT, FGTS, provas, testemunhas) mais os itens do tipo de causa (vínculo sem carteira, horas extras, acidente ou doença do trabalho, insalubridade, assédio, rescisão indireta, gestante).
- Na lista de clientes aparece "Documentos 5/12", em vermelho, amarelo ou verde.
- Ao cadastrar um processo para esse cliente, a área e o benefício (ou tipo de causa) já vêm preenchidos, e o que foi marcado no cliente aparece marcado no checklist do processo.

## Área trabalhista

- Processos trabalhistas têm reclamada, CNPJ, admissão, saída, tipo de causa, fase e valor da causa.
- Enquanto a fase for "Antes de ajuizar", o processo mostra a data-limite da **prescrição bienal** (2 anos da saída), em vermelho quando faltam menos de 120 dias.
- Prazos: escolha **Justiça do Trabalho**. A contagem é em dias úteis (art. 775 da CLT) com os feriados da Lei 5.010/66, recesso e suspensão de 20/12 a 20/01. Alguns TRTs suspendem prazos só de 07 a 20/01, ou têm feriados próprios: cadastre-os nos Ajustes e confira sempre o calendário do seu TRT.
- Intimações do TRT que chegam pelo DJEN já vêm marcadas como Trabalhista, e a procuração gerada ganha os poderes para a Justiça do Trabalho, MTE, MPT e levantamento de FGTS.

---

## Calendário, Júri e Linha do tempo previdenciária

> **Já tinha instalado uma versão anterior?** Suba os arquivos novos para o GitHub (substituindo os antigos) e rode `banco/2-atualizacao.sql` no SQL Editor do Supabase. Quem está instalando agora não precisa: o `1-criar-tabelas.sql` já inclui tudo.

**Calendário** (aba Prazos → Calendário)
- Mostra prazos, audiências, perícias, plenários, reuniões e visitas, com feriados e recesso marcados.
- Toque num dia para ver o que tem e adicionar um compromisso. No computador, arraste um item para outro dia: compromissos mudam de data; prazos ficam com o vencimento "ajustado à mão" (dá para desfazer no próprio prazo).
- Audiências telepresenciais ou semipresenciais: escolha o **Formato** e cole o **link da sala** (Zoom, Teams, Meet, Webex, Balcão Virtual) e o ID ou senha. Aparece o botão **Entrar na sala virtual** no calendário e no Início.
- O robô avisa os compromissos de hoje, amanhã e depois de amanhã junto com os prazos, já com o link da sala quando houver.

**Tribunal do Júri** (menu Júri, ou botão "Painel do júri" no processo)
- **Resumo**: contagem regressiva do plenário, teses escolhidas, prazos abertos e dados do caso. A data do plenário vai sozinha para o calendário.
- **Apresentação no Canva**: cole o link em “Dados do caso”. O botão **Abrir apresentação no Canva** aparece no Resumo e na aba Plenário, ao lado do cronômetro. Dica: baixe também uma cópia em PDF ou PPTX pelo Canva, para não depender da internet do fórum.
- **Teses**: cada tese com tipo, situação ("Vou usar", "Em estudo", "Descartada"), ordem de sustentação, provas ligadas e fundamentação no editor de texto.
- **Provas e documentos**: folhas/ID, se ajudam ou atrapalham a defesa, como usar e o arquivo.
- **Testemunhas**: o que já disseram e as perguntas para o plenário.
- **Linha do tempo**: fato, prisão, denúncia, pronúncia… Prazos e intimações do processo entram sozinhos.
- **Plenário**: cronômetro dos debates (art. 477 do CPP, já ajusta para mais de um réu) e lista de jurados com contador das 3 recusas imotivadas de cada parte (art. 468).
- **Roteiro da sustentação**: texto livre com o editor.

**Editor de texto e corretor ortográfico**
- Negrito, itálico, sublinhado, destaque, títulos, listas, citação, desfazer, tela cheia, contagem de palavras e tempo estimado de fala. Salva sozinho enquanto você escreve.
- "Baixar para Word" gera um arquivo que abre no Word; "Copiar texto" leva o texto para onde quiser.
- O corretor é o do navegador: sublinha em vermelho e mostra sugestões no botão direito (ou tocando e segurando no celular). Se não aparecer em português: no Chrome, Configurações → Idiomas → Verificação ortográfica → ative Português (Brasil).

**Previdenciário** (menu Previdenciário, ou botão "Linha do tempo" no processo ou na cliente)
- Barra de etapas: Requerimento → Análise no INSS → Recurso adm. → Ação judicial → Sentença → Benefício concedido → Pagamento.
- Quadro com DER, DIB, DIP, RMI, atrasados previstos, valores recebidos pela cliente e honorários de êxito.
- Linha do tempo juntando DER, eventos (perícia, indeferimento, ajuizamento, sentença, RPV, atrasados recebidos…), prazos, intimações, movimentação do CNJ, procuração assinada e êxito recebido.
- Preencha DIB, DIP, RMI e atrasados no cadastro do processo (seção Previdenciário).

---

## Novidades da versão 3

> **Já tinha instalado uma versão anterior?** (1) Suba **todos** os arquivos de novo para o GitHub, substituindo os antigos, inclusive a pasta `lib`, o `enviar.html` e o `.github/workflows/robo.yml` (abra o arquivo no GitHub, toque no lápis, apague tudo e cole o novo). (2) Rode `banco/2-atualizacao.sql` no SQL Editor do Supabase. Ele não apaga nada e pode ser rodado mais de uma vez. (3) Faça os passos 7 e 8 do "Primeiro acesso" e o passo 12. (4) No celular, feche e abra o app duas vezes para ele pegar a versão nova.

**Cliente manda os documentos pelo celular**
- No cadastro do cliente (depois de salvo), toque **Pedir documentos pelo link**. Sai um link com a mensagem pronta para o WhatsApp.
- O cliente abre, vê só o que ainda falta do checklist e tira as fotos ou escolhe PDFs, sem senha. As fotos são reduzidas no próprio celular antes de enviar.
- Os arquivos chegam numa pasta protegida. No Início aparece "Documentos enviados por clientes" e o robô avisa o responsável.
- Você toca **Ver** e **Aceitar** (marca o item no checklist e guarda o arquivo; depois toque **Salvar**) ou **Recusar**.
- O link vale 30 dias, aceita no máximo 80 arquivos e pode ser desativado a qualquer momento. Só aceita fotos e PDF de até 15 MB.

**Prazo sugerido pela intimação**: ao cadastrar uma intimação, se o texto disser "no prazo de 15 (quinze) dias", o campo de dias já vem com 15. Confira sempre.

**Pix copia e cola e recibo**
- A mensagem de cobrança da parcela traz o código Pix copia e cola com o valor certo.
- Parcela recebida ganha o botão **Recibo**: gera o PDF com a logo, guarda em Documentos e abre a mensagem para mandar ao cliente.

**Modelos de petição** (Documentos → **+ Petição** e **Modelos de petição**)
- Vêm 4 estruturas para você adaptar: petição simples, inicial de BPC/LOAS, resposta à acusação e reclamação trabalhista. São esqueletos com os artigos de base, não peças prontas: os trechos entre colchetes são para você escrever.
- Escolha o modelo, o cliente, o processo e os advogados: endereçamento, qualificação, número, NB, DER, reclamada, data e assinaturas entram sozinhos. O texto abre no editor (com corretor) e sai em Word ou em PDF com a logo.
- Crie seus próprios modelos em **Modelos de petição → + Novo modelo**, usando os campos automáticos listados na tela.

**Suspensões de prazo dos tribunais** (Ajustes → Suspensões de prazo)
- Quando o TJPA, o TRF1 ou o TRT8 suspender prazos (portaria, PJe fora do ar), cadastre o tribunal e as datas uma vez. Todos os prazos daquele tribunal são recalculados, e o calendário mostra o dia como suspenso. Use "Todos" para suspensões gerais.
- O tribunal do prazo é o informado no processo (ex.: `TJPA`). Escreva igual nos dois lugares.

**Tudo ao vivo**: o que um colega cadastra aparece na hora na tela dos outros (a marquinha **AO VIVO** no topo). Se você estiver com um formulário aberto ou escrevendo, a tela espera você terminar. No Júri, duas pessoas podem mexer no mesmo caso ao mesmo tempo sem apagar o que a outra escreveu.

**Relatórios** (menu Relatórios): honorários recebidos por mês, previsão dos próximos meses, quem está devendo, processos por área e fase, prazos por pessoa (abertos, vencidos, cumpridos com atraso), benefícios concedidos, júris e clientes novos. Dá para imprimir.

**Histórico e lixeira** (menu Histórico)
- Mostra quem criou, alterou ou excluiu cada coisa, e quem abriu ou copiou senha gov.br.
- Excluiu sem querer? Encontre em **Exclusões** e toque **Restaurar**.
- Ninguém consegue apagar ou editar o histórico pelo sistema.

**Cópia de segurança automática**
- Toda segunda de manhã o robô copia todos os dados, guarda no Supabase (**Storage → backups**, pasta privada, mantém as 12 últimas) e manda o arquivo para o `ALERTA_EMAIL` (ou para o Gmail do robô).
- O arquivo tem dados sigilosos: não encaminhe. As senhas gov.br continuam embaralhadas pela senha do cofre. Os arquivos anexados (fotos e PDFs) ficam no Supabase e não vão no e-mail.
- **Nunca** coloque cópias de segurança no GitHub: o repositório é público.

**Fotos menores**: toda foto anexada no sistema é reduzida antes de subir (fica legível e ocupa bem menos espaço no plano grátis de 1 GB).

---

## Se algo der errado

- **O robô mostra erro 403 no DJEN**: o DJEN recusa servidores fora do Brasil, e o GitHub roda nos EUA. Por isso o robô consulta o DJEN pela função `djen` do Supabase, que roda em São Paulo (o relatório mostra "consultando pela ponte do Supabase em São Paulo"). Se a ponte falhar, confira se a função `djen` aparece em Supabase › Edge Functions. Plano B: rodar o robô num computador no Brasil (Python instalado, `robo/robo.py` e `robo/rodar-no-windows.exemplo.bat` preenchido, com `set DJEN_DIRETO=1`, agendado no Agendador de Tarefas do Windows). Não suba o `.bat` preenchido para o GitHub.
- **Última movimentação não aparece**: a DataJud do CNJ atualiza com alguns dias de atraso e não cobre todos os tribunais. Se o relatório mostrar erro 401, a chave pública do CNJ mudou. Pegue a nova em datajud-wiki.cnj.jus.br e crie o Secret `DATAJUD_KEY`.
- **"E-mail ainda não foi liberado"**: um gestor precisa liberar o e-mail na aba **Acessos**.
- **O GitHub parou de rodar o robô**: em repositórios públicos, o GitHub pausa agendamentos após 60 dias sem alterações e manda um e-mail. É só entrar em Actions e reativar.
- **Pede o código e o celular do autenticador sumiu**: veja o aviso no fim do "Primeiro acesso" (remover o fator em Authentication → Users).
- **Aviso no celular não chega**: confira o Secret `VAPID_PRIVATE` e se o relatório do robô mostra "Aparelhos com notificação". No Android, veja se o Chrome tem permissão de notificação; no iPhone, use o app instalado na Tela de Início.
- **"Rode o arquivo banco/2-atualizacao.sql"** aparecendo em alguma tela: o banco está numa versão antiga. Rode o arquivo no SQL Editor.
- **O e-mail de confirmação não chega**: o envio grátis do Supabase é limitado a poucos e-mails por hora. Espere e tente de novo, ou veja a caixa de spam.

## Cuidados com dados (LGPD)

- Dados de saúde (previdenciário) e criminais são **dados sensíveis**. Libere o sistema só para quem trabalha no escritório e desmarque o acesso de quem sair.
- Use senhas fortes e não compartilhe a conta.
- O robô faz a cópia de segurança toda segunda. Se quiser uma extra, use **Ajustes → Baixar cópia** e guarde em local seguro (nunca no GitHub).
- Ative a verificação em duas etapas para toda a equipe.
- O plano grátis do Supabase pausa projetos sem uso por uma semana. O robô acessa o banco todo dia útil, o que mantém o projeto ativo.

## Conferência dos prazos

A calculadora considera fins de semana, feriados nacionais, carnaval, Semana Santa, Corpus Christi, feriados da Justiça Federal (Lei 5.010/66), o recesso de 20/12 a 06/01, a suspensão de prazos até 20/01 (CPC art. 220 e CPP art. 798-A) e os feriados locais que você cadastrar nos Ajustes. Mesmo assim, **confira sempre no sistema do tribunal**. A responsabilidade pelo prazo é do advogado.
