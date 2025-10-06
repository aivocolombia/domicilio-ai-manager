-- Consultas para debuggear el problema de métricas

-- 1. Verificar todas las órdenes entregadas de hoy
SELECT 
    o.id,
    o.created_at,
    o.status,
    o.cliente_id,
    o.payment_id,
    o.sede_id,
    c.nombre as cliente_nombre,
    p.total_pago,
    p.status as payment_status
FROM ordenes o
LEFT JOIN clientes c ON o.cliente_id = c.id
LEFT JOIN pagos p ON o.payment_id = p.id
WHERE 
    o.status = 'Entregados' 
    AND DATE(o.created_at) = CURRENT_DATE
ORDER BY o.created_at DESC;

-- 2. Verificar si hay duplicados del mismo cliente
SELECT 
    cliente_id,
    COUNT(*) as cantidad_ordenes,
    SUM(p.total_pago) as total_ingresos
FROM ordenes o
LEFT JOIN pagos p ON o.payment_id = p.id
WHERE 
    o.status = 'Entregados' 
    AND DATE(o.created_at) = CURRENT_DATE
GROUP BY cliente_id
HAVING COUNT(*) > 1;

-- 3. Verificar métricas agregadas por día
SELECT 
    DATE(o.created_at) as fecha,
    COUNT(*) as total_pedidos,
    COUNT(DISTINCT o.cliente_id) as clientes_unicos,
    SUM(COALESCE(p.total_pago, 0)) as total_ingresos,
    AVG(COALESCE(p.total_pago, 0)) as promedio_por_pedido
FROM ordenes o
LEFT JOIN pagos p ON o.payment_id = p.id
WHERE 
    o.status = 'Entregados' 
    AND DATE(o.created_at) = CURRENT_DATE
GROUP BY DATE(o.created_at);

-- 4. Verificar órdenes sin pago asociado
SELECT 
    o.id,
    o.created_at,
    o.cliente_id,
    o.payment_id,
    CASE WHEN o.payment_id IS NULL THEN 'SIN PAGO' ELSE 'CON PAGO' END as estado_pago
FROM ordenes o
WHERE 
    o.status = 'Entregados' 
    AND DATE(o.created_at) = CURRENT_DATE
ORDER BY o.created_at DESC;