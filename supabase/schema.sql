-- Friday AI Assistant — Supabase schema
-- Run this in the Supabase Dashboard → SQL Editor.
-- All tables are RLS-protected: users can only see their own rows.

-- ---------- Tasks ----------
create table if not exists public.tasks (
  id              text primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  title           text not null,
  task_date       text not null,
  start_time      text,
  end_time        text,
  status          text not null default 'scheduled',
  task_type       text not null default 'task',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  description     text,
  category        text,
  priority        text,
  tags            text[],
  is_flexible     boolean,
  interruption_reason text,
  interrupted_at  timestamptz,
  estimated_return_minutes integer,
  original_start_time text,
  original_end_time    text
);

-- ---------- Archive ----------
create table if not exists public.archive_folders (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  category    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  color       text,
  icon        text
);

create table if not exists public.archive_items (
  id            text primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  folder_id     text references public.archive_folders (id) on delete cascade,
  title         text not null,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  is_long_term  boolean,
  tags          text[]
);

-- ---------- Subscriptions ----------
create table if not exists public.user_subscriptions (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  tier                    text not null default 'free',
  is_active               boolean not null default false,
  expires_at              timestamptz,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  updated_at              timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.tasks               enable row level security;
alter table public.archive_folders     enable row level security;
alter table public.archive_items       enable row level security;
alter table public.user_subscriptions  enable row level security;

-- Users can CRUD only their own rows
create policy "own_tasks"  on public.tasks  for all using (auth.uid() = user_id);
create policy "own_folders" on public.archive_folders for all using (auth.uid() = user_id);
create policy "own_items"  on public.archive_items for all using (auth.uid() = user_id);
create policy "own_subs"   on public.user_subscriptions for all using (auth.uid() = user_id);

-- ---------- Updated_at trigger ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  for t in select unnest(array['tasks','archive_folders','archive_items','user_subscriptions'])
  loop
    execute format(
      'drop trigger if exists trg_%I on public.%I; create trigger trg_%I before update on public.%I for each row execute function public.touch_updated_at();',
      t, t, t, t
    );
  end loop;
end $$;
