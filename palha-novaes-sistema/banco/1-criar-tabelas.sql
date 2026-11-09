-- =====================================================================
--  BANCO DE DADOS DO ESCRITÓRIO PALHA NOVAES  (cole tudo no SQL Editor do Supabase)
--  ANTES DE RODAR: troque SEU-EMAIL-AQUI@gmail.com (lá no final)
--  pelo e-mail que você vai usar para entrar no sistema.
--  Pode rodar de novo sem perder dados.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Quem pode entrar
-- ---------------------------------------------------------------------
create table if not exists public.acesso (
  email     text primary key,
  criado_em timestamptz not null default now()
);

create table if not exists public.config (
  id    text primary key,
  dados jsonb not null default '{}'::jsonb
);

-- Liberado = e-mail na lista E (verificação em duas etapas feita, ou a pessoa
-- não usa duas etapas e o escritório não exige)
create or replace function public.autorizado()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.acesso where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or (
         not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
         and coalesce((select (dados ->> 'mfaObrigatorio')::boolean from public.config where id = 'geral'), false) = false
       )
     );
$$;
revoke all on function public.autorizado() from public, anon;
grant execute on function public.autorizado() to authenticated;

-- Diz ao sistema o que falta para a pessoa entrar
create or replace function public.estado_acesso()
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  e text := lower(coalesce(auth.jwt() ->> 'email', ''));
  tem boolean;
  obrig boolean;
begin
  if not exists (select 1 from public.acesso where lower(email) = e) then return 'sem_permissao'; end if;
  select exists (select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified') into tem;
  if tem and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then return 'codigo'; end if;
  select coalesce((dados ->> 'mfaObrigatorio')::boolean, false) into obrig from public.config where id = 'geral';
  if not tem and coalesce(obrig, false) then return 'cadastrar_mfa'; end if;
  return 'ok';
end $$;
revoke all on function public.estado_acesso() from public, anon;
grant execute on function public.estado_acesso() to authenticated;

-- ---------------------------------------------------------------------
-- Tabelas principais (cada registro guarda seus campos em "dados")
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['equipe','clientes','processos','prazos','tarefas','honorarios','documentos','eventos','juri','modelos'] loop
    execute format('create table if not exists public.%I (
      id            uuid primary key default gen_random_uuid(),
      dados         jsonb not null default ''{}''::jsonb,
      criado_em     timestamptz not null default now(),
      atualizado_em timestamptz not null default now())', t);
  end loop;
end $$;

-- Intimações encontradas pelo robô no DJEN
create table if not exists public.intimacoes (
  hash                  text primary key,
  djen_id               text,
  origem                text,
  oab                   text,
  cliente_id            uuid,
  responsavel_id        uuid,
  numero                text,
  tribunal              text,
  orgao                 text,
  classe                text,
  tipo                  text,
  tipo_documento        text,
  data_disponibilizacao date,
  texto                 text,
  link                  text,
  partes                text,
  ultima_mov            text,
  ultima_mov_data       timestamptz,
  status                text not null default 'nova',
  processo_id           uuid,
  bruto                 jsonb,
  criado_em             timestamptz not null default now()
);
create index if not exists intimacoes_data_idx on public.intimacoes (data_disponibilizacao desc);

-- Última movimentação de cada processo (DataJud / CNJ)
create table if not exists public.movimentacoes (
  numero        text primary key,
  nome          text,
  data          timestamptz,
  classe        text,
  orgao         text,
  atualizado_em timestamptz not null default now()
);

-- Aparelhos que recebem notificação no celular
create table if not exists public.push (
  endpoint   text primary key,
  email      text,
  membro_id  uuid,
  assinatura jsonb not null,
  aparelho   text,
  criado_em  timestamptz not null default now()
);

-- Links para o cliente enviar documentos
create table if not exists public.envios (
  token      uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  itens      jsonb not null default '[]'::jsonb,
  criado_por text,
  criado_em  timestamptz not null default now(),
  expira     timestamptz not null default now() + interval '30 days',
  ativo      boolean not null default true
);
create table if not exists public.envios_arquivos (
  id            bigint generated always as identity primary key,
  token         uuid not null,
  cliente_id    uuid not null,
  item          text,
  rotulo        text,
  caminho       text not null,
  nome_original text,
  tamanho       bigint,
  status        text not null default 'novo',
  notificado    boolean not null default false,
  criado_em     timestamptz not null default now()
);
create index if not exists envios_arquivos_cliente_idx on public.envios_arquivos (cliente_id, criado_em desc);

-- ---------------------------------------------------------------------
-- Histórico: quem criou, alterou ou excluiu o quê (não pode ser apagado pelo sistema)
-- ---------------------------------------------------------------------
create table if not exists public.historico (
  id          bigint generated always as identity primary key,
  quando      timestamptz not null default now(),
  usuario     text,
  acao        text,
  tabela      text,
  registro_id text,
  titulo      text,
  campos      text[],
  antes       jsonb
);
create index if not exists historico_quando_idx on public.historico (quando desc);
create index if not exists historico_registro_idx on public.historico (tabela, registro_id);

create or replace function public.registrar_historico()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  quem text := coalesce(auth.jwt() ->> 'email', 'robô / sistema');
  d jsonb;
  tit text;
  mud text[];
  ult bigint;
begin
  d := case when tg_op = 'DELETE' then old.dados else new.dados end;
  tit := coalesce(d ->> 'nome', d ->> 'titulo', d ->> 'descricao', d ->> 'numero', d ->> 'reus', d ->> 'objeto', '');
  if tg_op = 'DELETE' then
    insert into historico (usuario, acao, tabela, registro_id, titulo, antes)
    values (quem, 'excluiu', tg_table_name, old.id::text, left(tit, 200), to_jsonb(old));
    return old;
  elsif tg_op = 'INSERT' then
    insert into historico (usuario, acao, tabela, registro_id, titulo)
    values (quem, 'criou', tg_table_name, new.id::text, left(tit, 200));
    return new;
  end if;
  select array_agg(k) into mud from (
    select key as k from jsonb_each(new.dados) where (old.dados -> key) is distinct from value
    union
    select key from jsonb_each(old.dados) where not (new.dados ? key)
  ) s;
  if mud is null then return new; end if;
  -- várias alterações seguidas da mesma pessoa no mesmo registro viram uma linha só (10 min)
  select id into ult from historico
   where tabela = tg_table_name and registro_id = new.id::text and usuario = quem and acao = 'alterou'
     and quando > now() - interval '10 minutes'
   order by id desc limit 1;
  if ult is not null then
    update historico set campos = (select array(select distinct unnest(coalesce(campos, '{}') || mud))), quando = now(), titulo = left(tit, 200)
     where id = ult;
    return new;
  end if;
  insert into historico (usuario, acao, tabela, registro_id, titulo, campos, antes)
  values (quem, 'alterou', tg_table_name, new.id::text, left(tit, 200), mud,
          (select jsonb_object_agg(k, case when length(coalesce(old.dados -> k, 'null'::jsonb)::text) > 2000 then '"(texto longo)"'::jsonb else old.dados -> k end) from unnest(mud) k));
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['equipe','clientes','processos','prazos','tarefas','honorarios','documentos','eventos','juri','modelos','config'] loop
    execute format('drop trigger if exists historico on public.%I', t);
    execute format('create trigger historico after insert or update or delete on public.%I for each row execute function public.registrar_historico()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Segurança: ninguém lê nem grava sem estar logado E autorizado
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['equipe','clientes','processos','prazos','tarefas','honorarios','documentos','eventos','juri','modelos','config','intimacoes','movimentacoes','acesso','push','envios','envios_arquivos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists escritorio on public.%I', t);
    execute format('create policy escritorio on public.%I for all to authenticated using (public.autorizado()) with check (public.autorizado())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- histórico: a equipe só lê e acrescenta; ninguém altera nem apaga
alter table public.historico enable row level security;
drop policy if exists ler on public.historico;
drop policy if exists registrar on public.historico;
create policy ler on public.historico for select to authenticated using (public.autorizado());
create policy registrar on public.historico for insert to authenticated with check (public.autorizado() and acao in ('viu senha gov.br', 'copiou senha gov.br', 'restaurou'));
revoke all on public.historico from anon, authenticated;
grant select, insert on public.historico to authenticated;

-- ---------------------------------------------------------------------
-- Envio de documentos pelo cliente (página pública com link)
-- ---------------------------------------------------------------------
create or replace function public.token_envio_valido(p text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.envios e where e.token::text = p and e.ativo and e.expira > now());
$$;
grant execute on function public.token_envio_valido(text) to anon, authenticated;

create or replace function public.envio_info(p_token uuid)
returns json
language sql stable security definer
set search_path = public
as $$
  select json_build_object(
    'cliente', split_part(coalesce(c.dados ->> 'nome', ''), ' ', 1),
    'escritorio', coalesce((select dados ->> 'nome' from public.config where id = 'geral'), 'Palha Novaes Advocacia'),
    'expira', e.expira,
    'itens', e.itens,
    'enviados', coalesce((select json_agg(json_build_object('item', a.item, 'rotulo', a.rotulo, 'quando', a.criado_em) order by a.id)
                          from public.envios_arquivos a where a.token = e.token), '[]'::json))
  from public.envios e
  left join public.clientes c on c.id = e.cliente_id
  where e.token = p_token and e.ativo and e.expira > now();
$$;
grant execute on function public.envio_info(uuid) to anon, authenticated;

create or replace function public.envio_registrar(p_token uuid, p_item text, p_rotulo text, p_caminho text, p_nome text, p_tamanho bigint)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare cli uuid;
begin
  select cliente_id into cli from public.envios where token = p_token and ativo and expira > now();
  if cli is null then return false; end if;
  if p_caminho not like p_token::text || '/%' then return false; end if;
  if (select count(*) from public.envios_arquivos where token = p_token) >= 80 then return false; end if;
  insert into public.envios_arquivos (token, cliente_id, item, rotulo, caminho, nome_original, tamanho)
  values (p_token, cli, left(p_item, 60), left(p_rotulo, 200), p_caminho, left(p_nome, 200), p_tamanho);
  return true;
end $$;
grant execute on function public.envio_registrar(uuid, text, text, text, text, bigint) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Pastas de arquivos (todas privadas)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('envios', 'envios', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

drop policy if exists arquivos_escritorio on storage.objects;
create policy arquivos_escritorio on storage.objects
  for all to authenticated
  using (bucket_id in ('arquivos', 'envios') and public.autorizado())
  with check (bucket_id in ('arquivos', 'envios') and public.autorizado());

drop policy if exists backups_ler on storage.objects;
create policy backups_ler on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and public.autorizado());

-- o cliente (sem login) só consegue ENVIAR para a pasta do próprio link válido; não lê nada
drop policy if exists envios_cliente on storage.objects;
create policy envios_cliente on storage.objects
  for insert to anon
  with check (bucket_id = 'envios' and public.token_envio_valido((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------
-- Atualização ao vivo entre a equipe
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['equipe','clientes','processos','prazos','tarefas','honorarios','documentos','eventos','juri','modelos','config','intimacoes','movimentacoes','envios_arquivos'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- >>> adv.romulonovaes2@gmail.com <<<
insert into public.acesso (email) values ('SEU-EMAIL-AQUI@gmail.com')
on conflict do nothing;
