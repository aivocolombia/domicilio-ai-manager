-- Constraints: override obligatorio y precios históricos no nulos.

BEGIN;

ALTER TABLE public.sede_platos
  ALTER COLUMN price_override SET DEFAULT 0,
  ALTER COLUMN price_override SET NOT NULL;

ALTER TABLE public.sede_bebidas
  ALTER COLUMN price_override SET DEFAULT 0,
  ALTER COLUMN price_override SET NOT NULL;

ALTER TABLE public.sede_toppings
  ALTER COLUMN price_override SET DEFAULT 0,
  ALTER COLUMN price_override SET NOT NULL;

ALTER TABLE public.sede_platos
  DROP CONSTRAINT IF EXISTS sede_platos_price_override_non_negative;
ALTER TABLE public.sede_platos
  ADD CONSTRAINT sede_platos_price_override_non_negative CHECK (price_override >= 0);

ALTER TABLE public.sede_bebidas
  DROP CONSTRAINT IF EXISTS sede_bebidas_price_override_non_negative;
ALTER TABLE public.sede_bebidas
  ADD CONSTRAINT sede_bebidas_price_override_non_negative CHECK (price_override >= 0);

ALTER TABLE public.sede_toppings
  DROP CONSTRAINT IF EXISTS sede_toppings_price_override_non_negative;
ALTER TABLE public.sede_toppings
  ADD CONSTRAINT sede_toppings_price_override_non_negative CHECK (price_override >= 0);

ALTER TABLE public.ordenes_platos
  ALTER COLUMN precio_unitario SET DEFAULT 0,
  ALTER COLUMN precio_unitario SET NOT NULL,
  ALTER COLUMN precio_total SET DEFAULT 0,
  ALTER COLUMN precio_total SET NOT NULL;

ALTER TABLE public.ordenes_bebidas
  ALTER COLUMN precio_unitario SET DEFAULT 0,
  ALTER COLUMN precio_unitario SET NOT NULL,
  ALTER COLUMN precio_total SET DEFAULT 0,
  ALTER COLUMN precio_total SET NOT NULL;

ALTER TABLE public.ordenes_toppings
  ALTER COLUMN precio_unitario SET DEFAULT 0,
  ALTER COLUMN precio_unitario SET NOT NULL,
  ALTER COLUMN precio_total SET DEFAULT 0,
  ALTER COLUMN precio_total SET NOT NULL;

-- Prevenir updates de pricing base operativo
CREATE OR REPLACE FUNCTION public.prevent_base_price_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pricing IS DISTINCT FROM OLD.pricing THEN
    RAISE EXCEPTION 'Base pricing is immutable. Update sede_* price_override instead.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_plato_pricing_update ON public.platos;
CREATE TRIGGER trg_prevent_plato_pricing_update
BEFORE UPDATE ON public.platos
FOR EACH ROW
EXECUTE FUNCTION public.prevent_base_price_updates();

DROP TRIGGER IF EXISTS trg_prevent_bebida_pricing_update ON public.bebidas;
CREATE TRIGGER trg_prevent_bebida_pricing_update
BEFORE UPDATE ON public.bebidas
FOR EACH ROW
EXECUTE FUNCTION public.prevent_base_price_updates();

DROP TRIGGER IF EXISTS trg_prevent_topping_pricing_update ON public.toppings;
CREATE TRIGGER trg_prevent_topping_pricing_update
BEFORE UPDATE ON public.toppings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_base_price_updates();

COMMIT;
