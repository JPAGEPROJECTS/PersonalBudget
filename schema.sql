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

-- Ingresos extra de cada quincena (bonos, ventas…)
create table if not exists public.ingresos (
  id           uuid primary key default gen_random_uuid(),
  periodo_id   uuid not null references public.periodos(id) on delete cascade,
  descripcion  text not null,
  monto        numeric(12,2) not null default 0,
  created_at   timestamptz not null default now()
);

-- Metas de ahorro (fondo de emergencia, viaje…)
create table if not exists public.metas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  objetivo       numeric(12,2) not null default 0,
  saldo_inicial  numeric(12,2) not null default 0,
  fecha_meta     date,                    -- fecha para lograrla (opcional)
  created_at     timestamptz not null default now()
);

-- Aportes o retiros manuales a una meta
create table if not exists public.meta_movs (
  id          uuid primary key default gen_random_uuid(),
  meta_id     uuid not null references public.metas(id) on delete cascade,
  monto       numeric(12,2) not null,
  nota        text,
  created_at  timestamptz not null default now()
);

-- Dinero que te deben (préstamos a otras personas)
create table if not exists public.prestamos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,              -- persona
  saldo_inicial  numeric(12,2) not null default 0,
  nota           text,
  created_at     timestamptz not null default now()
);

-- Más préstamos (+) o devoluciones (−) registrados a mano
create table if not exists public.prestamo_movs (
  id           uuid primary key default gen_random_uuid(),
  prestamo_id  uuid not null references public.prestamos(id) on delete cascade,
  monto        numeric(12,2) not null,
  nota         text,
  created_at   timestamptz not null default now()
);

-- Columnas nuevas (v2)
alter table public.gastos add column if not exists vence      date;
alter table public.gastos add column if not exists categoria  text;
alter table public.gastos add column if not exists fijo       boolean not null default false;  -- se copia a cada quincena
alter table public.gastos add column if not exists meta_id    uuid references public.metas(id) on delete set null; -- aporte a una meta
alter table public.gastos add column if not exists frecuencia text not null default 'quincenal'
  check (frecuencia in ('quincenal', 'mensual'));          -- si es fijo: cada quincena o cada mes
alter table public.gastos   add column if not exists prestamo_id uuid references public.prestamos(id) on delete set null; -- le prestaste
alter table public.ingresos add column if not exists prestamo_id uuid references public.prestamos(id) on delete set null; -- te devolvió
alter table public.metas  add column if not exists rendimiento_pct  numeric(6,3) not null default 0; -- % mensual
alter table public.metas  add column if not exists aporte_quincenal numeric(12,2);  -- se agrega solo a cada quincena nueva
alter table public.deudas add column if not exists dia_corte   smallint check (dia_corte between 1 and 31);
alter table public.deudas add column if not exists dia_pago    smallint check (dia_pago between 1 and 31);
alter table public.deudas add column if not exists pago_minimo numeric(12,2);
alter table public.deudas add column if not exists interes_frec text not null default 'mensual'
  check (interes_frec in ('mensual', 'quincenal'));

create index if not exists gastos_periodo_idx on public.gastos(periodo_id);
create index if not exists gastos_meta_idx    on public.gastos(meta_id);
create index if not exists ingresos_periodo_idx on public.ingresos(periodo_id);
create index if not exists meta_movs_meta_idx on public.meta_movs(meta_id);
create index if not exists prestamo_movs_idx  on public.prestamo_movs(prestamo_id);
create index if not exists gastos_prestamo_idx on public.gastos(prestamo_id);
create index if not exists ingresos_prestamo_idx on public.ingresos(prestamo_id);
create index if not exists gastos_deuda_idx   on public.gastos(deuda_id);
create index if not exists cargos_deuda_idx   on public.deuda_cargos(deuda_id);
create index if not exists periodos_fecha_idx on public.periodos(fecha desc);

-- ---------- Acceso público (sin login) ----------
-- Cualquiera con la URL del proyecto y la clave pública puede leer y escribir.
do $$
declare t text;
begin
  foreach t in array array['periodos','deudas','gastos','deuda_cargos','ingresos','metas','meta_movs','prestamos','prestamo_movs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_rows" on public.%I', t);      -- versión anterior
    execute format('alter table public.%I drop column if exists user_id', t); -- versión anterior
    execute format('drop policy if exists "public_all" on public.%I', t);
    execute format(
      'create policy "public_all" on public.%I for all to anon, authenticated
         using (true) with check (true)', t);
  end loop;
end $$;

-- Refresca el caché de la API para que vea las columnas nuevas
notify pgrst, 'reload schema';
