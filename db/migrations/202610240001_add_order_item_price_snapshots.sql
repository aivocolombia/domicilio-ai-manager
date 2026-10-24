-- PENDIENTE DE APLICACIÓN.
-- Conserva el precio cobrado en el momento de crear o editar cada línea.
-- Este archivo no se ejecuta automáticamente y debe aplicarse antes de desplegar
-- el código que escribe precio_unitario/precio_total.

alter table public.ordenes_platos
  add column if not exists precio_unitario integer,
  add column if not exists precio_total integer;

alter table public.ordenes_bebidas
  add column if not exists precio_unitario integer,
  add column if not exists precio_total integer;

alter table public.ordenes_toppings
  add column if not exists precio_unitario integer,
  add column if not exists precio_total integer;

comment on column public.ordenes_platos.precio_unitario is 'Precio unitario histórico cobrado en la orden';
comment on column public.ordenes_platos.precio_total is 'Precio total histórico de la línea';
comment on column public.ordenes_bebidas.precio_unitario is 'Precio unitario histórico cobrado en la orden';
comment on column public.ordenes_bebidas.precio_total is 'Precio total histórico de la línea';
comment on column public.ordenes_toppings.precio_unitario is 'Precio unitario histórico cobrado en la orden';
comment on column public.ordenes_toppings.precio_total is 'Precio total histórico de la línea';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ordenes_platos_precio_unitario_nonnegative') then
    alter table public.ordenes_platos add constraint ordenes_platos_precio_unitario_nonnegative check (precio_unitario is null or precio_unitario >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ordenes_platos_precio_total_nonnegative') then
    alter table public.ordenes_platos add constraint ordenes_platos_precio_total_nonnegative check (precio_total is null or precio_total >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ordenes_bebidas_precio_unitario_nonnegative') then
    alter table public.ordenes_bebidas add constraint ordenes_bebidas_precio_unitario_nonnegative check (precio_unitario is null or precio_unitario >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ordenes_bebidas_precio_total_nonnegative') then
    alter table public.ordenes_bebidas add constraint ordenes_bebidas_precio_total_nonnegative check (precio_total is null or precio_total >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ordenes_toppings_precio_unitario_nonnegative') then
    alter table public.ordenes_toppings add constraint ordenes_toppings_precio_unitario_nonnegative check (precio_unitario is null or precio_unitario >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ordenes_toppings_precio_total_nonnegative') then
    alter table public.ordenes_toppings add constraint ordenes_toppings_precio_total_nonnegative check (precio_total is null or precio_total >= 0) not valid;
  end if;
end $$;
