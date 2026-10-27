-- MEGANS ELECTRIC v2 - esquema para Supabase (PostgreSQL). NO se ha creado ningun proyecto: este archivo es para cuando se decida migrar.
-- Roles: admin (todo), coadmin (ve y edita; no borra ni cambia precios), vendedor (solo vende; sin costos, sin anular).
-- Los TRES roles venden igual. Administración puede registrar una venta a nombre de otro vendedor (registrado_por = quien la registró).
-- Regla de oro: nada se borra. No existe ninguna politica DELETE; anular y devolver crean registros nuevos.

create extension if not exists pgcrypto;

-- ---------- Perfiles y rol ----------
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete restrict,
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  nombre text not null check (char_length(nombre) between 2 and 80),
  rol text not null check (rol in ('admin','coadmin','vendedor')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create or replace function public.rol_actual() returns text
language sql stable security definer set search_path = public as
$$ select rol from public.perfiles where id = auth.uid() and activo $$;
create or replace function public.es_admin() returns boolean language sql stable as $$ select public.rol_actual() = 'admin' $$;
create or replace function public.es_gestion() returns boolean language sql stable as $$ select public.rol_actual() in ('admin','coadmin') $$;
create or replace function public.es_personal() returns boolean language sql stable as $$ select public.rol_actual() is not null $$;

-- ---------- Catalogo (el costo vive aparte: los vendedores no lo ven) ----------
create table public.productos (
  id text primary key,
  nombre text not null check (char_length(nombre) between 2 and 120),
  categoria text not null,
  precio numeric(12,2) not null default 0 check (precio >= 0),
  stock numeric(12,3) not null default 0 check (stock >= 0),
  minimo integer not null default 0 check (minimo >= 0),
  decimales boolean not null default false,  -- permite cantidades con decimales (p. ej. metro)
  codigo text unique,  -- código interno Code128 para etiquetas y escaneo
  activo boolean not null default true
);
create table public.productos_costos (
  producto_id text primary key references public.productos(id),
  costo numeric(12,2) not null default 0 check (costo >= 0)
);

-- ---------- Ventas (la guia de venta) ----------
create table public.ventas (
  id text primary key,                       -- G001-000001
  fecha date not null,
  hora time not null,
  vendedor_id uuid not null references public.perfiles(id),
  cliente text not null check (char_length(btrim(cliente)) >= 2),  -- obligatorio en todas las ventas
  telefono text,
  medio text not null check (medio in ('Efectivo','Yape','Plin','Pendiente')),
  estado text not null default 'Activa' check (estado in ('Activa','Anulada')),
  total numeric(12,2) not null check (total >= 0),
  estado_cobro text not null default 'Cobrado' check (estado_cobro in ('Cobrado','Parcial','Pendiente','Anulada')),
  registrado_por uuid not null default auth.uid() references public.perfiles(id),
  foto_ruta text,                            -- foto de la venta (JPEG comprimido) en el bucket privado "fotos"
  firma_ruta text,                           -- ruta en el bucket privado "firmas"
  datos jsonb not null default '{}'::jsonb,  -- lineas, historial, codigo de verificacion
  creado_en timestamptz not null default now()
);
create index on public.ventas (fecha, vendedor_id);
create table public.venta_items (
  id bigint generated always as identity primary key,
  venta_id text not null references public.ventas(id),
  producto_id text not null references public.productos(id),
  cantidad numeric(12,3) not null check (cantidad > 0),
  foto_ruta text,  -- foto opcional de la línea
  precio numeric(12,2) not null check (precio >= 0),
  precio_lista numeric(12,2),                -- precio de lista al momento de vender (si se editó en mostrador)
  detalle text,                              -- "Qué se vendió" para el producto Otros (no mueve stock)
  costo numeric(12,2),                       -- solo lo leen admin y coadmin (ver vista)
  agregado_por uuid references public.perfiles(id),
  agregado_en timestamptz not null default now()
);
create table public.ventas_historial (       -- quien, cuando y que (agregados, cobros, firmas, anulaciones)
  id bigint generated always as identity primary key,
  venta_id text not null references public.ventas(id),
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  quien uuid not null references public.perfiles(id),
  cuando timestamptz not null default now()
);
create table public.devoluciones (
  id text primary key,
  venta_id text not null references public.ventas(id),
  items jsonb not null, motivo text not null check (char_length(motivo) >= 3),
  monto numeric(12,2) not null, reingresa boolean not null default true, foto_ruta text,
  quien uuid not null references public.perfiles(id), cuando timestamptz not null default now()
);

-- ---------- Inventario ----------
create table public.movimientos (
  id text primary key,
  producto_id text not null references public.productos(id),
  tipo text not null check (tipo in ('venta','devolucion','ingreso','ajuste','conteo','envio','anulacion','devolucion_tienda')),
  cantidad numeric(12,3) not null, motivo text not null,
  quien uuid not null references public.perfiles(id), cuando timestamptz not null default now()
);
create table public.conteos (
  id text primary key, fecha date not null, estado text not null check (estado in ('Abierto','Cerrado')),
  lineas jsonb not null default '[]'::jsonb, quien uuid not null references public.perfiles(id), cerrado_en timestamptz
);

-- ---------- Tiendas externas ----------
create table public.tiendas (id text primary key, nombre text not null, contacto text, telefono text, activo boolean not null default true);
create table public.envios (
  id text primary key, tienda_id text not null references public.tiendas(id), fecha date not null,
  items jsonb not null, recepcion jsonb, estado text not null default 'Por confirmar',
  quien uuid not null references public.perfiles(id), creado_en timestamptz not null default now()
);
create table public.pagos_tienda (id text primary key, tienda_id text not null references public.tiendas(id), monto numeric(12,2) not null check (monto > 0), medio text not null, fecha date not null, quien uuid not null references public.perfiles(id), creado_en timestamptz not null default now());
create table public.devoluciones_tienda (id text primary key, tienda_id text not null references public.tiendas(id), items jsonb not null, monto numeric(12,2) not null check (monto > 0), motivo text not null, fecha date not null, quien uuid not null references public.perfiles(id), creado_en timestamptz not null default now());

-- ---------- Caja ----------
create table public.cierres (
  id text primary key, fecha date not null, vendedor_id uuid references public.perfiles(id), -- null = cierre del dia
  estado text not null check (estado in ('Abierta','Cerrada','Reabierta')),
  esperado jsonb not null, contado jsonb not null, diferencia jsonb not null, pendiente numeric(12,2) not null default 0,
  nota text, quien uuid not null references public.perfiles(id), cerrado_en timestamptz,
  reapertura jsonb                           -- quien, cuando y motivo
);
create unique index cierres_unico on public.cierres (fecha, coalesce(vendedor_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.bitacora (id bigint generated always as identity primary key, accion text not null, detalle jsonb not null default '{}'::jsonb, quien uuid references public.perfiles(id), cuando timestamptz not null default now());

-- ---------- Reglas de integridad (triggers) ----------
-- Solo la administradora cambia precios y costos.
create or replace function public.solo_admin_precios() returns trigger language plpgsql as $$
begin
  if (new.precio is distinct from old.precio) and not public.es_admin() then raise exception 'Solo la administradora puede cambiar precios'; end if;
  return new;
end $$;
create trigger t_precios before update on public.productos for each row execute function public.solo_admin_precios();

-- Una venta no se edita a mano: solo cambian estado/estado_cobro/firma/foto, y anular es solo de la administradora.
create or replace function public.proteger_venta() returns trigger language plpgsql as $$
begin
  if new.id <> old.id then raise exception 'La venta no se puede reescribir'; end if;
  if new.estado = 'Anulada' and old.estado <> 'Anulada' and not public.es_admin() then raise exception 'Solo la administradora puede anular'; end if;
  if old.estado = 'Anulada' and new.estado <> 'Anulada' then raise exception 'Una venta anulada no se reactiva'; end if;
  if new.vendedor_id <> old.vendedor_id or new.registrado_por <> old.registrado_por then raise exception 'El vendedor de una venta no se cambia'; end if;
  if old.estado_cobro = 'Cobrado' and new.estado_cobro = 'Pendiente' then raise exception 'Una venta cobrada no vuelve a pendiente'; end if;
  return new;
end $$;
create trigger t_venta before update on public.ventas for each row execute function public.proteger_venta();

-- Una caja cerrada no admite ventas nuevas ni agregados; solo la administradora la reabre (con motivo).
create or replace function public.caja_abierta(p_fecha date, p_vendedor uuid) returns boolean language sql stable as $$
  select not exists (select 1 from public.cierres c where c.fecha = p_fecha and c.estado = 'Cerrada' and (c.vendedor_id is null or c.vendedor_id = p_vendedor))
$$;
create or replace function public.exigir_caja_abierta() returns trigger language plpgsql as $$
begin
  if not public.caja_abierta(new.fecha, new.vendedor_id) then raise exception 'La caja de ese dia ya esta cerrada'; end if;
  return new;
end $$;
create trigger t_caja_venta before insert on public.ventas for each row execute function public.exigir_caja_abierta();

create or replace function public.proteger_cierre() returns trigger language plpgsql as $$
begin
  if old.estado = 'Cerrada' and new.estado is distinct from 'Reabierta' then raise exception 'Cierre bloqueado: solo se reabre'; end if;
  if old.estado = 'Cerrada' and new.estado = 'Reabierta' and (not public.es_admin() or coalesce(new.reapertura->>'motivo','') = '') then raise exception 'Solo la administradora reabre, con motivo'; end if;
  return new;
end $$;
create trigger t_cierre before update on public.cierres for each row execute function public.proteger_cierre();

-- Nada se borra ni se reescribe en tablas de registro.
create or replace function public.bloquear_borrado() returns trigger language plpgsql as $$ begin raise exception 'Este registro no se puede borrar ni modificar'; end $$;
create trigger t_no_borrar_hist before update or delete on public.ventas_historial for each row execute function public.bloquear_borrado();
create trigger t_no_borrar_bit before update or delete on public.bitacora for each row execute function public.bloquear_borrado();
create trigger t_no_borrar_mov before update or delete on public.movimientos for each row execute function public.bloquear_borrado();
create trigger t_no_borrar_dev before update or delete on public.devoluciones for each row execute function public.bloquear_borrado();
create trigger t_no_borrar_pagos before update or delete on public.pagos_tienda for each row execute function public.bloquear_borrado();
create trigger t_no_borrar_devt before update or delete on public.devoluciones_tienda for each row execute function public.bloquear_borrado();
create trigger t_no_borrar_items before delete on public.venta_items for each row execute function public.bloquear_borrado();
create trigger t_no_borrar_ventas before delete on public.ventas for each row execute function public.bloquear_borrado();
create trigger t_no_borrar_prod before delete on public.productos for each row execute function public.bloquear_borrado();

-- ---------- Vista sin costos para vendedores ----------
create view public.venta_items_publico with (security_invoker = true) as
  select id, venta_id, producto_id, cantidad, precio, agregado_por, agregado_en from public.venta_items;

-- ---------- RLS ----------
alter table public.perfiles enable row level security;
alter table public.productos enable row level security;
alter table public.productos_costos enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;
alter table public.ventas_historial enable row level security;
alter table public.devoluciones enable row level security;
alter table public.movimientos enable row level security;
alter table public.conteos enable row level security;
alter table public.tiendas enable row level security;
alter table public.envios enable row level security;
alter table public.pagos_tienda enable row level security;
alter table public.devoluciones_tienda enable row level security;
alter table public.cierres enable row level security;
alter table public.bitacora enable row level security;

-- perfiles
create policy perfiles_ver on public.perfiles for select using (id = auth.uid() or public.es_gestion());
create policy perfiles_admin on public.perfiles for all using (public.es_admin()) with check (public.es_admin());
-- productos: todos ven; gestion edita (el trigger bloquea precios a coadmin); crear solo gestion
create policy prod_ver on public.productos for select using (public.es_personal());
create policy prod_ins on public.productos for insert with check (public.es_gestion());
create policy prod_upd on public.productos for update using (public.es_gestion() or public.es_personal()) with check (public.es_gestion() or public.es_personal());
-- costos: solo gestion
create policy costos_ver on public.productos_costos for select using (public.es_gestion());
create policy costos_ins on public.productos_costos for insert with check (public.es_admin());
create policy costos_upd on public.productos_costos for update using (public.es_admin()) with check (public.es_admin());
-- ventas: el vendedor ve y crea solo las suyas; gestion ve todas
create policy ventas_ver on public.ventas for select using (public.es_gestion() or vendedor_id = auth.uid());
create policy ventas_ins on public.ventas for insert with check (public.es_personal() and registrado_por = auth.uid() and (vendedor_id = auth.uid() or public.es_gestion()));
create policy ventas_upd on public.ventas for update using (public.es_gestion() or vendedor_id = auth.uid()) with check (public.es_gestion() or vendedor_id = auth.uid());
-- items: gestion ve todo (con costo); el vendedor usa la vista sin costo (security_invoker) y no lee la tabla base
create policy items_ver_gestion on public.venta_items for select using (public.es_gestion());
create policy items_ver_vendedor on public.venta_items for select using (exists (select 1 from public.ventas v where v.id = venta_id and v.vendedor_id = auth.uid()));
create policy items_ins on public.venta_items for insert with check (exists (select 1 from public.ventas v where v.id = venta_id and (public.es_gestion() or v.vendedor_id = auth.uid())) and agregado_por = auth.uid());
-- Importante: para ocultar el costo al vendedor, revocar el SELECT de la columna costo:
revoke select (costo) on public.venta_items from authenticated;
grant select (costo) on public.venta_items to service_role;
-- (la gestion lee el costo mediante la funcion costos_de_venta, ver abajo)
create or replace function public.costos_de_venta(p_venta text) returns table(item_id bigint, costo numeric)
language sql stable security definer set search_path = public as
$$ select id, costo from public.venta_items where venta_id = p_venta and public.es_gestion() $$;
-- historial y bitacora: se lee segun la venta; solo se inserta
create policy hist_ver on public.ventas_historial for select using (public.es_gestion() or exists (select 1 from public.ventas v where v.id = venta_id and v.vendedor_id = auth.uid()));
create policy hist_ins on public.ventas_historial for insert with check (public.es_personal() and quien = auth.uid());
create policy bit_ver on public.bitacora for select using (public.es_gestion());
create policy bit_ins on public.bitacora for insert with check (public.es_personal());
-- devoluciones: todos (el vendedor solo de sus propias ventas). Anular: solo administradora (via estado, ver trigger).
create policy dev_ver on public.devoluciones for select using (public.es_gestion() or exists (select 1 from public.ventas v where v.id = venta_id and v.vendedor_id = auth.uid()));
create policy dev_ins on public.devoluciones for insert with check (quien = auth.uid() and public.es_admin() and exists (select 1 from public.ventas v where v.id = venta_id));  -- solo la administradora, siempre ligada a una venta
-- movimientos: todos los ven (sin costo); todos insertan los suyos (venta); ajustes via aplicacion
create policy mov_ver on public.movimientos for select using (public.es_personal());
create policy mov_ins on public.movimientos for insert with check (public.es_personal() and quien = auth.uid());
-- conteos: gestion
create policy cont_ver on public.conteos for select using (public.es_gestion());
create policy cont_ins on public.conteos for insert with check (public.es_gestion());
create policy cont_upd on public.conteos for update using (public.es_gestion()) with check (public.es_gestion());
-- tiendas: gestion
create policy tie_ver on public.tiendas for select using (public.es_gestion());
create policy tie_all on public.tiendas for insert with check (public.es_gestion());
create policy tie_upd on public.tiendas for update using (public.es_gestion()) with check (public.es_gestion());
create policy env_ver on public.envios for select using (public.es_gestion());
create policy env_ins on public.envios for insert with check (public.es_gestion() and quien = auth.uid());
create policy env_upd on public.envios for update using (public.es_gestion()) with check (public.es_gestion());
create policy pag_ver on public.pagos_tienda for select using (public.es_gestion());
create policy pag_ins on public.pagos_tienda for insert with check (public.es_gestion() and quien = auth.uid());
create policy devt_ver on public.devoluciones_tienda for select using (public.es_gestion());
create policy devt_ins on public.devoluciones_tienda for insert with check (public.es_gestion() and quien = auth.uid());
-- cierres: el vendedor ve y crea el suyo; gestion todos; reabrir solo admin (trigger)
create policy cie_ver on public.cierres for select using (public.es_gestion() or vendedor_id = auth.uid() or vendedor_id is null);
create policy cie_ins on public.cierres for insert with check ((public.es_gestion()) or (vendedor_id = auth.uid() and quien = auth.uid()));
create policy cie_upd on public.cierres for update using (public.es_admin()) with check (public.es_admin());
-- (no existe ninguna politica FOR DELETE: nada se borra)

-- ---------- Almacenamiento privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('firmas', 'firmas', false, 262144, array['image/png']),
       ('fotos', 'fotos', false, 524288, array['image/jpeg','image/webp']),
       ('respaldos', 'respaldos', false, 8388608, array['application/json'])
on conflict (id) do update set public = false;

create policy firmas_ver on storage.objects for select using (bucket_id = 'firmas' and public.es_personal());
create policy firmas_ins on storage.objects for insert with check (bucket_id = 'firmas' and public.es_personal());
create policy fotos_ver on storage.objects for select using (bucket_id = 'fotos' and public.es_personal());
create policy fotos_ins on storage.objects for insert with check (bucket_id = 'fotos' and public.es_personal());
create policy respaldos_ver on storage.objects for select using (bucket_id = 'respaldos' and public.es_admin());
create policy respaldos_ins on storage.objects for insert with check (bucket_id = 'respaldos' and public.es_admin());
-- Sin politicas UPDATE ni DELETE en storage.objects para estos buckets.

-- ---------- Favoritos de venta (por usuario) ----------
-- Sin DELETE: quitar un favorito pone activo = false.
create table if not exists public.favoritos (usuario_id uuid not null references public.perfiles(id), producto_id text not null references public.productos(id), activo boolean not null default true, primary key (usuario_id, producto_id));
alter table public.favoritos enable row level security;
create policy fav_ver on public.favoritos for select using (usuario_id = auth.uid());
create policy fav_ins on public.favoritos for insert with check (usuario_id = auth.uid());
create policy fav_upd on public.favoritos for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ===== Pagos por venta (decisión de Sandro): parciales, nro. de operación, comprobante y verificación =====
create table public.pagos (
  id text primary key,
  venta_id text not null references public.ventas(id),
  medio text not null check (medio in ('Efectivo','Yape','Plin')),
  monto numeric(12,2) not null check (monto > 0),
  operacion text,                                   -- obligatorio en Yape y Plin
  foto_ruta text,                                   -- comprobante opcional (bucket privado "fotos")
  estado text not null default 'Por verificar' check (estado in ('Por verificar','Verificado')),
  inicial boolean not null default false,           -- pago hecho al registrar la venta
  duplicado boolean not null default false,         -- el nro. de operación ya existía (alerta en conciliación)
  quien uuid not null references public.perfiles(id),
  caja uuid not null references public.perfiles(id), -- caja del vendedor donde entra
  fecha date not null,
  creado_en timestamptz not null default now(),
  verificado_por uuid references public.perfiles(id),
  verificado_en timestamptz,
  check (medio = 'Efectivo' or char_length(coalesce(btrim(operacion), '')) >= 4),
  check ((estado = 'Verificado') = (verificado_por is not null))
);
alter table public.pagos enable row level security;
create index pagos_venta on public.pagos(venta_id);
create index pagos_fecha on public.pagos(fecha, medio);
create index pagos_operacion on public.pagos(medio, operacion) where operacion is not null;
-- Solo la administradora verifica; nadie cambia monto, medio ni operación después.
create or replace function public.proteger_pago() returns trigger language plpgsql as $$
begin
  if new.monto <> old.monto or new.medio <> old.medio or coalesce(new.operacion,'') <> coalesce(old.operacion,'') or new.venta_id <> old.venta_id or new.quien <> old.quien then raise exception 'Un pago no se reescribe'; end if;
  if new.estado <> old.estado and not public.es_admin() then raise exception 'Solo la administradora verifica pagos'; end if;
  if old.estado = 'Verificado' and new.estado <> 'Verificado' then raise exception 'Un pago verificado no vuelve atrás'; end if;
  return new;
end $$;
create trigger t_pago before update on public.pagos for each row execute function public.proteger_pago();
create trigger t_no_borrar_pagos before delete on public.pagos for each row execute function public.bloquear_borrado();
create policy pagos_ver on public.pagos for select using (public.es_gestion() or exists (select 1 from public.ventas v where v.id = venta_id and v.vendedor_id = auth.uid()));
create policy pagos_ins on public.pagos for insert with check (quien = auth.uid() and (estado = 'Por verificar' or medio = 'Efectivo' or public.es_admin()) and (public.es_gestion() or exists (select 1 from public.ventas v where v.id = venta_id and v.vendedor_id = auth.uid())));
create policy pagos_upd on public.pagos for update using (public.es_admin()) with check (public.es_admin());
-- Conciliación diaria por medio: registrado vs verificado (solo lectura).
create or replace view public.conciliacion_diaria with (security_invoker = true) as
  select p.fecha, p.medio, count(*) as pagos, sum(p.monto) as esperado,
         sum(p.monto) filter (where p.estado = 'Verificado') as verificado,
         sum(p.monto) filter (where p.estado = 'Por verificar') as por_verificar
  from public.pagos p join public.ventas v on v.id = p.venta_id where v.estado = 'Activa' group by p.fecha, p.medio;
-- Tiempo real: la venta que la administradora asigna aparece al instante en la app del vendedor (Supabase Realtime).
alter publication supabase_realtime add table public.ventas, public.venta_items, public.pagos;
