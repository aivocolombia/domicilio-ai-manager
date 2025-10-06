-- 🔍 DEBUG STATUSBAR REALTIME

-- 1. Verificar si las tablas sede_* están habilitadas para realtime
SELECT '📡 TABLAS SEDE_* EN REALTIME:' as seccion;
SELECT 
    tablename,
    'Habilitada para realtime' as estado
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename LIKE 'sede_%'
ORDER BY tablename;

-- 2. Verificar estructura y datos de sede_toppings
SELECT '📊 ESTRUCTURA SEDE_TOPPINGS:' as seccion;
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sede_toppings' 
ORDER BY ordinal_position;

-- 3. Verificar datos actuales de sede_toppings
SELECT '🔍 DATOS ACTUALES SEDE_TOPPINGS:' as seccion;
SELECT 
    sede_id,
    topping_id,
    available,
    pricing,
    toppings.name
FROM sede_toppings st
LEFT JOIN toppings ON st.topping_id = toppings.id
ORDER BY sede_id, topping_id
LIMIT 20;

-- 4. Verificar datos de toppings base
SELECT '📋 TOPPINGS BASE:' as seccion;
SELECT id, name, pricing, available FROM toppings ORDER BY id;

-- 5. Habilitar tablas sede_* si no están habilitadas
-- Ejecutar solo si las tablas no aparecen en el paso 1:
-- ALTER PUBLICATION supabase_realtime ADD TABLE sede_platos;
-- ALTER PUBLICATION supabase_realtime ADD TABLE sede_bebidas;
-- ALTER PUBLICATION supabase_realtime ADD TABLE sede_toppings;

-- 6. Verificar RLS en tablas sede_*
SELECT '🔒 RLS ESTADO TABLAS SEDE:' as seccion;
SELECT 
    tablename,
    CASE 
        WHEN rowsecurity THEN 'RLS Habilitado'
        ELSE 'RLS Deshabilitado'
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'sede_%'
ORDER BY tablename;