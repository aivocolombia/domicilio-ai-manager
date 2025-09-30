/**
 * Script para investigar la estructura real de la base de datos
 * y obtener los productos existentes para las sustituciones
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU1NDU5MzAsImV4cCI6MjA0MTEyMTkzMH0.zGLBOVo_7OxGP4i8lBOhUtLpWOjlHDBwdQJXFI0TJPo';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Investigando estructura de la base de datos...\n');

async function investigateDatabase() {
  try {
    console.log('📊 1. VERIFICANDO TABLA TOPPINGS:');
    const { data: toppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .order('name');

    if (toppingsError) {
      console.error('❌ Error en toppings:', toppingsError);
    } else {
      console.log(`✅ ${toppings.length} toppings encontrados:`);
      toppings.forEach(t => {
        console.log(`   ${t.id}: ${t.name}`);
      });
    }

    console.log('\n📊 2. VERIFICANDO TABLA PLATOS:');
    const { data: platos, error: platosError } = await supabase
      .from('platos')
      .select('id, name')
      .order('name');

    if (platosError) {
      console.error('❌ Error en platos:', platosError);
    } else {
      console.log(`✅ ${platos.length} platos encontrados:`);
      platos.forEach(p => {
        console.log(`   ${p.id}: ${p.name}`);
      });
    }

    console.log('\n📊 3. VERIFICANDO TABLA BEBIDAS:');
    const { data: bebidas, error: bebidasError } = await supabase
      .from('bebidas')
      .select('id, name')
      .order('name');

    if (bebidasError) {
      console.error('❌ Error en bebidas:', bebidasError);
    } else {
      console.log(`✅ ${bebidas.length} bebidas encontradas:`);
      bebidas.forEach(b => {
        console.log(`   ${b.id}: ${b.name}`);
      });
    }

    console.log('\n🎯 4. BUSCANDO PRODUCTOS ESPECÍFICOS PARA SUSTITUCIONES:');

    const targetProducts = [
      'mazorca', 'plátano', 'platano', 'arroz', 'aguacate',
      'carne', 'tocino', 'pollo', 'porción', 'porcion'
    ];

    console.log('\n🔍 En TOPPINGS:');
    const relevantToppings = toppings.filter(t =>
      targetProducts.some(target =>
        t.name.toLowerCase().includes(target.toLowerCase())
      )
    );

    relevantToppings.forEach(t => {
      console.log(`   ✅ ID ${t.id}: ${t.name}`);
    });

    console.log('\n🔍 En PLATOS:');
    const relevantPlatos = platos.filter(p =>
      targetProducts.some(target =>
        p.name.toLowerCase().includes(target.toLowerCase())
      )
    );

    relevantPlatos.forEach(p => {
      console.log(`   ✅ ID ${p.id}: ${p.name}`);
    });

    console.log('\n📋 5. GENERANDO SCRIPT SQL CORREGIDO:');
    console.log('-- CREAR TABLA (si no existe)');
    console.log(`CREATE TABLE IF NOT EXISTS product_substitution_rules (
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
);`);

    console.log('\n-- ÍNDICES');
    console.log(`CREATE INDEX IF NOT EXISTS idx_substitution_original ON product_substitution_rules(original_product_id, original_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_substitute ON product_substitution_rules(substitute_product_id, substitute_product_type);
CREATE INDEX IF NOT EXISTS idx_substitution_active ON product_substitution_rules(is_active);`);

    console.log('\n-- CONSTRAINT ÚNICO');
    console.log(`ALTER TABLE product_substitution_rules
ADD CONSTRAINT IF NOT EXISTS unique_substitution_rule
UNIQUE (original_product_id, original_product_type, substitute_product_id, substitute_product_type);`);

    // Generar reglas con IDs reales
    console.log('\n-- INSERTAR REGLAS CON IDs REALES:');

    // Buscar productos específicos
    const mazorca = toppings.find(t => t.name.toLowerCase().includes('mazorca'));
    const platano = toppings.find(t => t.name.toLowerCase().includes('plátano') || t.name.toLowerCase().includes('platano'));
    const arroz = toppings.find(t => t.name.toLowerCase().includes('arroz'));
    const aguacate = toppings.find(t => t.name.toLowerCase().includes('aguacate'));
    const carne = toppings.find(t => t.name.toLowerCase().includes('carne'));
    const pollo = toppings.find(t => t.name.toLowerCase().includes('pollo'));
    const tocino = toppings.find(t => t.name.toLowerCase().includes('tocino'));

    const substitutions = [];

    if (mazorca && platano) {
      substitutions.push({
        original: mazorca,
        substitute: platano,
        price_diff: 0,
        bidirectional: true,
        note: 'Mazorca y Plátano intercambiables - $3,700'
      });
    }

    if (arroz && aguacate) {
      substitutions.push({
        original: arroz,
        substitute: aguacate,
        price_diff: -600,
        bidirectional: false,
        note: 'Arroz ($4,800) → Aguacate ($4,200)'
      });
    }

    if (arroz && platano) {
      substitutions.push({
        original: arroz,
        substitute: platano,
        price_diff: -1100,
        bidirectional: false,
        note: 'Arroz ($4,800) → Plátano ($3,700)'
      });
    }

    if (arroz && mazorca) {
      substitutions.push({
        original: arroz,
        substitute: mazorca,
        price_diff: -1100,
        bidirectional: false,
        note: 'Arroz ($4,800) → Mazorca ($3,700)'
      });
    }

    if (carne && pollo) {
      substitutions.push({
        original: carne,
        substitute: pollo,
        price_diff: 0,
        bidirectional: true,
        note: 'Porción carne y pollo intercambiables - $6,300'
      });
    }

    if (tocino && carne) {
      substitutions.push({
        original: tocino,
        substitute: carne,
        price_diff: -2100,
        bidirectional: false,
        note: 'Tocino ($8,400) → Porción carne ($6,300)'
      });
    }

    if (aguacate && mazorca) {
      substitutions.push({
        original: aguacate,
        substitute: mazorca,
        price_diff: -500,
        bidirectional: false,
        note: 'Aguacate ($4,200) → Mazorca ($3,700)'
      });
    }

    if (aguacate && platano) {
      substitutions.push({
        original: aguacate,
        substitute: platano,
        price_diff: -500,
        bidirectional: false,
        note: 'Aguacate ($4,200) → Plátano ($3,700)'
      });
    }

    substitutions.forEach((sub, index) => {
      console.log(`\n-- Regla ${index + 1}: ${sub.note}`);
      console.log(`INSERT INTO product_substitution_rules
(original_product_id, original_product_type, substitute_product_id, substitute_product_type, price_difference, is_bidirectional, notes)
VALUES
(${sub.original.id}, 'topping', ${sub.substitute.id}, 'topping', ${sub.price_diff}, ${sub.bidirectional}, '${sub.note}');`);
    });

    console.log('\n-- PERMISOS RLS');
    console.log(`ALTER TABLE product_substitution_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read substitution rules" ON product_substitution_rules
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY IF NOT EXISTS "Admins can manage substitution rules" ON product_substitution_rules
    FOR ALL
    TO authenticated
    USING (true);`);

    console.log('\n-- FUNCIÓN PARA OBTENER SUSTITUCIONES');
    console.log(`CREATE OR REPLACE FUNCTION get_available_substitutions(
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
$$ LANGUAGE plpgsql;`);

    console.log(`\n✅ TOTAL DE REGLAS A CREAR: ${substitutions.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

investigateDatabase();