-- Script para insertar datos de ejemplo en las tablas del menú
-- Ejecutar este script en el SQL Editor de Supabase DESPUÉS de ejecutar fix-menu-rls.sql

-- Insertar platos de ejemplo
INSERT INTO platos (name, description, pricing, available) VALUES
('Ajiaco Santafereño', 'Sopa típica colombiana con pollo, papas criollas, guascas y mazorca', 18000, true),
('Frijoles Antioqueños', 'Frijoles con carne en polvo, chicharrón, arroz, aguacate y plátanos', 16000, true),
('Bandeja Paisa', 'Arroz, frijoles, carne, chicharrón, huevo, aguacate y plátanos', 22000, true),
('Sancocho de Gallina', 'Sopa de gallina criolla con yuca, plátano y mazorca', 20000, true),
('Lechona Tolimense', 'Cerdo relleno con arroz y garbanzos', 25000, true);

-- Insertar toppings de ejemplo
INSERT INTO toppings (name, pricing, available) VALUES
('Arroz', 0, true),
('Aguacate', 0, true),
('Plátanos', 0, true),
('Mazorca', 0, true),
('Pollo', 0, true),
('Carne en polvo', 0, true),
('Chicharrón', 0, true),
('Huevo', 0, true),
('Yuca', 0, true),
('Garbanzos', 0, true);

-- Insertar bebidas de ejemplo
INSERT INTO bebidas (name, pricing, available) VALUES
('Limonada Natural', 5000, true),
('Gaseosa', 3500, true),
('Jugo de Mora', 4000, true),
('Agua', 2000, true),
('Cerveza', 8000, true);

-- Insertar relaciones plato-toppings
-- Ajiaco con sus toppings
INSERT INTO plato_toppings (plato_id, "topping_Id") VALUES
(1, 1), -- Ajiaco + Arroz
(1, 2), -- Ajiaco + Aguacate
(1, 3), -- Ajiaco + Plátanos
(1, 4), -- Ajiaco + Mazorca
(1, 5); -- Ajiaco + Pollo

-- Frijoles con sus toppings
INSERT INTO plato_toppings (plato_id, "topping_Id") VALUES
(2, 1), -- Frijoles + Arroz
(2, 2), -- Frijoles + Aguacate
(2, 3), -- Frijoles + Plátanos
(2, 6), -- Frijoles + Carne en polvo
(2, 7); -- Frijoles + Chicharrón

-- Bandeja Paisa con sus toppings
INSERT INTO plato_toppings (plato_id, "topping_Id") VALUES
(3, 1), -- Bandeja + Arroz
(3, 2), -- Bandeja + Aguacate
(3, 3), -- Bandeja + Plátanos
(3, 6), -- Bandeja + Carne en polvo
(3, 7), -- Bandeja + Chicharrón
(3, 8); -- Bandeja + Huevo

-- Sancocho con sus toppings
INSERT INTO plato_toppings (plato_id, "topping_Id") VALUES
(4, 3), -- Sancocho + Plátanos
(4, 4), -- Sancocho + Mazorca
(4, 5), -- Sancocho + Pollo
(4, 9); -- Sancocho + Yuca

-- Lechona con sus toppings
INSERT INTO plato_toppings (plato_id, "topping_Id") VALUES
(5, 1), -- Lechona + Arroz
(5, 10); -- Lechona + Garbanzos

-- Verificar que los datos se insertaron correctamente
SELECT 'platos' as tabla, COUNT(*) as cantidad FROM platos
UNION ALL
SELECT 'toppings' as tabla, COUNT(*) as cantidad FROM toppings
UNION ALL
SELECT 'bebidas' as tabla, COUNT(*) as cantidad FROM bebidas
UNION ALL
SELECT 'plato_toppings' as tabla, COUNT(*) as cantidad FROM plato_toppings;

-- Mostrar platos con sus toppings
SELECT 
    p.name as plato,
    p.pricing as precio,
    COUNT(t.id) as num_toppings,
    STRING_AGG(t.name, ', ') as toppings
FROM platos p
LEFT JOIN plato_toppings pt ON pt.plato_id = p.id
LEFT JOIN toppings t ON t.id = pt."topping_Id"
GROUP BY p.id, p.name, p.pricing
ORDER BY p.name; 