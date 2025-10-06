-- Debug: Verificar bebidas y su disponibilidad por sede
-- Ejecutar este script para verificar qué está pasando con las bebidas

-- 1. Verificar todas las sedes
SELECT id, name, is_active, created_at FROM sedes ORDER BY created_at DESC;

-- 2. Verificar todas las bebidas disponibles
SELECT id, name, pricing FROM bebidas ORDER BY name;

-- 3. Verificar registros en sede_bebidas para todas las sedes
SELECT 
    sb.sede_id,
    s.name as sede_name,
    sb.bebida_id,
    b.name as bebida_name,
    sb.available,
    sb.price_override,
    sb.updated_at
FROM sede_bebidas sb
JOIN sedes s ON sb.sede_id = s.id
JOIN bebidas b ON sb.bebida_id = b.id
ORDER BY s.name, b.name;

-- 4. Verificar si alguna sede tiene bebidas sin inicializar
SELECT 
    s.id,
    s.name as sede_name,
    s.created_at,
    COUNT(sb.bebida_id) as bebidas_inicializadas,
    (SELECT COUNT(*) FROM bebidas) as total_bebidas
FROM sedes s
LEFT JOIN sede_bebidas sb ON s.id = sb.sede_id
GROUP BY s.id, s.name, s.created_at
ORDER BY s.created_at DESC;

-- 5. Bebidas que deberían estar disponibles pero no están
SELECT 
    b.id,
    b.name,
    'Sin inicializar en nueva sede' as problema
FROM bebidas b
WHERE b.id NOT IN (
    SELECT DISTINCT sb.bebida_id 
    FROM sede_bebidas sb 
    JOIN sedes s ON sb.sede_id = s.id 
    WHERE s.created_at > NOW() - INTERVAL '7 days'
);