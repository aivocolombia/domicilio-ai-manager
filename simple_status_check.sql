-- Script simple para verificar valores de status
-- Ejecutar esto en el SQL Editor de Supabase

-- 1. Ver valores existentes
SELECT DISTINCT status FROM ordenes ORDER BY status;

-- 2. Ver la definición del constraint
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'ordenes_status_check';

-- 3. Ver la estructura de la columna status
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'ordenes' 
AND column_name = 'status'; 