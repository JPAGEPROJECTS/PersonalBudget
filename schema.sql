-- =========================================================
--  Presupuesto Quincenal - Esquema para Supabase (sin login)
--  Ejecutar en: Supabase > SQL Editor > New query > Run
--  Se puede ejecutar varias veces; también migra la versión anterior con login.
-- =========================================================

-- Quincenas (equivale a cada hoja del Excel)
create table if not exists public.periodos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  fecha       date not null,
  salario     numeric(12,2) not null default 0,
  nota        text,
  created_at  timestamptz not null default now()
);

-- Deudas (columna "Monto debt" del Excel)
create table if not exists public.deudas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  saldo_inicial  numeric(12,2) not null default 0,
  limite         numeric(12,2),           -- límite de crédito (opcional)
  meta           numeric(12,2),           -- p.ej. "REDUCIR A 1000$"
  interes_pct    numeric(6,3) not null default 0,  -- % de interés por aplicación
  activa         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Gastos de cada quincena
create table if not exists public.gastos (
  id           uuid primary key default gen_random_uuid(),
  periodo_id   uuid not null references public.periodos(id) on delete cascade,
  descripcion  text not null,
  monto        numeric(12,2) not null default 0,
  pagado       boolean not null default false,
  deuda_id     uuid references public.deudas(id) on delete set null, -- si es un abono a una deuda
  orden        int not null default 0,
  created_at   timestamptz not null default now()
);

-- Cargos a deudas (intereses, compras nuevas, ajustes)
create table if not exists public.deuda_cargos (
  id          uuid primary key default gen_random_uuid(),
  deuda_id    uuid not null references public.deudas(id) on delete cascade,
  monto       numeric(12,2) not null,
  nota        text,
  created_at  timestamptz not null default now()
);

create index if not exists gastos_periodo_idx on public.gastos(periodo_id);
create index if not exists gastos_deuda_idx   on public.gastos(deuda_id);
create index if not exists cargos_deuda_idx   on public.deuda_cargos(deuda_id);
create index if not exists periodos_fecha_idx on public.periodos(fecha desc);

-- ---------- Acceso público (sin login) ----------
-- Cualquiera con la URL del proyecto y la clave pública puede leer y escribir.
do $$
declare t text;
begin
  foreach t in array array['periodos','deudas','gastos','deuda_cargos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_rows" on public.%I', t);      -- versión anterior
    execute format('alter table public.%I drop column if exists user_id', t); -- versión anterior
    execute format('drop policy if exists "public_all" on public.%I', t);
    execute format(
      'create policy "public_all" on public.%I for all to anon, authenticated
         using (true) with check (true)', t);
  end loop;
end $$;
