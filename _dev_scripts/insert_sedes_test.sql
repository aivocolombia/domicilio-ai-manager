-- Insertar sedes de prueba para testing
INSERT INTO sedes (id, name, address, phone, is_active, current_capacity, max_capacity) VALUES
('sede-niza', 'Niza', 'Carrera 15 #127-45, Niza', '601-555-0001', true, 8, 15),
('sede-chapinero', 'Chapinero', 'Calle 72 #12-34, Chapinero', '601-555-0002', true, 12, 20),
('sede-zona-rosa', 'Zona Rosa', 'Carrera 14 #85-23, Zona Rosa', '601-555-0003', true, 5, 10)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  current_capacity = EXCLUDED.current_capacity,
  max_capacity = EXCLUDED.max_capacity;

-- Verificar que se insertaron
SELECT * FROM sedes ORDER BY name;