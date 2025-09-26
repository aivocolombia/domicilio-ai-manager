-- Migration script to add discount functionality to orders table
-- This adds the necessary columns for the discount system

-- Add discount columns to the ordenes table
ALTER TABLE ordenes
ADD COLUMN IF NOT EXISTS descuento_valor DECIMAL(10,2) DEFAULT 0 CHECK (descuento_valor >= 0),
ADD COLUMN IF NOT EXISTS descuento_comentario TEXT,
ADD COLUMN IF NOT EXISTS descuento_aplicado_por UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS descuento_aplicado_fecha TIMESTAMPTZ;

-- Add constraint to ensure comment is mandatory when discount is applied
ALTER TABLE ordenes
ADD CONSTRAINT check_descuento_comentario
CHECK (
  (descuento_valor = 0 OR descuento_valor IS NULL) OR
  (descuento_valor > 0 AND descuento_comentario IS NOT NULL AND length(trim(descuento_comentario)) >= 10)
);

-- Create index for performance on discount queries
CREATE INDEX IF NOT EXISTS idx_ordenes_descuento_valor ON ordenes(descuento_valor) WHERE descuento_valor > 0;
CREATE INDEX IF NOT EXISTS idx_ordenes_descuento_aplicado_fecha ON ordenes(descuento_aplicado_fecha);
CREATE INDEX IF NOT EXISTS idx_ordenes_descuento_aplicado_por ON ordenes(descuento_aplicado_por);

-- Add comment for documentation
COMMENT ON COLUMN ordenes.descuento_valor IS 'Monto del descuento aplicado en pesos colombianos';
COMMENT ON COLUMN ordenes.descuento_comentario IS 'Comentario obligatorio explicando el motivo del descuento';
COMMENT ON COLUMN ordenes.descuento_aplicado_por IS 'UUID del usuario administrador que aplicó el descuento';
COMMENT ON COLUMN ordenes.descuento_aplicado_fecha IS 'Fecha y hora cuando se aplicó el descuento';

-- Verificar que la migración se ejecutó correctamente
DO $$
BEGIN
    -- Verificar columnas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordenes' AND column_name = 'descuento_valor'
    ) THEN
        RAISE EXCEPTION 'La columna descuento_valor no fue creada correctamente';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordenes' AND column_name = 'descuento_comentario'
    ) THEN
        RAISE EXCEPTION 'La columna descuento_comentario no fue creada correctamente';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordenes' AND column_name = 'descuento_aplicado_por'
    ) THEN
        RAISE EXCEPTION 'La columna descuento_aplicado_por no fue creada correctamente';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordenes' AND column_name = 'descuento_aplicado_fecha'
    ) THEN
        RAISE EXCEPTION 'La columna descuento_aplicado_fecha no fue creada correctamente';
    END IF;

    -- Verificar restricciones
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'check_descuento_comentario'
    ) THEN
        RAISE EXCEPTION 'La restricción check_descuento_comentario no fue creada correctamente';
    END IF;

    RAISE NOTICE '✅ Migración de columnas de descuento completada exitosamente';
    RAISE NOTICE '📋 Columnas agregadas: descuento_valor, descuento_comentario, descuento_aplicado_por, descuento_aplicado_fecha';
    RAISE NOTICE '🔒 Restricciones agregadas: check_descuento_comentario';
    RAISE NOTICE '⚡ Índices creados para optimización de consultas';
END $$;