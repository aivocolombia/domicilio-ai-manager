-- Script para insertar usuarios de ejemplo
-- Ejecutar este script en el SQL Editor de Supabase DESPUÉS de ejecutar database-setup.sql

-- Nota: Los usuarios deben ser creados primero a través de la interfaz de Supabase Auth
-- o mediante la API de autenticación. Este script solo inserta los perfiles.

-- Para crear los usuarios, ve a Authentication > Users en Supabase y crea:
-- 1. admin@ajiaco.com con contraseña admin123
-- 2. agente@ajiaco.com con contraseña agente123

-- Una vez creados los usuarios, ejecuta este script para insertar sus perfiles:

-- Insertar perfil del administrador
INSERT INTO profiles (id, email, name, role) 
SELECT 
    id,
    email,
    'Administrador',
    'admin'
FROM auth.users 
WHERE email = 'admin@ajiaco.com'
ON CONFLICT (id) DO UPDATE SET
    name = 'Administrador',
    role = 'admin';

-- Insertar perfil del agente
INSERT INTO profiles (id, email, name, role) 
SELECT 
    id,
    email,
    'Agente',
    'agent'
FROM auth.users 
WHERE email = 'agente@ajiaco.com'
ON CONFLICT (id) DO UPDATE SET
    name = 'Agente',
    role = 'agent';

-- Verificar que los usuarios se insertaron correctamente
SELECT 
    p.id,
    p.email,
    p.name,
    p.role,
    p.is_active,
    p.created_at
FROM profiles p
WHERE p.email IN ('admin@ajiaco.com', 'agente@ajiaco.com')
ORDER BY p.role DESC; 