-- =====================================================================
--  BARBEARIA APP — configuração completa da base de dados (Supabase)
--  Cola este ficheiro inteiro no SQL Editor do Supabase e clica em RUN.
--  É seguro executá-lo mais do que uma vez (é idempotente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

create table if not exists public.configuracoes (
  chave text primary key,
  valor text not null
);

create table if not exists public.barbeiros (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  foto_url      text,
  comissao_pct  numeric(5,2) not null default 40 check (comissao_pct between 0 and 100),
  hora_abertura time not null default '09:00',
  hora_fecho    time not null default '19:00',
  dias_trabalho int[] not null default '{1,2,3,4,5,6}',   -- 1=Segunda ... 7=Domingo
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create table if not exists public.servicos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  preco       numeric(8,2) not null check (preco >= 0),
  duracao_min int not null default 30 check (duracao_min > 0),
  ativo       boolean not null default true,
  ordem       int not null default 0,
  criado_em   timestamptz not null default now()
);

-- Perfis ligados ao login (Supabase Auth). role: owner | barbeiro | pendente
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  nome        text,
  telefone    text,
  role        text not null default 'pendente' check (role in ('owner','barbeiro','pendente')),
  barbeiro_id uuid references public.barbeiros(id) on delete set null,
  criado_em   timestamptz not null default now()
);

create table if not exists public.clientes (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  telefone        text unique,
  data_nascimento date,
  notas           text,
  criado_em       timestamptz not null default now()
);

create table if not exists public.marcacoes (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid references public.clientes(id) on delete set null,
  cliente_nome     text not null default 'Cliente sem marcação',
  cliente_telefone text,
  barbeiro_id      uuid not null references public.barbeiros(id) on delete cascade,
  servico_id       uuid references public.servicos(id) on delete set null,
  servico_nome     text,
  data             date not null,
  hora_inicio      time not null,
  duracao_min      int  not null,
  preco            numeric(8,2) not null,
  desconto_pct     numeric(5,2) not null default 0,
  comissao_pct     numeric(5,2) not null,
  comissao_valor   numeric(8,2) not null default 0,
  estado           text not null default 'marcado'
                   check (estado in ('marcado','concluido','faltou','cancelado')),
  encaixe          boolean not null default false,
  criado_em        timestamptz not null default now()
);
-- Quem cancelou a marcação: cliente | barbeiro | dono (preenchido automaticamente pelo trigger)
alter table public.marcacoes add column if not exists cancelado_por text;
do $$ begin
  alter table public.marcacoes add constraint marcacoes_cancelado_por_chk
    check (cancelado_por is null or cancelado_por in ('cliente','barbeiro','dono'));
exception when duplicate_object then null;
end $$;

create index if not exists marcacoes_data_idx on public.marcacoes (data, barbeiro_id);
create index if not exists marcacoes_tel_idx  on public.marcacoes (cliente_telefone);

create table if not exists public.bloqueios (
  id          uuid primary key default gen_random_uuid(),
  barbeiro_id uuid references public.barbeiros(id) on delete cascade,  -- null = todas as cadeiras
  data        date not null,
  hora_inicio time not null default '00:00',
  hora_fim    time not null default '23:59',
  motivo      text,
  criado_em   timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);

create table if not exists public.promocoes (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  descricao    text,
  desconto_pct numeric(5,2) not null default 10 check (desconto_pct > 0 and desconto_pct <= 100),
  servico_id   uuid references public.servicos(id) on delete cascade, -- null = todos os serviços
  data_inicio  date,
  data_fim     date,
  ativa        boolean not null default true,
  criado_em    timestamptz not null default now()
);

create table if not exists public.despesas (
  id         uuid primary key default gen_random_uuid(),
  descricao  text not null,
  categoria  text not null default 'Outros',
  valor      numeric(10,2) not null check (valor >= 0),
  data       date not null default current_date,
  criado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. FUNÇÕES AUXILIARES
-- ---------------------------------------------------------------------

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

create or replace function public.meu_barbeiro_id()
returns uuid language sql stable security definer set search_path = public as $$
  select barbeiro_id from public.profiles where id = auth.uid() and role = 'barbeiro';
$$;

-- Normaliza telefones: só dígitos e sem 00 inicial. A app envia sempre o número
-- internacional completo (indicativo + número), ex.: 245955123456.
create or replace function public.norm_tel(t text)
returns text language sql immutable as $$
  select nullif(regexp_replace(regexp_replace(coalesce(t,''), '\D', '', 'g'), '^00', ''), '');
$$;

create or replace function public.mins(t time)
returns int language sql immutable as $$
  select (extract(hour from t) * 60 + extract(minute from t))::int;
$$;

-- Colunas novas (para bases já criadas com a versão anterior)
alter table public.profiles add column if not exists nome text;
alter table public.profiles add column if not exists telefone text;

-- Primeiro utilizador registado passa a ser o DONO; os seguintes ficam "pendente"
-- até o dono os associar a um barbeiro (Painel do Dono > Equipa).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nome, telefone, role)
  values (
    new.id, new.email,
    nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    case when exists (select 1 from public.profiles where role = 'owner') then 'pendente' else 'owner' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Utilizadores que já existam antes de correr este script
insert into public.profiles (id, email, role)
select u.id, u.email, 'pendente' from auth.users u
on conflict (id) do nothing;

-- Preenche nome/telefone a partir dos metadados do Auth (user_metadata)
update public.profiles p
   set nome     = coalesce(p.nome,     nullif(trim(u.raw_user_meta_data ->> 'nome'), '')),
       telefone = coalesce(p.telefone, nullif(trim(u.raw_user_meta_data ->> 'telefone'), ''))
  from auth.users u
 where u.id = p.id;

update public.profiles set role = 'owner'
where id = (select u.id from auth.users u order by u.created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'owner');

-- ---------------------------------------------------------------------
-- 3. TRIGGER DAS MARCAÇÕES (preenche preço/duração/comissão, cria cliente)
-- ---------------------------------------------------------------------

create or replace function public.marcacoes_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.servicos%rowtype;
  b public.barbeiros%rowtype;
  cid uuid;
begin
  if tg_op = 'INSERT' then
    select * into s from public.servicos where id = new.servico_id;
    if found then
      new.servico_nome := coalesce(new.servico_nome, s.nome);
      new.duracao_min  := coalesce(new.duracao_min, s.duracao_min);
      new.preco        := coalesce(new.preco, s.preco);
    end if;
    new.duracao_min := coalesce(new.duracao_min, 30);
    new.preco       := coalesce(new.preco, 0);

    select * into b from public.barbeiros where id = new.barbeiro_id;
    new.comissao_pct := coalesce(new.comissao_pct, b.comissao_pct, 0);

    new.cliente_telefone := public.norm_tel(new.cliente_telefone);
    if new.cliente_id is null and new.cliente_telefone is not null then
      insert into public.clientes (nome, telefone)
      values (new.cliente_nome, new.cliente_telefone)
      on conflict (telefone) do update set nome = public.clientes.nome
      returning id into cid;
      new.cliente_id := cid;
    end if;
  elsif tg_op = 'UPDATE' and auth.uid() is not null and not public.is_owner() then
    -- barbeiros só podem alterar o estado (concluído / faltou / ...)
    new.preco          := old.preco;
    new.desconto_pct   := old.desconto_pct;
    new.comissao_pct   := old.comissao_pct;
    new.barbeiro_id    := old.barbeiro_id;
    new.servico_id     := old.servico_id;
    new.data           := old.data;
    new.hora_inicio    := old.hora_inicio;
    new.cliente_id     := old.cliente_id;
  end if;

  -- Regista QUEM cancelou (não pode ser forjado pelo cliente da API):
  --  cliente  = função cancelar_marcacao (página pública)
  --  dono     = utilizador com papel owner
  --  barbeiro = qualquer outro utilizador autenticado
  if tg_op = 'UPDATE' and new.estado = 'cancelado' and old.estado <> 'cancelado' then
    new.cancelado_por := coalesce(
      nullif(current_setting('app.cancelado_por', true), ''),
      case when auth.uid() is null then null
           when public.is_owner() then 'dono'
           else 'barbeiro' end);
  elsif tg_op = 'UPDATE' and new.estado = 'cancelado' then
    new.cancelado_por := old.cancelado_por;
  elsif new.estado <> 'cancelado' then
    new.cancelado_por := null;
  end if;

  new.comissao_valor := case when new.estado = 'concluido'
                             then round(new.preco * new.comissao_pct / 100, 0) else 0 end;
  return new;
end $$;

drop trigger if exists trg_marcacoes_before on public.marcacoes;
create trigger trg_marcacoes_before
  before insert or update on public.marcacoes
  for each row execute function public.marcacoes_before();

-- ---------------------------------------------------------------------
-- 4. FUNÇÕES PÚBLICAS (usadas pela App do Cliente, sem login)
-- ---------------------------------------------------------------------

-- Horários ocupados de um barbeiro num dia (marcações + bloqueios)
create or replace function public.horarios_ocupados(p_barbeiro uuid, p_data date)
returns table (hora_inicio time, duracao_min int)
language sql stable security definer set search_path = public as $$
  select m.hora_inicio, m.duracao_min
  from public.marcacoes m
  where m.barbeiro_id = p_barbeiro and m.data = p_data and m.estado in ('marcado','concluido')
  union all
  select k.hora_inicio, (public.mins(k.hora_fim) - public.mins(k.hora_inicio))
  from public.bloqueios k
  where (k.barbeiro_id is null or k.barbeiro_id = p_barbeiro) and k.data = p_data;
$$;

-- Cria uma marcação (valida tudo no servidor, evita marcações duplicadas)
create or replace function public.criar_marcacao(
  p_servico uuid, p_barbeiro uuid, p_data date, p_hora time,
  p_nome text, p_telefone text, p_nascimento date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s public.servicos%rowtype;
  b public.barbeiros%rowtype;
  tel text := public.norm_tel(p_telefone);
  hoje date := (now() at time zone 'Europe/Lisbon')::date;
  agora time := (now() at time zone 'Europe/Lisbon')::time;
  disc numeric := 0;
  ini int := public.mins(p_hora);
  novo uuid;
begin
  if p_nome is null or length(trim(p_nome)) < 2 then
    raise exception 'Indique o seu nome.';
  end if;
  if tel is null or length(tel) < 9 then
    raise exception 'Indique um número de WhatsApp válido.';
  end if;

  select * into s from public.servicos where id = p_servico and ativo;
  if not found then raise exception 'Serviço indisponível.'; end if;
  select * into b from public.barbeiros where id = p_barbeiro and ativo;
  if not found then raise exception 'Barbeiro indisponível.'; end if;

  if p_data < hoje or (p_data = hoje and p_hora <= agora) then
    raise exception 'Esse horário já passou.';
  end if;
  if not (extract(isodow from p_data)::int = any (b.dias_trabalho)) then
    raise exception 'O barbeiro não trabalha nesse dia.';
  end if;
  if ini < public.mins(b.hora_abertura) or ini + s.duracao_min > public.mins(b.hora_fecho) then
    raise exception 'Horário fora do período de funcionamento.';
  end if;

  if (select count(*) from public.marcacoes
      where cliente_telefone = tel and estado = 'marcado'
        and (data > hoje or (data = hoje and hora_inicio > agora))) >= 5 then
    raise exception 'Já tem demasiadas marcações ativas. Cancele alguma primeiro.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_barbeiro::text || p_data::text));

  if exists (
    select 1 from public.horarios_ocupados(p_barbeiro, p_data) o
    where public.mins(o.hora_inicio) < ini + s.duracao_min
      and ini < public.mins(o.hora_inicio) + o.duracao_min
  ) then
    raise exception 'Esse horário acabou de ser ocupado. Escolha outro.';
  end if;

  select coalesce(max(desconto_pct), 0) into disc
  from public.promocoes
  where ativa
    and (data_inicio is null or p_data >= data_inicio)
    and (data_fim is null or p_data <= data_fim)
    and (servico_id is null or servico_id = p_servico);

  insert into public.marcacoes
    (cliente_nome, cliente_telefone, barbeiro_id, servico_id, data, hora_inicio,
     duracao_min, preco, desconto_pct)
  values
    (trim(p_nome), tel, p_barbeiro, p_servico, p_data, p_hora,
     s.duracao_min, round(s.preco * (1 - disc / 100), 0), disc)
  returning id into novo;

  update public.clientes
     set data_nascimento = coalesce(p_nascimento, data_nascimento)
   where telefone = tel;

  return novo;
end $$;

-- Marcações de um cliente (identificado pelo WhatsApp)
create or replace function public.minhas_marcacoes(p_telefone text)
returns table (
  id uuid, data date, hora_inicio time, duracao_min int, estado text,
  preco numeric, servico_nome text, barbeiro_nome text
)
language sql stable security definer set search_path = public as $$
  select m.id, m.data, m.hora_inicio, m.duracao_min, m.estado, m.preco,
         coalesce(m.servico_nome, 'Serviço'), b.nome
  from public.marcacoes m
  join public.barbeiros b on b.id = m.barbeiro_id
  where m.cliente_telefone = public.norm_tel(p_telefone)
    and m.data >= (now() at time zone 'Europe/Lisbon')::date - 60
  order by m.data desc, m.hora_inicio desc
  limit 50;
$$;

-- Cancelamento pelo próprio cliente
create or replace function public.cancelar_marcacao(p_id uuid, p_telefone text)
returns void language plpgsql security definer set search_path = public as $$
declare
  hoje date := (now() at time zone 'Europe/Lisbon')::date;
  agora time := (now() at time zone 'Europe/Lisbon')::time;
begin
  perform set_config('app.cancelado_por', 'cliente', true);
  update public.marcacoes
     set estado = 'cancelado'
   where id = p_id
     and cliente_telefone = public.norm_tel(p_telefone)
     and estado = 'marcado'
     and (data > hoje or (data = hoje and hora_inicio > agora));
  if not found then
    raise exception 'Não foi possível cancelar esta marcação.';
  end if;
end $$;

-- Cartão de fidelidade digital
create or replace function public.cartao_fidelidade(p_telefone text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  tel text := public.norm_tel(p_telefone);
  meta int := coalesce((select valor::int from public.configuracoes where chave = 'cortes_brinde'), 10);
  n int;
  nm text;
begin
  select count(*) into n from public.marcacoes where cliente_telefone = tel and estado = 'concluido';
  select nome into nm from public.clientes where telefone = tel;
  return json_build_object(
    'nome', nm, 'cortes', n, 'meta', meta,
    'progresso', n % meta, 'gratis', n / meta
  );
end $$;

grant execute on function public.horarios_ocupados(uuid, date) to anon, authenticated;
grant execute on function public.criar_marcacao(uuid, uuid, date, time, text, text, date) to anon, authenticated;
grant execute on function public.minhas_marcacoes(text) to anon, authenticated;
grant execute on function public.cancelar_marcacao(uuid, text) to anon, authenticated;
grant execute on function public.cartao_fidelidade(text) to anon, authenticated;

-- Vista pública dos barbeiros (sem comissões)
create or replace view public.barbeiros_publico as
  select id, nome, foto_url, hora_abertura, hora_fecho, dias_trabalho
  from public.barbeiros where ativo;

-- ---------------------------------------------------------------------
-- 5. SEGURANÇA (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.configuracoes enable row level security;
alter table public.barbeiros     enable row level security;
alter table public.servicos      enable row level security;
alter table public.profiles      enable row level security;
alter table public.clientes      enable row level security;
alter table public.marcacoes     enable row level security;
alter table public.bloqueios     enable row level security;
alter table public.promocoes     enable row level security;
alter table public.despesas      enable row level security;

-- Remove políticas antigas (para poder re-executar)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
           and tablename in ('configuracoes','barbeiros','servicos','profiles','clientes',
                             'marcacoes','bloqueios','promocoes','despesas')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Configurações: todos leem, só o dono altera
create policy cfg_select on public.configuracoes for select using (true);
create policy cfg_owner  on public.configuracoes for all using (public.is_owner()) with check (public.is_owner());

-- Serviços: público lê os ativos, dono gere
create policy serv_select on public.servicos for select using (ativo or public.is_owner());
create policy serv_owner  on public.servicos for all using (public.is_owner()) with check (public.is_owner());

-- Barbeiros (tabela completa): dono vê todos, barbeiro vê o seu
create policy barb_select on public.barbeiros for select
  using (public.is_owner() or id = public.meu_barbeiro_id());
create policy barb_owner  on public.barbeiros for all using (public.is_owner()) with check (public.is_owner());

-- Perfis: cada um vê o seu, o dono vê e altera todos
create policy prof_select on public.profiles for select using (id = auth.uid() or public.is_owner());
create policy prof_owner  on public.profiles for update using (public.is_owner()) with check (public.is_owner());
create policy prof_delete on public.profiles for delete using (public.is_owner());

-- Clientes: só o dono
create policy cli_owner on public.clientes for all using (public.is_owner()) with check (public.is_owner());

-- Marcações: dono tudo; barbeiro só as suas
create policy marc_owner on public.marcacoes for all using (public.is_owner()) with check (public.is_owner());
create policy marc_barb_select on public.marcacoes for select using (barbeiro_id = public.meu_barbeiro_id());
create policy marc_barb_insert on public.marcacoes for insert with check (barbeiro_id = public.meu_barbeiro_id());
create policy marc_barb_update on public.marcacoes for update
  using (barbeiro_id = public.meu_barbeiro_id()) with check (barbeiro_id = public.meu_barbeiro_id());

-- Bloqueios: dono gere; barbeiros veem os seus e os gerais
create policy bloq_owner  on public.bloqueios for all using (public.is_owner()) with check (public.is_owner());
create policy bloq_barb   on public.bloqueios for select
  using (barbeiro_id is null or barbeiro_id = public.meu_barbeiro_id());

-- Promoções: público vê as ativas, dono gere
create policy promo_select on public.promocoes for select
  using (public.is_owner() or (ativa
         and (data_fim is null or data_fim >= (now() at time zone 'Europe/Lisbon')::date)));
create policy promo_owner  on public.promocoes for all using (public.is_owner()) with check (public.is_owner());

-- Despesas: só o dono
create policy desp_owner on public.despesas for all using (public.is_owner()) with check (public.is_owner());

-- Permissões de tabela
revoke all on public.marcacoes, public.clientes, public.bloqueios, public.despesas,
              public.profiles, public.barbeiros from anon;
grant select on public.servicos, public.promocoes, public.configuracoes to anon;
grant select on public.barbeiros_publico to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------
-- 6. TEMPO REAL
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['servicos','barbeiros','marcacoes','bloqueios','promocoes',
                           'clientes','despesas','profiles','configuracoes']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 7. DADOS INICIAIS DE EXEMPLO
-- ---------------------------------------------------------------------

insert into public.configuracoes (chave, valor) values
  ('nome_barbearia', 'Barbearia Premium'),
  ('morada',         'Rua Exemplo 123, Lisboa'),
  ('whatsapp',       '351912345678'),
  ('cortes_brinde',  '10'),
  ('ddi_padrao',     '245')
on conflict (chave) do nothing;

insert into public.servicos (nome, descricao, preco, duracao_min, ordem)
select * from (values
  ('Corte Clássico',  'Corte à tesoura ou máquina com acabamento a navalha', 3000, 30, 1),
  ('Degradê',         'Fade moderno com transição suave e finalização',       3500, 45, 2),
  ('Barba',           'Aparar e desenhar barba com toalha quente',            2000, 30, 3),
  ('Corte + Barba',   'O combo completo: cabelo e barba',                     5000, 60, 4),
  ('Corte Infantil',  'Até aos 10 anos',                                      2000, 30, 5),
  ('Sobrancelha',     'Limpeza e desenho a navalha',                           1000, 15, 6)
) as v(nome, descricao, preco, duracao_min, ordem)
where not exists (select 1 from public.servicos);

-- Migração: se os serviços de exemplo ainda tiverem os preços antigos (em euros), passam a FCFA.
update public.servicos set preco = case nome
    when 'Corte Clássico' then 3000 when 'Degradê' then 3500 when 'Barba' then 2000
    when 'Corte + Barba' then 5000 when 'Corte Infantil' then 2000 when 'Sobrancelha' then 1000 end
 where (nome, preco) in (('Corte Clássico',15.00),('Degradê',17.00),('Barba',10.00),
                         ('Corte + Barba',25.00),('Corte Infantil',10.00),('Sobrancelha',5.00));

insert into public.barbeiros (nome, comissao_pct, hora_abertura, hora_fecho, dias_trabalho)
select * from (values
  ('Miguel Santos', 40.00, '09:00'::time, '19:00'::time, '{1,2,3,4,5,6}'::int[]),
  ('Rui Ferreira',  45.00, '10:00'::time, '20:00'::time, '{2,3,4,5,6}'::int[])
) as v(nome, comissao_pct, hora_abertura, hora_fecho, dias_trabalho)
where not exists (select 1 from public.barbeiros);

insert into public.promocoes (titulo, descricao, desconto_pct, data_inicio, data_fim)
select 'Semana de Boas-Vindas', '15% de desconto em todos os serviços para novos clientes', 15,
       current_date, current_date + 30
where not exists (select 1 from public.promocoes);

-- =====================================================================
--  PRÓXIMOS PASSOS
--  1) Abre a app em /entrar e CRIA CONTA com o teu email: o primeiro
--     registo torna-se automaticamente o DONO. (Se o Supabase pedir
--     confirmação de email, confirma-o; ou desativa em
--     Authentication > Providers > Email > "Confirm email".)
--  2) Cada barbeiro cria a sua conta em /entrar. No Painel do Dono >
--     Equipa associas a conta ao barbeiro correspondente.
-- =====================================================================
