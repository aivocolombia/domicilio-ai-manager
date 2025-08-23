-- Script para verificar y crear relaciones plato-toppings
-- Este script verifica que los platos tengan toppings asignados

-- 1. Verificar relaciones existentes
SELECT 
  'Relaciones existentes' as info,
  pt.plato_id,
  p.name as plato_nombre,
  pt.topping_id,
  t.name as topping_nombre
FROM plato_toppings pt
JOIN platos p ON p.id = pt.plato_id
JOIN toppings t ON t.id = pt.topping_id
ORDER BY pt.plato_id, pt.topping_id;

-- 2. Verificar qué platos no tienen toppings
SELECT 
  'Platos sin toppings' as info,
  p.id,
  p.name
FROM platos p
LEFT JOIN plato_toppings pt ON p.id = pt.plato_id
WHERE pt.plato_id IS NULL;

-- 3. Verificar qué toppings no están asignados a ningún plato
SELECT 
  'Toppings sin asignar' as info,
  t.id,
  t.name
FROM toppings t
LEFT JOIN plato_toppings pt ON t.id = pt.topping_id
WHERE pt.topping_id IS NULL;

-- 4. Crear algunas relaciones de ejemplo (descomenta si necesitas crear relaciones)
-- Asumiendo que tienes platos con IDs 1 y 2, y toppings con IDs 1, 2, 3, 4

/*
-- Asignar toppings al Ajiaco (asumiendo que es el plato con ID 1)
INSERT INTO plato_toppings (plato_id, topping_id, created_at)
VALUES 
  (1, 1, now()), -- Crema
  (1, 2, now()), -- Aguacate
  (1, 3, now()), -- Alcaparras
  (1, 4, now())  -- Papa
ON CONFLICT (plato_id, topping_id) DO NOTHING;

-- Asignar toppings a los Frijoles (asumiendo que es el plato con ID 2)
INSERT INTO plato_toppings (plato_id, topping_id, created_at)
VALUES 
  (2, 1, now()), -- Crema
  (2, 2, now()), -- Aguacate
  (2, 5, now())  -- Queso rallado
ON CONFLICT (plato_id, topping_id) DO NOTHING;
*/

-- 5. Verificar el resultado final
SELECT 
  'Resultado final' as info,
  COUNT(*) as total_relaciones
FROM plato_toppings; 