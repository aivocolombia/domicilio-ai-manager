-- =====================================================
-- MIGRACIÓN: Contadores de minuta separados por tipo
-- (delivery vs pickup)
-- =====================================================

-- Paso 1: Agregar columna type_order a la tabla de contadores
ALTER TABLE daily_minuta_counters_sede
ADD COLUMN IF NOT EXISTS type_order VARCHAR(20) DEFAULT 'delivery';

-- Paso 2: Actualizar la clave primaria para incluir type_order
-- Primero eliminar la constraint existente
ALTER TABLE daily_minuta_counters_sede
DROP CONSTRAINT IF EXISTS daily_minuta_counters_sede_pkey;

-- Crear nueva clave primaria compuesta
ALTER TABLE daily_minuta_counters_sede
ADD PRIMARY KEY (fecha, sede_id, type_order);

-- Paso 3: Agregar columna type_order a la tabla minutas (para saber qué tipo es)
ALTER TABLE minutas
ADD COLUMN IF NOT EXISTS type_order VARCHAR(20) DEFAULT 'delivery';

-- Paso 4: Crear o reemplazar la función del trigger
CREATE OR REPLACE FUNCTION create_minuta_for_order()
RETURNS TRIGGER AS $$
DECLARE
    v_daily_id INTEGER;
    v_today DATE;
    v_type_order VARCHAR(20);
BEGIN
    -- Obtener la fecha actual en zona horaria de Colombia
    v_today := (NOW() AT TIME ZONE 'America/Bogota')::DATE;

    -- Determinar el tipo de orden (delivery o pickup)
    -- Si type_order es null o vacío, usar precio_envio como fallback
    v_type_order := COALESCE(NEW.type_order,
        CASE WHEN NEW.precio_envio > 0 THEN 'delivery' ELSE 'pickup' END
    );

    -- Intentar obtener y actualizar el contador existente
    UPDATE daily_minuta_counters_sede
    SET last_value = last_value + 1
    WHERE fecha = v_today
      AND sede_id = NEW.sede_id
      AND type_order = v_type_order
    RETURNING last_value INTO v_daily_id;

    -- Si no existe, crear nuevo contador empezando en 1
    IF v_daily_id IS NULL THEN
        INSERT INTO daily_minuta_counters_sede (fecha, sede_id, type_order, last_value)
        VALUES (v_today, NEW.sede_id, v_type_order, 1)
        ON CONFLICT (fecha, sede_id, type_order)
        DO UPDATE SET last_value = daily_minuta_counters_sede.last_value + 1
        RETURNING last_value INTO v_daily_id;
    END IF;

    -- Insertar la minuta con el daily_id correspondiente
    INSERT INTO minutas (order_id, sede_id, dia, daily_id, type_order)
    VALUES (NEW.id, NEW.sede_id, v_today, v_daily_id, v_type_order);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Paso 5: Asegurar que el trigger existe y está activo
DROP TRIGGER IF EXISTS trigger_create_minuta ON ordenes;

CREATE TRIGGER trigger_create_minuta
    AFTER INSERT ON ordenes
    FOR EACH ROW
    EXECUTE FUNCTION create_minuta_for_order();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Ver estructura actualizada de las tablas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'daily_minuta_counters_sede'
ORDER BY ordinal_position;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'minutas'
ORDER BY ordinal_position;

-- Ver los contadores actuales (si existen)
SELECT * FROM daily_minuta_counters_sede ORDER BY fecha DESC, sede_id, type_order LIMIT 20;
