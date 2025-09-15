-- 📡 HABILITAR SUPABASE REALTIME - EJECUTAR EN SUPABASE SQL EDITOR

-- Verificar qué tablas ya están habilitadas
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Habilitar Realtime para las tablas críticas del sistema
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes;
ALTER PUBLICATION supabase_realtime ADD TABLE clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE repartidores;
ALTER PUBLICATION supabase_realtime ADD TABLE pagos;
ALTER PUBLICATION supabase_realtime ADD TABLE platos;
ALTER PUBLICATION supabase_realtime ADD TABLE bebidas;
ALTER PUBLICATION supabase_realtime ADD TABLE toppings;
ALTER PUBLICATION supabase_realtime ADD TABLE sede_platos;
ALTER PUBLICATION supabase_realtime ADD TABLE sede_bebidas;
ALTER PUBLICATION supabase_realtime ADD TABLE sede_toppings;

-- Verificar que se habilitaron correctamente
SELECT 'TABLAS HABILITADAS PARA REALTIME:' as resultado;
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Verificar políticas de seguridad (opcional - para desarrollo)
-- En producción, deberías configurar políticas más restrictivas

-- Nota: Las políticas RLS ya están deshabilitadas en desarrollo
-- Si necesitas habilitar RLS específicamente para realtime:
-- CREATE POLICY "Enable realtime for ordenes" ON ordenes FOR ALL USING (true);
-- CREATE POLICY "Enable realtime for repartidores" ON repartidores FOR ALL USING (true);