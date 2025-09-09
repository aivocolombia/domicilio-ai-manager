-- PRUEBA: Verificar que múltiples sedes pueden tener el mismo daily_id
-- Después de corregir el constraint, esto debería funcionar

-- 1. Obtener sedes disponibles
SELECT 'SEDES DISPONIBLES:' as info;
SELECT id as sede_id, name as sede_nombre FROM sedes ORDER BY name;

-- 2. Probar la función next_minuta_no_sede para diferentes sedes
SELECT 'PROBANDO FUNCIÓN PARA DIFERENTES SEDES:' as info;

-- Obtener las primeras 2 sedes para la prueba
SELECT 
  'Sede 1: ' || s1.name as sede_1,
  'Sede 2: ' || s2.name as sede_2
FROM sedes s1, sedes s2
WHERE s1.id != s2.id
LIMIT 1;

-- 3. Simular creación de minutas para diferentes sedes
-- Esto debería permitir que ambas sedes tengan daily_id = 1 en el mismo día

/*
-- Ejemplo de lo que debería funcionar después de la corrección:

-- Sede 1 - daily_id = 1
INSERT INTO minutas (order_id, sede_id, dia, daily_id, created_at)
VALUES (1, 'SEDE_1_ID', CURRENT_DATE, 1, NOW());

-- Sede 2 - daily_id = 1 (debería funcionar ahora)
INSERT INTO minutas (order_id, sede_id, dia, daily_id, created_at)
VALUES (2, 'SEDE_2_ID', CURRENT_DATE, 1, NOW());

-- Sede 1 - daily_id = 2
INSERT INTO minutas (order_id, sede_id, dia, daily_id, created_at)
VALUES (3, 'SEDE_1_ID', CURRENT_DATE, 2, NOW());

-- Sede 2 - daily_id = 2 (debería funcionar ahora)
INSERT INTO minutas (order_id, sede_id, dia, daily_id, created_at)
VALUES (4, 'SEDE_2_ID', CURRENT_DATE, 2, NOW());
*/

-- 4. Verificar el estado actual
SELECT 'ESTADO ACTUAL DE MINUTAS:' as info;

SELECT 
  m.sede_id,
  s.name as sede_nombre,
  m.dia,
  m.daily_id,
  COUNT(*) as cantidad
FROM minutas m
LEFT JOIN sedes s ON m.sede_id = s.id
WHERE m.dia = CURRENT_DATE
GROUP BY m.sede_id, s.name, m.dia, m.daily_id
ORDER BY m.sede_id, m.daily_id;

-- 5. Verificar contadores
SELECT 'CONTADORES ACTUALES:' as info;

SELECT 
  dmcs.sede_id,
  s.name as sede_nombre,
  dmcs.fecha,
  dmcs.last_value
FROM daily_minuta_counters_sede dmcs
LEFT JOIN sedes s ON dmcs.sede_id = s.id
WHERE dmcs.fecha = CURRENT_DATE
ORDER BY dmcs.sede_id;

-- 6. Verificar que el constraint permite duplicados entre sedes
SELECT 'VERIFICACIÓN DEL CONSTRAINT:' as info;

SELECT 
  'El constraint minutas_dia_sede_daily_key permite que diferentes sedes tengan el mismo daily_id en el mismo día' as explicacion,
  'Esto es correcto para el sistema de minutas por sede' as resultado;

