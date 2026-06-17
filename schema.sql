-- ============================================================
-- AutoConhecimento.Bet — esquema do banco (rodar no Supabase)
-- SQL Editor > New query > colar tudo > Run
-- ============================================================

create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  name_key   text not null unique,          -- nome em minúsculas (login único)
  pin_hash   text not null,
  balance    numeric not null default 50,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists bets (
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
  result     text,                          -- HOME | DRAW | AWAY (preenchido ao resolver)
  created_at timestamptz not null default now()
);

create index if not exists bets_user_idx on bets(user_id);
create index if not exists bets_status_idx on bets(status);

-- As funções do servidor usam a SERVICE KEY (acesso total), então
-- deixamos o RLS desligado. Não exponha a service key no navegador.
alter table users disable row level security;
alter table bets  disable row level security;
