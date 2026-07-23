-- Enforce override-only pricing model.
-- 1) Backfill null overrides from base pricing
-- 2) Make override non-null
-- 3) Auto-create override rows for all sedes on new products
-- 4) Prevent editing base pricing after creation

BEGIN;

UPDATE public.sede_platos sp
SET price_override = COALESCE(sp.price_override, p.pricing, 0)
FROM public.platos p
WHERE p.id = sp.plato_id
  AND sp.price_override IS NULL;

UPDATE public.sede_bebidas sb
SET price_override = COALESCE(sb.price_override, b.pricing, 0)
FROM public.bebidas b
WHERE b.id = sb.bebida_id
  AND sb.price_override IS NULL;

UPDATE public.sede_toppings st
SET price_override = COALESCE(st.price_override, t.pricing, 0)
FROM public.toppings t
WHERE t.id = st.topping_id
  AND st.price_override IS NULL;

ALTER TABLE public.sede_platos
  ALTER COLUMN price_override SET DEFAULT 0,
  ALTER COLUMN price_override SET NOT NULL;

ALTER TABLE public.sede_bebidas
  ALTER COLUMN price_override SET DEFAULT 0,
  ALTER COLUMN price_override SET NOT NULL;

ALTER TABLE public.sede_toppings
  ALTER COLUMN price_override SET DEFAULT 0,
  ALTER COLUMN price_override SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_new_plato_overrides()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.sede_platos (sede_id, plato_id, available, price_override, updated_at)
  SELECT s.id, NEW.id, true, COALESCE(NEW.pricing, 0), NOW()
  FROM public.sedes s
  ON CONFLICT (sede_id, plato_id)
  DO UPDATE SET
    price_override = EXCLUDED.price_override,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_new_bebida_overrides()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.sede_bebidas (sede_id, bebida_id, available, price_override, updated_at)
  SELECT s.id, NEW.id, true, COALESCE(NEW.pricing, 0), NOW()
  FROM public.sedes s
  ON CONFLICT (sede_id, bebida_id)
  DO UPDATE SET
    price_override = EXCLUDED.price_override,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_new_topping_overrides()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.sede_toppings (sede_id, topping_id, available, price_override, updated_at)
  SELECT s.id, NEW.id, true, COALESCE(NEW.pricing, 0), NOW()
  FROM public.sedes s
  ON CONFLICT (sede_id, topping_id)
  DO UPDATE SET
    price_override = EXCLUDED.price_override,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_new_plato_overrides ON public.platos;
CREATE TRIGGER trg_sync_new_plato_overrides
AFTER INSERT ON public.platos
FOR EACH ROW
EXECUTE FUNCTION public.sync_new_plato_overrides();

DROP TRIGGER IF EXISTS trg_sync_new_bebida_overrides ON public.bebidas;
CREATE TRIGGER trg_sync_new_bebida_overrides
AFTER INSERT ON public.bebidas
FOR EACH ROW
EXECUTE FUNCTION public.sync_new_bebida_overrides();

DROP TRIGGER IF EXISTS trg_sync_new_topping_overrides ON public.toppings;
CREATE TRIGGER trg_sync_new_topping_overrides
AFTER INSERT ON public.toppings
FOR EACH ROW
EXECUTE FUNCTION public.sync_new_topping_overrides();

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
