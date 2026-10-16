-- =====================================================================
-- Sebastián Alemán · Plataforma de afiliados
-- Esquema de base de datos para Supabase
-- Pégalo completo en: Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tablas ----------------------------------------------------

-- Usuarios con permisos de coach (Sebastián y, más adelante, otros coaches)
create table if not exists public.coaches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Ajustes de la marca (nombre, WhatsApp, mensajes). Una sola fila.
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Biblioteca de ejercicios con videos y puntos clave de técnica
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle text default '',
  video_url text default '',
  cues text default '',
  alternatives text default '',
  created_at timestamptz default now()
);

-- Afiliados. El programa y la nutrición viven en JSON para que el coach
-- pueda cambiarlos sin migraciones.
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  active boolean not null default true,
  profile jsonb not null default '{}'::jsonb,
  program jsonb not null default '{}'::jsonb,
  nutrition jsonb not null default '{}'::jsonb,
  anamnesis jsonb,
  coach_note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sesiones entrenadas (registro de series, sensaciones)
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  date date not null,
  day_index int not null,
  week int not null default 1,
  logs jsonb not null default '[]'::jsonb,
  feeling int,
  note text default '',
  completed boolean not null default false,
  created_at timestamptz default now(),
  unique (member_id, date, day_index)
);

-- Check-ins: semanal, ausencia justificada, salida del plan nutricional
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('weekly','absence','offplan')),
  date date not null default current_date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Medidas corporales tomadas por el afiliado o el coach
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  date date not null default current_date,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists sessions_member_idx on public.sessions(member_id, date desc);
create index if not exists checkins_member_idx on public.checkins(member_id, date desc);
create index if not exists measurements_member_idx on public.measurements(member_id, date desc);

-- ---------- Funciones auxiliares -------------------------------------

create or replace function public.is_coach() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where user_id = auth.uid());
$$;

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid() and active;
$$;

-- Estado de un código de acceso (lo usa la pantalla de ingreso)
create or replace function public.code_status(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when not active then 'paused'
                 when user_id is null then 'available'
                 else 'claimed' end
       from public.members where code = upper(trim(p_code))),
    'invalid');
$$;

-- El afiliado reclama su código la primera vez (ya autenticado)
create or replace function public.claim_member(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update public.members set user_id = auth.uid(), updated_at = now()
   where code = upper(trim(p_code)) and user_id is null and active
   returning id into v_id;
  if v_id is null then raise exception 'Código no disponible'; end if;
  return v_id;
end $$;

-- El afiliado guarda su anamnesis (no puede tocar su rutina ni nutrición)
create or replace function public.save_anamnesis(p jsonb) returns void
language sql security definer set search_path = public as $$
  update public.members set anamnesis = p, updated_at = now()
   where user_id = auth.uid() and active;
$$;

grant execute on function public.code_status(text) to anon, authenticated;
grant execute on function public.claim_member(text) to authenticated;
grant execute on function public.save_anamnesis(jsonb) to authenticated;
grant execute on function public.is_coach() to authenticated;
grant execute on function public.my_member_id() to authenticated;

-- ---------- Seguridad por filas (RLS) ---------------------------------

alter table public.coaches      enable row level security;
alter table public.settings     enable row level security;
alter table public.exercises    enable row level security;
alter table public.members      enable row level security;
alter table public.sessions     enable row level security;
alter table public.checkins     enable row level security;
alter table public.measurements enable row level security;

drop policy if exists coaches_self on public.coaches;
create policy coaches_self on public.coaches for select using (user_id = auth.uid());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all using (public.is_coach()) with check (public.is_coach());

drop policy if exists exercises_read on public.exercises;
create policy exercises_read on public.exercises for select using (auth.role() = 'authenticated');
drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises for all using (public.is_coach()) with check (public.is_coach());

drop policy if exists members_read on public.members;
create policy members_read on public.members for select
  using (public.is_coach() or (user_id = auth.uid() and active));
drop policy if exists members_write on public.members;
create policy members_write on public.members for all
  using (public.is_coach()) with check (public.is_coach());

-- Misma regla para las tres tablas del afiliado
do $$
declare t text;
begin
  foreach t in array array['sessions','checkins','measurements'] loop
    execute format('drop policy if exists %1$s_rw on public.%1$s', t);
    execute format($p$create policy %1$s_rw on public.%1$s for all
      using (public.is_coach() or member_id = public.my_member_id())
      with check (public.is_coach() or member_id = public.my_member_id())$p$, t);
  end loop;
end $$;

-- ---------- Datos iniciales -------------------------------------------

insert into public.settings (id, data) values (1, '{
  "brand": "Sebastián Alemán",
  "tagline": "El físico es la consecuencia. La disciplina es el método.",
  "whatsapp": "",
  "welcome": "Bienvenido al equipo. Aquí vas a encontrar tu plan hecho a tu medida. Yo estoy del otro lado acompañándote: si algo no sale, me cuentas y lo ajustamos.",
  "offplanTips": "Respira, no pasa nada. Una comida no define tu proceso.\nVuelve a tu plan en la siguiente comida, sin compensar con ayuno.\nSi te quedó hambre: tinto o aromática, gelatina sin azúcar, pepino o una arepa de maíz pequeña.\nToma 2 vasos de agua y prioriza proteína y verdura en lo que queda del día."
}'::jsonb) on conflict (id) do nothing;

-- =====================================================================
-- ÚLTIMO PASO (después de crear el usuario de Sebastián en
-- Authentication > Users > Add user): cambia el correo y ejecuta:
--
--   insert into public.coaches (user_id)
--   select id from auth.users where email = 'entrenador.sebastian1995@gmail.com';
-- =====================================================================
