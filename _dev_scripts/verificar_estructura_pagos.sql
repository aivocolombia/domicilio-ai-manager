-- Script para verificar la estructura de la tabla pagos

-- 1. Verificar que la tabla pagos existe
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'pagos'
) as tabla_pagos_existe;

-- 2. Mostrar estructura de la tabla pagos
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'pagos' 
ORDER BY ordinal_position;

-- 3. Mostrar algunos registros de ejemplo
SELECT * FROM pagos LIMIT 5;

-- 4. Verificar estructura de la tabla ordenes para encontrar la relación correcta
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ordenes' 
AND column_name LIKE '%pago%' OR column_name LIKE '%payment%'
ORDER BY ordinal_position;