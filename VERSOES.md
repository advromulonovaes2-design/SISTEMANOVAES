# Versões do sistema

Cada vez que o sistema mudar, anote aqui o que mudou. Assim dá para saber o que foi alterado e voltar atrás se precisar.
A versão em uso aparece em **Ajustes → Sobre**.

**Como voltar uma versão no GitHub**: abra o arquivo no repositório → **History** → escolha a versão anterior → **…** → **View file** → copie o conteúdo e cole no arquivo atual. O banco de dados não volta junto: para isso existe a cópia de segurança semanal.

**Antes de mexer**: baixe o repositório inteiro (**Code → Download ZIP**) e guarde com a data no nome. É a sua cópia do sistema daquele dia.

---

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
