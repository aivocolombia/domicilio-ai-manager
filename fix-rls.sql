-- Script para solucionar problemas de acceso temporalmente
-- Ejecutar este script en el SQL Editor de Supabase

-- Deshabilitar RLS temporalmente para permitir acceso
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE sedes DISABLE ROW LEVEL SECURITY;

-- Verificar que las tablas existen y tienen datos
SELECT 'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'sedes' as table_name, COUNT(*) as count FROM sedes;

-- Verificar usuarios específicos
SELECT id, email, name, role, is_active 
FROM profiles 
WHERE email IN ('admin@ajiaco.com', 'agente@ajiaco.com')
ORDER BY role DESC;

-- Nota: Después de que funcione el login, puedes volver a habilitar RLS con:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sedes ENABLE ROW LEVEL SECURITY; 