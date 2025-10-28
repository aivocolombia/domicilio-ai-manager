-- =====================================================
-- SOLUCIÓN: Foreign Key Constraint al Eliminar Usuarios
-- =====================================================
-- ERROR: update or delete on table "profiles" violates foreign key constraint
--        "ordenes_descuento_aplicado_por_fkey" on table "ordenes"
--
-- PROBLEMA: El usuario tiene órdenes asociadas (descuentos aplicados)
--           y no se puede eliminar por la restricción de clave foránea
-- =====================================================

-- PASO 1: Verificar qué órdenes están bloqueando la eliminación
SELECT
    o.id,
    o.id_display,
    o.descuento_valor,
    o.descuento_comentario,
    o.descuento_aplicado_fecha,
    o.descuento_aplicado_por,
    p.nickname,
    p.display_name
FROM ordenes o
JOIN profiles p ON o.descuento_aplicado_por = p.id
WHERE p.nickname = 'camilo';

-- PASO 2: Ver cuántas órdenes tiene este usuario
SELECT COUNT(*) as total_ordenes_con_descuento
FROM ordenes
WHERE descuento_aplicado_por IN (
    SELECT id FROM profiles WHERE nickname = 'camilo'
);

-- =====================================================
-- SOLUCIÓN 1: Cambiar FK a ON DELETE SET NULL (RECOMENDADO)
-- =====================================================
-- Esto permite eliminar el usuario y pone NULL en descuento_aplicado_por

-- 1.1 Eliminar el constraint existente
ALTER TABLE ordenes
DROP CONSTRAINT IF EXISTS ordenes_descuento_aplicado_por_fkey;

-- 1.2 Crear nuevo constraint con ON DELETE SET NULL
ALTER TABLE ordenes
ADD CONSTRAINT ordenes_descuento_aplicado_por_fkey
FOREIGN KEY (descuento_aplicado_por)
REFERENCES profiles(id)
ON DELETE SET NULL;  -- ← Cuando se elimina el usuario, pone NULL

-- 1.3 Verificar que el constraint se creó correctamente
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'ordenes'
  AND kcu.column_name = 'descuento_aplicado_por';
-- Debe mostrar: delete_rule = 'SET NULL'

-- =====================================================
-- SOLUCIÓN 2: Eliminar el constraint completamente
-- =====================================================
-- Esto permite eliminar usuarios sin verificar referencias
-- MENOS SEGURO pero más flexible

-- ALTER TABLE ordenes
-- DROP CONSTRAINT IF EXISTS ordenes_descuento_aplicado_por_fkey;

-- =====================================================
-- SOLUCIÓN 3: Actualizar órdenes antes de eliminar
-- =====================================================
-- Poner NULL manualmente en las órdenes antes de eliminar el usuario

-- 3.1 Actualizar órdenes para quitar la referencia al usuario
UPDATE ordenes
SET descuento_aplicado_por = NULL
WHERE descuento_aplicado_por IN (
    SELECT id FROM profiles WHERE nickname = 'camilo'
);

-- 3.2 Ahora sí se puede eliminar el usuario
-- DELETE FROM profiles WHERE nickname = 'camilo';

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Ver todos los foreign keys de la tabla ordenes
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'ordenes';

-- =====================================================
-- RECOMENDACIÓN
-- =====================================================
/*
La SOLUCIÓN 1 (ON DELETE SET NULL) es la mejor porque:

✅ Mantiene la integridad referencial
✅ Permite eliminar usuarios cuando sea necesario
✅ Preserva el historial de órdenes (no se eliminan)
✅ Solo pone NULL en el campo descuento_aplicado_por
✅ Es seguro y reversible

Después de aplicar SOLUCIÓN 1, también deberías revisar
otros foreign keys que puedan estar bloqueando:
- repartidor_id
- cliente_id
- sede_id
- etc.
*/

-- =====================================================
-- APLICAR SOLUCIÓN 1 A OTROS CAMPOS SI ES NECESARIO
-- =====================================================

-- Ver todos los FKs que apuntan a profiles
SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'profiles';
