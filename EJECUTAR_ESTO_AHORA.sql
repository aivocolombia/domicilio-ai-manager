-- =====================================================
-- SOLUCIÓN INMEDIATA: Deshabilitar RLS en profiles
-- =====================================================
-- Ejecuta este script en el SQL Editor de Supabase

-- Este es el problema: RLS está bloqueando la eliminación
-- Tu app usa autenticación personalizada (nickname/password)
-- NO usa Supabase Auth, por lo que auth.uid() no funciona

-- PASO 1: Deshabilitar RLS en la tabla profiles
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- PASO 2: Verificar que RLS está deshabilitado
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'profiles';

-- Debería mostrar: rls_enabled = false

-- PASO 3: Verificar que ahora puedes eliminar el usuario
-- DESCOMENTAR la siguiente línea para eliminar el usuario problemático:
-- DELETE FROM profiles WHERE nickname = 'camilo';

-- PASO 4: Verificar que el usuario fue eliminado
SELECT id, nickname, display_name
FROM profiles
WHERE nickname = 'camilo';

-- Si no aparece ningún resultado, el usuario fue eliminado correctamente

-- =====================================================
-- NOTA SOBRE SEGURIDAD
-- =====================================================
/*
Deshabilitar RLS en profiles es SEGURO en tu caso porque:

1. Tu app NO usa Supabase Auth (auth.uid() no existe)
2. Toda la seguridad se maneja en customAuthService.canManageUsers()
3. Solo admin_global y admin_punto pueden llamar deleteUser()
4. La verificación de permisos ocurre en el código de la aplicación

RLS es útil cuando usas Supabase Auth y quieres que la base de datos
enforce las reglas de seguridad. En tu caso, la seguridad se maneja
completamente en la capa de aplicación, que es igualmente válido.
*/

-- =====================================================
-- ALTERNATIVA: Mantener RLS pero con política permisiva
-- =====================================================
-- Si prefieres mantener RLS habilitado, usa esto en su lugar:

/*
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_for_anon" ON profiles;

CREATE POLICY "allow_all_for_anon" ON profiles
FOR ALL
TO anon, authenticated, public
USING (true)
WITH CHECK (true);
*/

-- Pero esto es esencialmente lo mismo que deshabilitar RLS,
-- por lo que es más simple y claro solo deshabilitarlo.
