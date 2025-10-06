-- Función para obtener estadísticas de un repartidor específico
CREATE OR REPLACE FUNCTION get_repartidor_stats(rid bigint)
RETURNS TABLE (
  pedidos_activos bigint,
  entregados bigint,
  total_asignados bigint,
  total_entregado numeric(12,2)
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH o AS (
    SELECT o.*
    FROM ordenes o
    WHERE o.repartidor_id = rid
  )
  SELECT
    COUNT(*) FILTER (WHERE o.status IN ('Recibidos','Cocina','Camino'))::bigint AS pedidos_activos,
    COUNT(*) FILTER (WHERE o.status = 'Entregados')::bigint AS entregados,
    COUNT(*)::bigint AS total_asignados,
    COALESCE(SUM(pg.total_pago) FILTER (WHERE o.status = 'Entregados'), 0)::numeric(12,2) AS total_entregado
  FROM o
  LEFT JOIN pagos pg ON pg.id = o.payment_id;
END;
$$;

-- Comentario sobre la función
COMMENT ON FUNCTION get_repartidor_stats(bigint) IS 'Obtiene estadísticas completas de un repartidor: pedidos activos, entregados, total asignados y total entregado'; 