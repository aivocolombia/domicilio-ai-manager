-- =====================================================
-- SOLUCIÓN DEFINITIVA: Permitir DELETE con autenticación personalizada
-- =====================================================
-- PROBLEMA: Estás usando autenticación personalizada (nickname/password)
--           NO estás usando Supabase Auth (auth.uid() no funciona)
--           Por lo tanto, las políticas RLS basadas en auth.uid() no funcionan
-- =====================================================

-- SOLUCIÓN RECOMENDADA: Deshabilitar RLS en profiles (desarrollo)
-- En producción, usa service_role_key para operaciones administrativas

-- Verificar estado actual de RLS
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'profiles';

-- OPCIÓN 1: Deshabilitar RLS completamente (RECOMENDADO para tu caso)
-- Ya que usas autenticación personalizada, RLS no funciona correctamente
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Verificar que RLS está deshabilitado
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'profiles';

-- OPCIÓN 2: Si necesitas RLS habilitado, crea una política permisiva
-- NOTA: Esto permite a CUALQUIER usuario autenticado eliminar perfiles
-- Solo usa esto si confías en tu capa de seguridad de aplicación
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "allow_all_authenticated" ON profiles;

-- Crear política que permita TODO a usuarios autenticados
-- Tu servicio customAuthService maneja la seguridad real
CREATE POLICY "allow_all_authenticated" ON profiles
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- OPCIÓN 3: Usar anon key con política permisiva
-- Si tu app usa anon key (no authenticated)
DROP POLICY IF EXISTS "allow_all_operations" ON profiles;

CREATE POLICY "allow_all_operations" ON profiles
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- =====================================================
-- VERIFICAR Y PROBAR
-- =====================================================

-- Ver todas las políticas actuales
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- Probar eliminación del usuario problemático
-- DESCOMENTAR para eliminar:
-- DELETE FROM profiles WHERE nickname = 'camilo';

-- Verificar que se eliminó
SELECT id, nickname, display_name, role
FROM profiles
WHERE nickname = 'camilo';

-- =====================================================
-- RECOMENDACIÓN FINAL
-- =====================================================
/*
Como estás usando autenticación personalizada (nickname/password),
la mejor solución es:

1. DESHABILITAR RLS en la tabla profiles
   ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

2. Manejar la seguridad en tu capa de aplicación
   (Ya lo haces en customAuthService.canManageUsers())

3. En producción, considera usar service_role_key
   para operaciones administrativas bypass RLS

Para mayor seguridad, asegúrate de que:
- Solo admin_global y admin_punto puedan llamar adminService.deleteUser()
- El check de permisos en customAuthService.canManageUsers() es robusto
- Los permisos de la API key de Supabase están bien configurados
*/
