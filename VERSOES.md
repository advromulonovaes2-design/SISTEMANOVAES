# Versões do sistema

Cada vez que o sistema mudar, anote aqui o que mudou. Assim dá para saber o que foi alterado e voltar atrás se precisar.
A versão em uso aparece em **Ajustes → Sobre**.

**Como voltar uma versão no GitHub**: abra o arquivo no repositório → **History** → escolha a versão anterior → **…** → **View file** → copie o conteúdo e cole no arquivo atual. O banco de dados não volta junto: para isso existe a cópia de segurança semanal.

**Antes de mexer**: baixe o repositório inteiro (**Code → Download ZIP**) e guarde com a data no nome. É a sua cópia do sistema daquele dia.

---

## Versão 3.9 · 11/11/2026

- **Lançamentos automáticos pelo robô** (`robo/automatico.py`): ao ler as intimações, o robô cadastra sozinho as **audiências, perícias e plenários** com data futura (data, hora, formato e link da sala) e os **prazos reconhecíveis**: contestação (cível), resposta à acusação, réplica, alegações finais, contrarrazões, recurso contra sentença e qualquer prazo escrito na intimação ("no prazo de 5 dias"). Tudo entra marcado como **lançado pelo robô — conferir** e o aviso do dia traz o bloco "LANÇADOS AUTOMATICAMENTE — CONFIRA NO SISTEMA".
- O vencimento é calculado com o mesmo cálculo da tela (`robo/vencimento.js` usa o `calc.js`).
- Não lança contestação na Justiça do Trabalho e nos Juizados (é na audiência) nem quando a citação é do INSS ou da União. Não repete o que já foi lançado (nem se a pessoa apagar).
- Na tela: selo "Lançado pelo robô" no prazo; a intimação mostra o que já foi lançado; "Cadastrar" abre o prazo do robô para conferir; o compromisso deixa de pedir conferência quando alguém salva; o Assistente lista o que falta conferir.
- Testes: `robo/teste_automatico.py` e o vencimento conferido no GitHub a cada mudança.

## Versão 3.8 · 11/11/2026

- **Assistente de organização** (`organiza.js`), grátis e sem IA: a página **Assistente** mostra o que precisa de atenção (prazos vencidos, sem data, sem responsável ou sem conferência; intimações novas; audiências virtuais sem link; tarefas atrasadas) e o que arrumar nos cadastros (processos sem cliente, número ou responsável; duplicados; clientes sem telefone ou CPF; processos da OAB não cadastrados; quem não recebe avisos). Cada item abre o cadastro ou a tela certa. Faixa no Início com a contagem.
- **Como faço…?**: respostas prontas sobre o uso do sistema, com busca.
- A IA (opcional) fica no fim da página do Assistente.

## Versão 3.7 · 11/11/2026

- **Acessos**: botão **Excluir solicitação** para quem criou conta e não foi aprovado (função `excluir-solicitacao` no Supabase; só gestores; não apaga quem está liberado).
- **Robô**: opção **Só mandar uma mensagem de teste** no Run workflow (testa Telegram, e-mail e celular de cada pessoa). O e-mail tenta a porta 587 se a 465 falhar e explica o erro no relatório.
- **Aviso no celular**: tenta de novo quando o Android falha na primeira vez e explica o erro do serviço do Google.

## Versão 3.6 · 10/11/2026

- **Assistente de IA dentro do sistema**: conversa na própria tela, com resposta aparecendo aos poucos e perguntas de continuação; botões Copiar, Salvar como petição e Mandar no WhatsApp. Função `ia` no Supabase (secret `ANTHROPIC_API_KEY`; opcionais `IA_MODELO` e `IA_LIMITE_DIA`). Sem a chave, oferece levar o pedido ao Claude.
- **Banco**: tabela `ia_uso` (quantos pedidos e tokens por pessoa; só gestores leem).

## Versão 3.5 · 10/11/2026

- **Assistente de IA** (`ia.js`): botão "Perguntar à IA" em intimações, processos, júri e Processos da OAB, e página "Assistente IA". Monta o pedido com os dados da tela (com opção de trocar nomes por iniciais e esconder CPF/CNPJ), copia e abre o Claude da conta do advogado. Sem custo e sem chave de API.

## Versão 3.4 · 10/11/2026

**Banco** (rodar `banco/2-atualizacao.sql`)
- Intimações ganham colunas calculadas pelo banco: `f_arq` (arquivamento), `f_sent` (sentença/recurso), `f_aud` (audiência) e `aud_data` (data da audiência no texto).
- Tabela `erros` (registro de erros da tela; só gestores leem).
- Função `extrair_data_audiencia`: entende a data da audiência como 15/12/2026, 15.12.2026, 15-12-2026 ou "15 de dezembro de 2026".
- Já aplicado no Supabase do escritório em 10/11/2026.

**Sistema**
- Intimações carregam sem o texto das publicações (só as novas trazem texto); o resto vem quando você toca em "Mostrar o texto" ou "Ver publicações". A tela fica bem mais leve no celular.
- Registro de erros (`erros.js`): erros da tela e ao gravar ficam anotados e aparecem na Saúde do sistema.

**Robô**
- Cópia de segurança testada de verdade: `backups/backup-2026-11-10.json.gz` (0,8 MB) guardada no Supabase. A cópia passa a incluir os links de acompanhamento.

## Versão 3.3 · 10/11/2026

- Aba **Processos da OAB** reorganizada (`carteira.js`): grupos por matéria, situação (andamento, sentença/recurso, arquivado), audiência (marcada com data, já teve, sem) e tempo de processo; filtros, ordem e contadores no topo; ver todas as publicações do processo.
- **Excluir da lista** um processo ou todos os arquivados de uma vez (status `excluida`, reversível em "Ver excluídos"; volta sozinho se houver publicação nova).

## Versão 3.2 · 09/11/2026

**Banco** (rodar `banco/2-atualizacao.sql`)
- Link pessoal de agenda (`acesso.agenda_token`, função `meu_link_agenda`).
- Tabela `acompanhamentos` e função pública `acompanhamento_info` (página do cliente).

**Sistema**
- Dupla conferência de prazos (`conferencia.js`).
- Saúde do sistema nos Ajustes e faixa de alerta no Início (`saude.js`).
- Agenda no celular por link iCal (`agendalink.js` + função `agenda` no Supabase).
- Intimações: filtros por OAB e responsável, ignorar em lote, "Lançar prazo" quando o processo já existe.
- Completar processo pelo CNJ (`datajud.js` + função `datajud` no Supabase).
- Acompanhamento pelo cliente (`acompanha.js` + `acompanhar.html`).

**Robô**
- Registra canais de aviso, quem está sem canal, última rotina e última cópia de segurança; avisa quando o DJEN falha duas vezes seguidas.
- Avisos de prazo dizem quando o prazo ainda não foi conferido.
- Comunicações antigas guardadas sem a cópia completa (economiza espaço).

**Manutenção**
- Testes automáticos no GitHub (`testes/` e `.github/workflows/testes.yml`).

## Versão 3.1 · 09/11/2026

**Banco** (já aplicado no Supabase do escritório; em outra instalação, rodar `banco/2-atualizacao.sql`)
- Papéis **gestor** e **equipe** na tabela `acesso`, com regras no próprio banco: financeiro, acessos, histórico, ajustes, cadastro da equipe e exclusões só para gestores.
- Ninguém tira o próprio acesso de gestor.

**Sistema**
- Aba **Acessos** (só gestores): liberar e-mails como gestor ou equipe, mudar o papel, tirar acesso, ver último acesso e duas etapas, liberar quem criou conta.
- Quem é da equipe vê **Minha conta** em vez de Ajustes e pode mudar só os próprios canais de aviso.
- **Sair da conta** desconecta só o aparelho em uso.
- Saiu o campo "Pode entrar no sistema" do cadastro da Equipe (o acesso agora fica na aba Acessos).
- Sistema publicado direto na raiz do repositório.
- Botão **Sair** no topo, com o nome e o papel de quem está logado.
- Botão **Buscar agora** na aba Intimações (função `buscar-intimacoes` no Supabase + secret `GITHUB_TOKEN`), com o horário e o resultado da última busca. O robô ganhou o modo "busca", que só procura intimações e não manda avisos.
- **Buscar agora** com escolha de OAB e período (até 2 anos). Comunicações com mais de 7 dias entram como "antigas"; a nova aba **Processos da OAB** agrupa por processo e permite cadastrar os que faltam.
- Cliente novo pode ser cadastrado de dentro do formulário do processo.
- Corrigido o erro "invalid input syntax for type uuid" ao salvar.
- O robô consulta o DJEN pela função `djen` do Supabase, rodando em São Paulo: o DJEN recusa os servidores do GitHub (EUA). Testado: a OAB PA 42826 trouxe a primeira intimação.
- O robô se identifica ao Supabase de um jeito que a chave secreta é aceita (antes era recusada como se viesse de um navegador).

## Versão 3 · 05/11/2026

**Banco** (rodar `banco/2-atualizacao.sql`)
- Tabelas novas: `historico`, `envios`, `envios_arquivos`, `push`, `modelos`.
- Pastas novas no Storage: `envios` (documentos mandados pelos clientes) e `backups` (privadas).
- Verificação em duas etapas reconhecida pelo banco: com ela ativa, quem não digitar o código não lê nenhum dado.
- Sincronização ao vivo ligada para as tabelas do escritório.

**Sistema**
- Verificação em duas etapas (aplicativo autenticador), com opção de exigir de toda a equipe.
- Histórico de alterações, com restauração de itens excluídos e registro de quem viu ou copiou senha gov.br.
- Link para o cliente mandar os documentos pelo celular (`enviar.html`), com aceitar e recusar no cadastro.
- Prazo sugerido a partir do texto da intimação.
- Pix copia e cola nas cobranças; recibo de honorários em PDF.
- Modelos de petição com campos automáticos, editor e PDF com a logo.
- Suspensões de prazo por tribunal, com recálculo dos prazos abertos.
- Atualização ao vivo entre a equipe; o Júri grava sem apagar o que um colega escreveu ao mesmo tempo.
- Notificações no celular (Web Push).
- Relatórios.
- PDFs gerados com a biblioteca pdf-lib (pasta `lib`), com texto justificado e a logo.
- Fotos reduzidas antes de subir.
- Prazo cumprido passa a guardar a data em que foi marcado (usada nos relatórios).

**Robô**
- Avisa documentos enviados por clientes.
- Manda notificação no celular (precisa do Secret `VAPID_PRIVATE`).
- Cópia de segurança toda segunda de manhã no Supabase e no e-mail; botão para fazer na hora.

## Versão 2

- Logo Palha Novaes (preto e dourado) no sistema, no ícone do app e nos documentos.
- Calendário com audiências, perícias e links de salas virtuais.
- Painel do Tribunal do Júri: teses com editor e corretor, provas, testemunhas, linha do tempo, cronômetro, jurados e link do Canva.
- Linha do tempo previdenciária por cliente.
- Área trabalhista (prazos da CLT, prescrição bienal, checklist por tipo de causa).
- Checklist de documentos por benefício ou tipo de caso.
- Cofre de senhas gov.br criptografado.

## Versão 1

- Equipe, clientes, processos, prazos com cálculo, tarefas no estilo Trello, financeiro de honorários.
- Intimações do DJEN por OAB e última movimentação pela DataJud.
- Procuração e contrato automáticos com link para assinar pelo gov.br.
- Avisos por Telegram, e-mail e WhatsApp.
