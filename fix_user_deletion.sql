-- =====================================================
-- FIX USER DELETION - Diagnóstico y Solución
-- =====================================================
-- Ejecutar este script en el SQL Editor de Supabase

-- PASO 1: Verificar políticas RLS en la tabla profiles
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- PASO 2: Verificar si RLS está habilitado
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'profiles';

-- PASO 3: Verificar foreign keys que podrían estar bloqueando la eliminación
SELECT
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
  AND ccu.table_name = 'profiles';

-- PASO 4: Buscar el usuario específico
SELECT id, nickname, display_name, role, sede_id, is_active
FROM profiles
WHERE nickname = 'camilo';

-- =====================================================
-- SOLUCIÓN 1: Deshabilitar RLS temporalmente (DESARROLLO)
-- =====================================================
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- SOLUCIÓN 2: Crear política RLS que permita DELETE
-- =====================================================
-- Si RLS está habilitado, necesitamos una política que permita DELETE

-- Primero, eliminar políticas existentes de DELETE si existen
DROP POLICY IF EXISTS "allow_delete_profiles" ON profiles;

-- Crear nueva política que permita a admin_global eliminar usuarios
CREATE POLICY "allow_delete_profiles" ON profiles
FOR DELETE
TO authenticated
USING (
  -- Permitir si el usuario actual es admin_global
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin_global'
  )
);

-- Alternativamente, si quieres permitir que admin_punto elimine usuarios de su sede:
DROP POLICY IF EXISTS "allow_delete_profiles_by_sede" ON profiles;

CREATE POLICY "allow_delete_profiles_by_sede" ON profiles
FOR DELETE
TO authenticated
USING (
  -- Permitir si el usuario actual es admin_global O
  -- es admin_punto y el usuario a eliminar es de su misma sede
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role = 'admin_global'
      OR (p.role = 'admin_punto' AND p.sede_id = profiles.sede_id)
    )
  )
);

-- =====================================================
-- SOLUCIÓN 3: Verificar y eliminar usuario manualmente
-- =====================================================
-- Si las políticas RLS no funcionan, eliminar manualmente:

-- DESCOMENTAR LA SIGUIENTE LÍNEA PARA ELIMINAR EL USUARIO
-- DELETE FROM profiles WHERE nickname = 'camilo';

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================
-- Verificar que las políticas están activas
SELECT
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'profiles' AND cmd = 'DELETE';

-- Verificar si el usuario todavía existe
SELECT COUNT(*) as existe_usuario
FROM profiles
WHERE nickname = 'camilo';
