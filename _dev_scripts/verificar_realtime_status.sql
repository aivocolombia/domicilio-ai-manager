-- 🔍 VERIFICAR ESTADO COMPLETO DE SUPABASE REALTIME

-- 1. Verificar qué tablas están habilitadas para realtime
SELECT '🔍 TABLAS HABILITADAS PARA REALTIME:' as seccion;
SELECT 
    schemaname, 
    tablename,
    '✅ Habilitada' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- 2. Verificar si faltan tablas críticas
SELECT '❌ TABLAS FALTANTES (CRÍTICAS):' as seccion;
WITH tablas_criticas AS (
    SELECT 'ordenes' as tabla
    UNION SELECT 'repartidores'
    UNION SELECT 'pagos'
    UNION SELECT 'clientes'
    UNION SELECT 'platos'
    UNION SELECT 'bebidas'
    UNION SELECT 'toppings'
    UNION SELECT 'sede_platos'
    UNION SELECT 'sede_bebidas'
    UNION SELECT 'sede_toppings'
    UNION SELECT 'ordenes_platos'
    UNION SELECT 'ordenes_bebidas'
    UNION SELECT 'ordenes_toppings'
)
SELECT 
    tc.tabla as tabla_faltante,
    '❌ NO HABILITADA' as status
FROM tablas_criticas tc
LEFT JOIN pg_publication_tables ppt ON ppt.tablename = tc.tabla AND ppt.pubname = 'supabase_realtime'
WHERE ppt.tablename IS NULL;

-- 3. Verificar políticas de seguridad (RLS)
SELECT '🔒 ESTADO DE RLS POR TABLA:' as seccion;
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '🔒 RLS Habilitado'
        ELSE '🔓 RLS Deshabilitado (OK para desarrollo)'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('ordenes', 'repartidores', 'pagos', 'clientes', 'platos', 'bebidas', 'toppings', 'sede_platos', 'sede_bebidas', 'sede_toppings')
ORDER BY tablename;

-- 4. Verificar estructura de base de datos
SELECT '📊 CONTEO DE REGISTROS POR TABLA:' as seccion;

-- Contar registros en tablas principales
SELECT 'ordenes' as tabla, COUNT(*) as registros FROM ordenes
UNION ALL
SELECT 'repartidores' as tabla, COUNT(*) as registros FROM repartidores
UNION ALL
SELECT 'pagos' as tabla, COUNT(*) as registros FROM pagos
UNION ALL
SELECT 'clientes' as tabla, COUNT(*) as registros FROM clientes
UNION ALL
SELECT 'platos' as tabla, COUNT(*) as registros FROM platos
UNION ALL
SELECT 'bebidas' as tabla, COUNT(*) as registros FROM bebidas
UNION ALL
SELECT 'toppings' as tabla, COUNT(*) as registros FROM toppings
ORDER BY tabla;

-- 5. Verificar últimas actividades
SELECT '⏰ ACTIVIDAD RECIENTE (ÚLTIMAS 24H):' as seccion;
SELECT 
    'ordenes' as tabla,
    COUNT(*) as cambios_24h
FROM ordenes 
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'pagos' as tabla,
    COUNT(*) as cambios_24h
FROM pagos 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY tabla;

-- 6. Script de corrección si hay tablas faltantes
SELECT '🔧 SCRIPT DE CORRECCIÓN:' as seccion;
SELECT 'Si hay tablas faltantes, ejecuta:' as instruccion;
SELECT 'ALTER PUBLICATION supabase_realtime ADD TABLE nombre_tabla;' as comando;