-- ============================================================
-- AutoConhecimento.Bet — esquema do banco (rodar no Supabase)
-- SQL Editor > New query > colar tudo > Run
-- ⚠️ Este script APAGA e recria as tabelas (reset).
-- ============================================================

drop table if exists bets;
drop table if exists users;

-- Perfil do jogador. O "id" é o mesmo do usuário do Supabase Auth.
create table users (
  id         uuid primary key,              -- = id do Supabase Auth
  name       text not null,                 -- nome de usuário (login, exibido)
  name_key   text not null unique,          -- nome em minúsculas (único)
  email      text,
  balance    numeric not null default 50,
  is_admin   boolean not null default false,
  confirmed  boolean not null default false,  -- vira true no 1º login (após confirmar e-mail)
  created_at timestamptz not null default now()
);

create table bets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  match_id   text not null,
  home_team  text not null,
  away_team  text not null,
  selection  text not null,                 -- HOME | DRAW | AWAY
  stake      numeric not null,
  odd        numeric not null,
  status     text not null default 'OPEN',  -- OPEN | WON | LOST
  payout     numeric not null default 0,
  result     text,
  created_at timestamptz not null default now()
);

create index if not exists bets_user_idx on bets(user_id);
create index if not exists bets_status_idx on bets(status);

-- As funções do servidor usam a SERVICE KEY (acesso total), então
-- deixamos o RLS desligado. Não exponha a service key no navegador.
alter table users disable row level security;
alter table bets  disable row level security;
