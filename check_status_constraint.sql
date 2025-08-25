-- Verificar los valores válidos para el campo status en la tabla ordenes
-- Esto nos ayudará a entender qué valores acepta el constraint ordenes_status_check

-- Opción 1: Verificar el constraint directamente
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'ordenes_status_check';

-- Opción 2: Verificar los valores actuales en la tabla
SELECT DISTINCT status 
FROM ordenes 
ORDER BY status;

-- Opción 3: Verificar la estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ordenes' 
AND column_name = 'status';

-- Opción 4: Verificar si hay un enum definido
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%status%' OR t.typname LIKE '%orden%'
ORDER BY t.typname, e.enumsortorder; 