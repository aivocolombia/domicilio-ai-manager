-- =====================================================
-- EJECUTAR AHORA: Arreglar Foreign Key Constraint
-- =====================================================
-- Esto permite eliminar usuarios que tienen descuentos aplicados

-- PASO 1: Eliminar el constraint existente
ALTER TABLE ordenes
DROP CONSTRAINT IF EXISTS ordenes_descuento_aplicado_por_fkey;

-- PASO 2: Crear nuevo constraint con ON DELETE SET NULL
ALTER TABLE ordenes
ADD CONSTRAINT ordenes_descuento_aplicado_por_fkey
FOREIGN KEY (descuento_aplicado_por)
REFERENCES profiles(id)
ON DELETE SET NULL;

-- PASO 3: Verificar que funciona
SELECT
    tc.constraint_name,
    kcu.column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'ordenes'
  AND kcu.column_name = 'descuento_aplicado_por';

-- Debe mostrar: delete_rule = 'SET NULL'

-- ¡Listo! Ahora puedes eliminar el usuario desde la app
