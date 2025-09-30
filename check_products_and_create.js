/**
 * Script para verificar productos y crear reglas de sustitución directamente
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1NDU5MzAsImV4cCI6MjA0MTEyMTkzMH0.zGLBOVo_7OxGP4i8lBOhUtLpWOjlHDBwdQJXFI0TJPo';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Verificando productos en la base de datos...\n');

async function checkAndCreateSubstitutions() {
  try {
    // 1. Verificar productos existentes
    console.log('📊 1. OBTENIENDO TODOS LOS TOPPINGS:');
    const { data: toppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .order('name');

    if (toppingsError) {
      throw toppingsError;
    }

    console.log(`✅ ${toppings.length} toppings encontrados:`);
    toppings.forEach(t => {
      console.log(`   ${t.id}: ${t.name}`);
    });

    // 2. Buscar productos específicos
    console.log('\n🎯 2. BUSCANDO PRODUCTOS PARA SUSTITUCIONES:');

    const findProduct = (name, products) => {
      return products.find(p =>
        p.name.toLowerCase().includes(name.toLowerCase())
      );
    };

    const mazorca = findProduct('mazorca', toppings);
    const platano = findProduct('plátano', toppings) || findProduct('platano', toppings);
    const arroz = findProduct('arroz', toppings);
    const aguacate = findProduct('aguacate', toppings);
    const carne = findProduct('carne', toppings);
    const pollo = findProduct('pollo', toppings);
    const tocino = findProduct('tocino', toppings);

    console.log('\n📋 Productos encontrados:');
    console.log('Mazorca:', mazorca ? `ID ${mazorca.id}: ${mazorca.name}` : '❌ NO ENCONTRADO');
    console.log('Plátano:', platano ? `ID ${platano.id}: ${platano.name}` : '❌ NO ENCONTRADO');
    console.log('Arroz:', arroz ? `ID ${arroz.id}: ${arroz.name}` : '❌ NO ENCONTRADO');
    console.log('Aguacate:', aguacate ? `ID ${aguacate.id}: ${aguacate.name}` : '❌ NO ENCONTRADO');
    console.log('Carne:', carne ? `ID ${carne.id}: ${carne.name}` : '❌ NO ENCONTRADO');
    console.log('Pollo:', pollo ? `ID ${pollo.id}: ${pollo.name}` : '❌ NO ENCONTRADO');
    console.log('Tocino:', tocino ? `ID ${tocino.id}: ${tocino.name}` : '❌ NO ENCONTRADO');

    // 3. Generar SQL con IDs reales
    console.log('\n🛠️ 3. GENERANDO SQL CON IDS REALES:');

    const sqlCommands = [];

    // Crear tabla
    sqlCommands.push(`-- Crear tabla de sustituciones
CREATE TABLE IF NOT EXISTS product_substitution_rules (
    id SERIAL PRIMARY KEY,
    original_product_id INTEGER NOT NULL,
    original_product_type VARCHAR(20) NOT NULL CHECK (original_product_type IN ('plato', 'bebida', 'topping')),
    substitute_product_id INTEGER NOT NULL,
    substitute_product_type VARCHAR(20) NOT NULL CHECK (substitute_product_type IN ('plato', 'bebida', 'topping')),
    price_difference DECIMAL(10,2) DEFAULT 0.00,
    is_bidirectional BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_substitution_original ON product_substitution_rules(original_product_id, original_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_substitute ON product_substitution_rules(substitute_product_id, substitute_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_active ON product_substitution_rules(is_active);

-- Constraint único
ALTER TABLE product_substitution_rules
ADD CONSTRAINT IF NOT EXISTS unique_substitution_rule
UNIQUE (original_product_id, original_product_type, substitute_product_id, substitute_product_type);`);

    // Generar reglas
    console.log('\n📝 Reglas a crear:');
    let rulesCount = 0;

    if (mazorca && platano) {
      sqlCommands.push(`-- Mazorca ↔ Plátano ($3,700)
INSERT INTO product_substitution_rules (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES (${mazorca.id}, 'topping', ${platano.id}, 'topping', 0.00, true, 'Mazorca ↔ Plátano ($3,700)');`);
      console.log(`✅ Mazorca (${mazorca.id}) ↔ Plátano (${platano.id})`);
      rulesCount++;
    }

    if (arroz && aguacate) {
      sqlCommands.push(`-- Arroz → Aguacate ($4,800 → $4,200)
INSERT INTO product_substitution_rules (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES (${arroz.id}, 'topping', ${aguacate.id}, 'topping', -600.00, false, 'Arroz ($4,800) → Aguacate ($4,200)');`);
      console.log(`✅ Arroz (${arroz.id}) → Aguacate (${aguacate.id})`);
      rulesCount++;
    }

    if (arroz && platano) {
      sqlCommands.push(`-- Arroz → Plátano ($4,800 → $3,700)
INSERT INTO product_substitution_rules (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES (${arroz.id}, 'topping', ${platano.id}, 'topping', -1100.00, false, 'Arroz ($4,800) → Plátano ($3,700)');`);
      console.log(`✅ Arroz (${arroz.id}) → Plátano (${platano.id})`);
      rulesCount++;
    }

    if (arroz && mazorca) {
      sqlCommands.push(`-- Arroz → Mazorca ($4,800 → $3,700)
INSERT INTO product_substitution_rules (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES (${arroz.id}, 'topping', ${mazorca.id}, 'topping', -1100.00, false, 'Arroz ($4,800) → Mazorca ($3,700)');`);
      console.log(`✅ Arroz (${arroz.id}) → Mazorca (${mazorca.id})`);
      rulesCount++;
    }

    if (carne && pollo) {
      sqlCommands.push(`-- Porción carne ↔ Porción pollo ($6,300)
INSERT INTO product_substitution_rules (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES (${carne.id}, 'topping', ${pollo.id}, 'topping', 0.00, true, 'Porción carne ↔ Porción pollo ($6,300)');`);
      console.log(`✅ Carne (${carne.id}) ↔ Pollo (${pollo.id})`);
      rulesCount++;
    }

    if (tocino && carne) {
      sqlCommands.push(`-- Tocino → Porción carne ($8,400 → $6,300)
INSERT INTO product_substitution_rules (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES (${tocino.id}, 'topping', ${carne.id}, 'topping', -2100.00, false, 'Tocino ($8,400) → Porción carne ($6,300)');`);
      console.log(`✅ Tocino (${tocino.id}) → Carne (${carne.id})`);
      rulesCount++;
    }

    if (aguacate && mazorca) {
      sqlCommands.push(`-- Aguacate → Mazorca ($4,200 → $3,700)
INSERT INTO product_substitution_rules (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES (${aguacate.id}, 'topping', ${mazorca.id}, 'topping', -500.00, false, 'Aguacate ($4,200) → Mazorca ($3,700)');`);
      console.log(`✅ Aguacate (${aguacate.id}) → Mazorca (${mazorca.id})`);
      rulesCount++;
    }

    if (aguacate && platano) {
      sqlCommands.push(`-- Aguacate → Plátano ($4,200 → $3,700)
INSERT INTO product_substitution_rules (original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES (${aguacate.id}, 'topping', ${platano.id}, 'topping', -500.00, false, 'Aguacate ($4,200) → Plátano ($3,700)');`);
      console.log(`✅ Aguacate (${aguacate.id}) → Plátano (${platano.id})`);
      rulesCount++;
    }

    // Agregar función y permisos
    sqlCommands.push(`
-- Función para obtener sustituciones
CREATE OR REPLACE FUNCTION get_available_substitutions(
    p_product_id INTEGER,
    p_product_type VARCHAR(20)
)
RETURNS TABLE (
    substitute_id INTEGER,
    substitute_type VARCHAR(20),
    substitute_name VARCHAR(255),
    price_difference DECIMAL(10,2),
    is_bidirectional BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        psr.substitute_product_id as substitute_id,
        psr.substitute_product_type as substitute_type,
        CASE
            WHEN psr.substitute_product_type = 'topping' THEN t.name
            WHEN psr.substitute_product_type = 'plato' THEN p.name
            WHEN psr.substitute_product_type = 'bebida' THEN b.name
        END as substitute_name,
        psr.price_difference,
        psr.is_bidirectional
    FROM product_substitution_rules psr
    LEFT JOIN toppings t ON psr.substitute_product_id = t.id AND psr.substitute_product_type = 'topping'
    LEFT JOIN platos p ON psr.substitute_product_id = p.id AND psr.substitute_product_type = 'plato'
    LEFT JOIN bebidas b ON psr.substitute_product_id = b.id AND psr.substitute_product_type = 'bebida'
    WHERE psr.original_product_id = p_product_id
      AND psr.original_product_type = p_product_type
      AND psr.is_active = true

    UNION

    SELECT
        psr.original_product_id as substitute_id,
        psr.original_product_type as substitute_type,
        CASE
            WHEN psr.original_product_type = 'topping' THEN t.name
            WHEN psr.original_product_type = 'plato' THEN p.name
            WHEN psr.original_product_type = 'bebida' THEN b.name
        END as substitute_name,
        -psr.price_difference as price_difference,
        psr.is_bidirectional
    FROM product_substitution_rules psr
    LEFT JOIN toppings t ON psr.original_product_id = t.id AND psr.original_product_type = 'topping'
    LEFT JOIN platos p ON psr.original_product_id = p.id AND psr.original_product_type = 'plato'
    LEFT JOIN bebidas b ON psr.original_product_id = b.id AND psr.original_product_type = 'bebida'
    WHERE psr.substitute_product_id = p_product_id
      AND psr.substitute_product_type = p_product_type
      AND psr.is_active = true
      AND psr.is_bidirectional = true;
END;
$$ LANGUAGE plpgsql;

-- Permisos RLS
ALTER TABLE product_substitution_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read substitution rules" ON product_substitution_rules
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage substitution rules" ON product_substitution_rules
    FOR ALL
    TO authenticated
    USING (true);`);

    console.log(`\n📊 RESUMEN: ${rulesCount} reglas de sustitución creadas`);

    // Guardar el script completo
    const fullScript = sqlCommands.join('\n\n');
    fs.writeFileSync('complete_substitutions.sql', fullScript);

    console.log('\n✅ Script completo guardado en: complete_substitutions.sql');
    console.log('\n🚀 PRÓXIMO PASO: Ejecuta este archivo en Supabase SQL Editor');

    // Mostrar el script completo
    console.log('\n📄 CONTENIDO DEL SCRIPT:');
    console.log('==========================================');
    console.log(fullScript);
    console.log('==========================================');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAndCreateSubstitutions();