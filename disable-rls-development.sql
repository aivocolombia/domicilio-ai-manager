-- =====================================================
-- DESHABILITAR RLS TEMPORALMENTE PARA DESARROLLO
-- =====================================================
-- Ejecutar este script en el SQL Editor de Supabase para desarrollo

-- Deshabilitar RLS en todas las tablas del menú
ALTER TABLE platos DISABLE ROW LEVEL SECURITY;
ALTER TABLE toppings DISABLE ROW LEVEL SECURITY;
ALTER TABLE bebidas DISABLE ROW LEVEL SECURITY;
ALTER TABLE plato_toppings DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS está deshabilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('platos', 'toppings', 'bebidas', 'plato_toppings')
ORDER BY tablename;

-- Verificar que se pueden hacer consultas
SELECT 'RLS deshabilitado - Prueba de consulta' as info;
SELECT COUNT(*) as platos_count FROM platos;
SELECT COUNT(*) as toppings_count FROM toppings;
SELECT COUNT(*) as bebidas_count FROM bebidas;
SELECT COUNT(*) as relaciones_count FROM plato_toppings;

-- =====================================================
-- NOTA IMPORTANTE
-- =====================================================
/*
⚠️  ADVERTENCIA: Este script deshabilita RLS temporalmente.
   Solo usar durante desarrollo y testing.

Para volver a habilitar RLS en producción:
   ALTER TABLE platos ENABLE ROW LEVEL SECURITY;
   ALTER TABLE toppings ENABLE ROW LEVEL SECURITY;
   ALTER TABLE bebidas ENABLE ROW LEVEL SECURITY;
   ALTER TABLE plato_toppings ENABLE ROW LEVEL SECURITY;
*/ 