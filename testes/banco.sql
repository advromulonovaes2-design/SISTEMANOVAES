-- Testes das regras do banco (gestores, equipe, histórico, links públicos).
-- Roda depois de testes/supabase-falso.sql e banco/1-criar-tabelas.sql.
-- Cada verificação dá erro (e o teste falha) se a regra não estiver valendo.
\set ON_ERROR_STOP 1
\set QUIET on
\pset tuples_only on

-- helper: interrompe o teste com a mensagem do erro (só existe no banco de teste)
create or replace function public.teste_falhou(t text) returns text language plpgsql volatile as $$ begin raise exception '%', t; end $$;
grant execute on function public.teste_falhou(text) to anon, authenticated;

insert into auth.users(id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-000000000001', 'gestor1@x.com', now()),
  ('00000000-0000-0000-0000-000000000002', 'gestor2@x.com', now()),
  ('00000000-0000-0000-0000-000000000003', 'equipe@x.com', now()),
  ('00000000-0000-0000-0000-000000000004', 'estranho@x.com', now());
insert into public.acesso(email, gestor) values ('Gestor2@X.com', true), ('equipe@x.com', false);
insert into public.clientes(id, dados) values ('10000000-0000-0000-0000-000000000001', '{"nome":"Cliente Um"}');
insert into public.processos(id, dados) values ('20000000-0000-0000-0000-000000000001', '{"numero":"0820132-34.2026.8.14.0401","clienteId":"10000000-0000-0000-0000-000000000001","area":"Criminal","faseCrim":"Instrução"}');
insert into public.honorarios(id, dados) values (gen_random_uuid(), '{"objeto":"H1"}');
insert into public.equipe(id, dados) values (gen_random_uuid(), '{"nome":"Eq","email":"equipe@x.com"}'), (gen_random_uuid(), '{"nome":"G1","email":"gestor1@x.com"}');
insert into public.tarefas(id, dados) values (gen_random_uuid(), '{"titulo":"T"}');
insert into public.acompanhamentos(token, cliente_id) values ('30000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001');

select case when (select string_agg(email, ',' order by email) from public.acesso) = 'equipe@x.com,gestor1@x.com,gestor2@x.com'
  then 'OK  e-mails guardados em minúsculo' else public.teste_falhou('ERRO e-mails não foram para minúsculo') end;
select case when (select count(*) from public.historico where tabela = 'processos') >= 1
  then 'OK  histórico registra tabela com id uuid' else public.teste_falhou('ERRO histórico não registrou processos') end;
update public.config set dados = '{}' where id = 'robo';
insert into public.config(id, dados) values ('robo', '{"x":1}') on conflict (id) do update set dados = excluded.dados;
select case when not exists (select 1 from public.historico where registro_id = 'robo')
  then 'OK  status do robô fica fora do histórico' else public.teste_falhou('ERRO status do robô entrou no histórico') end;

-- ===================== EQUIPE =====================
set role authenticated;
select set_config('request.jwt.claims', '{"email":"equipe@x.com","sub":"00000000-0000-0000-0000-000000000003","aal":"aal1"}', false);
select case when public.meu_papel() = 'equipe' then 'OK  equipe é reconhecida como equipe' else public.teste_falhou('ERRO papel da equipe') end;
select case when (select count(*) from public.clientes) = 1 then 'OK  equipe vê clientes' else public.teste_falhou('ERRO equipe não vê clientes') end;
select case when (select count(*) from public.honorarios) = 0 then 'OK  equipe não vê honorários' else public.teste_falhou('ERRO equipe viu honorários') end;
select case when (select count(*) from public.historico) = 0 then 'OK  equipe não vê histórico' else public.teste_falhou('ERRO equipe viu histórico') end;
select case when (select count(*) from public.acessos_info()) = 0 then 'OK  equipe não vê a lista de acessos' else public.teste_falhou('ERRO equipe viu acessos') end;
insert into public.clientes(id, dados) values (gen_random_uuid(), '{"nome":"Cliente da equipe"}');
select 'OK  equipe cadastra cliente';
with d as (delete from public.clientes returning 1) select case when count(*) = 0
  then 'OK  equipe não exclui clientes' else public.teste_falhou('ERRO equipe excluiu cliente') end from d;
with d as (delete from public.tarefas returning 1) select case when count(*) = 1
  then 'OK  equipe exclui cartão de tarefa' else public.teste_falhou('ERRO equipe não excluiu tarefa') end from d;
with u as (update public.equipe set dados = dados || '{"telegram":"1"}' where dados ->> 'email' = 'equipe@x.com' returning 1) select case when count(*) = 1
  then 'OK  equipe muda o próprio cadastro' else public.teste_falhou('ERRO equipe não mudou o próprio cadastro') end from u;
with u as (update public.equipe set dados = dados || '{"telegram":"9"}' where dados ->> 'email' = 'gestor1@x.com' returning 1) select case when count(*) = 0
  then 'OK  equipe não muda cadastro dos outros' else public.teste_falhou('ERRO equipe mudou cadastro de outro') end from u;
do $$ begin
  insert into public.acesso(email) values ('novo@x.com');
  raise exception 'ERRO equipe conseguiu liberar acesso';
exception when insufficient_privilege then raise notice 'OK  equipe não libera acesso'; end $$;
do $$ begin
  insert into public.honorarios(id, dados) values (gen_random_uuid(), '{}');
  raise exception 'ERRO equipe gravou honorários';
exception when insufficient_privilege then raise notice 'OK  equipe não grava honorários'; end $$;
do $$ begin
  insert into public.config(id, dados) values ('geral', '{"nome":"x"}');
  raise exception 'ERRO equipe gravou ajustes';
exception when insufficient_privilege then raise notice 'OK  equipe não grava ajustes'; end $$;
select case when public.meu_link_agenda() is not null and public.meu_link_agenda() = public.meu_link_agenda()
  then 'OK  link de agenda é gerado e fica o mesmo' else public.teste_falhou('ERRO link de agenda') end;

-- ===================== CONTA NÃO LIBERADA =====================
select set_config('request.jwt.claims', '{"email":"estranho@x.com","sub":"00000000-0000-0000-0000-000000000004","aal":"aal1"}', false);
select case when public.estado_acesso() = 'sem_permissao' and (select count(*) from public.clientes) = 0 and public.meu_link_agenda() is null
  then 'OK  conta não liberada não vê nada' else public.teste_falhou('ERRO conta não liberada viu dados') end;

-- ===================== GESTOR =====================
select set_config('request.jwt.claims', '{"email":"gestor1@x.com","sub":"00000000-0000-0000-0000-000000000001","aal":"aal1"}', false);
select case when public.meu_papel() = 'gestor' and (select count(*) from public.honorarios) = 1
  then 'OK  gestor vê o financeiro' else public.teste_falhou('ERRO gestor não vê o financeiro') end;
select case when (select count(*) from public.acessos_info() where not liberado) = 1
  then 'OK  gestor vê quem criou conta sem liberação' else public.teste_falhou('ERRO lista de pendentes') end;
do $$ begin
  update public.acesso set gestor = false where email = 'gestor1@x.com';
  raise exception 'ERRO gestor tirou o próprio acesso';
exception when raise_exception then
  if sqlerrm like 'Você não pode%' then raise notice 'OK  gestor não tira o próprio acesso'; else raise; end if;
end $$;
with d as (delete from public.clientes where dados ->> 'nome' = 'Cliente da equipe' returning 1) select case when count(*) = 1
  then 'OK  gestor exclui' else public.teste_falhou('ERRO gestor não excluiu') end from d;


-- ===================== INTIMAÇÕES (classificação) E REGISTRO DE ERROS =====================
insert into public.intimacoes(hash, numero, tipo_documento, texto) values
  ('cl1', '1', 'Despacho', 'Certificado o trânsito, arquivem-se os autos.'),
  ('cl2', '2', 'Sentença', 'Julgo procedente. Após o trânsito em julgado, arquive-se.'),
  ('cl3', '3', 'Decisão', 'Redesigno a audiência para às 10h do dia 15/12/2026.');
select case when (select f_arq from public.intimacoes where hash = 'cl1') and not (select f_arq from public.intimacoes where hash = 'cl2')
  then 'OK  arquivamento lido do texto (sentença com "arquive-se" não conta)' else public.teste_falhou('ERRO classificação de arquivamento') end;
select case when (select f_sent from public.intimacoes where hash = 'cl2') then 'OK  sentença reconhecida' else public.teste_falhou('ERRO sentença') end;
select case when (select aud_data from public.intimacoes where hash = 'cl3') = '2026-12-15'
  then 'OK  data da audiência lida do texto' else public.teste_falhou('ERRO data da audiência') end;
set role authenticated;
select set_config('request.jwt.claims', '{"email":"equipe@x.com","sub":"00000000-0000-0000-0000-000000000003","aal":"aal1"}', false);
insert into public.erros(usuario, mensagem) values ('equipe@x.com', 'teste');
select case when (select count(*) from public.erros) = 0 then 'OK  equipe anota erro mas não lê a lista' else public.teste_falhou('ERRO equipe leu erros') end;
do $$ begin
  insert into public.erros(usuario, mensagem) values ('outra@x.com', 'falso');
  raise exception 'ERRO anotou erro em nome de outra pessoa';
exception when insufficient_privilege then raise notice 'OK  ninguém anota erro em nome de outro'; end $$;
select set_config('request.jwt.claims', '{"email":"gestor1@x.com","sub":"00000000-0000-0000-0000-000000000001","aal":"aal1"}', false);
select case when (select count(*) from public.erros) = 1 then 'OK  gestor lê os erros' else public.teste_falhou('ERRO gestor não leu erros') end;
reset role;

-- ===================== PÁGINA PÚBLICA DO CLIENTE =====================
reset role;
set role anon;
select case when (public.acompanhamento_info('30000000-0000-4000-8000-000000000001') ->> 'cliente') = 'Cliente'
  then 'OK  link de acompanhamento mostra o cliente' else public.teste_falhou('ERRO acompanhamento') end;
select case when public.acompanhamento_info('30000000-0000-4000-8000-000000000009') is null
  then 'OK  link de acompanhamento errado não mostra nada' else public.teste_falhou('ERRO link errado mostrou dados') end;
do $$ begin
  perform 1 from public.clientes;
  raise exception 'ERRO visitante leu clientes';
exception when insufficient_privilege then raise notice 'OK  visitante não lê tabelas'; end $$;
reset role;
select 'TODOS OS TESTES DO BANCO PASSARAM';
