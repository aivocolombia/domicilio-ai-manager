-- 🚀 SOLUCIÓN FINAL PARA HABILITAR REAL-TIME EN SUPABASE
-- Ejecuta este script completo en el SQL Editor de Supabase

-- 1. Habilitar todas las tablas críticas para real-time
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes;
ALTER PUBLICATION supabase_realtime ADD TABLE repartidores;
ALTER PUBLICATION supabase_realtime ADD TABLE pagos;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE platos;
ALTER PUBLICATION supabase_realtime ADD TABLE bebidas;
ALTER PUBLICATION supabase_realtime ADD TABLE toppings;
ALTER PUBLICATION supabase_realtime ADD TABLE sede_platos;
ALTER PUBLICATION supabase_realtime ADD TABLE sede_bebidas;
ALTER PUBLICATION supabase_realtime ADD TABLE sede_toppings;
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_platos;
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_bebidas;
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes_toppings;

-- 2. Verificar que se habilitaron correctamente
SELECT '✅ TABLAS HABILITADAS PARA REALTIME:' as resultado;
SELECT 
    tablename,
    '✅ Habilitada' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN (
    'ordenes', 'repartidores', 'pagos', 'clientes',
    'platos', 'bebidas', 'toppings',
    'sede_platos', 'sede_bebidas', 'sede_toppings',
    'ordenes_platos', 'ordenes_bebidas', 'ordenes_toppings'
)
ORDER BY tablename;

-- 3. Verificar si falta alguna tabla crítica
SELECT '❌ TABLAS QUE FALTAN (si hay resultado, hay un problema):' as alerta;
WITH tablas_criticas AS (
    SELECT 'ordenes' as tabla
    UNION SELECT 'repartidores'
    UNION SELECT 'pagos'
    UNION SELECT 'sede_toppings'
)
SELECT 
    tc.tabla as tabla_faltante,
    '❌ NO HABILITADA - EJECUTAR: ALTER PUBLICATION supabase_realtime ADD TABLE ' || tc.tabla || ';' as solucion
FROM tablas_criticas tc
LEFT JOIN pg_publication_tables ppt ON ppt.tablename = tc.tabla AND ppt.pubname = 'supabase_realtime'
WHERE ppt.tablename IS NULL;

-- 4. Mensaje final
SELECT '🎉 Si no hay resultados en "TABLAS QUE FALTAN", el real-time está correctamente configurado!' as mensaje_final;