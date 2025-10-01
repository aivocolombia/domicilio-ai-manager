import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hcyxhuvyqvtlvfsnrhjw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjeXhodXZ5cXZ0bHZmc25yaGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjA2NTksImV4cCI6MjA2NzczNjY1OX0.NvBEq1Nofeu04OMRtd7Bwn_Je5MkmALSIm3kN-HkT0Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSubstitutions() {
  console.log('=== CHECKING TOPPING SUBSTITUTIONS ===\n');

  try {
    // First, let's check what substitution tables exist
    console.log('0. Checking what substitution tables exist:');

    // Check substitution_rules table
    const { data: subRules, error: subError } = await supabase
      .from('substitution_rules')
      .select('*')
      .limit(5);

    if (!subError) {
      console.log('Found substitution_rules table with', subRules?.length || 0, 'records');
      if (subRules && subRules.length > 0) {
        console.log('Sample record:', subRules[0]);
      }
    } else {
      console.log('substitution_rules table error:', subError.message);
    }

    // 1. Check current topping substitution rules
    console.log('\n1. Current topping substitution rules:');
    const { data: rules, error: rulesError } = await supabase
      .from('substitution_rules')
      .select('*')
      .eq('substitution_type', 'topping_substitution');

    if (rulesError) {
      console.error('Error fetching substitution rules:', rulesError);
      return;
    }

    console.log('Found', rules?.length || 0, 'topping substitution rules');
    if (rules && rules.length > 0) {
      console.table(rules);
    }

    // 2. Check for Platanitos and Mazorca
    console.log('\n2. Looking for Platanitos and Mazorca:');
    const { data: toppings, error: toppingsError } = await supabase
      .from('toppings')
      .select('id, name')
      .in('name', ['Platanitos', 'Mazorca']);

    if (toppingsError) {
      console.error('Error fetching toppings:', toppingsError);
      return;
    }

    console.table(toppings);

    const platanitos = toppings.find(t => t.name === 'Platanitos');
    const mazorca = toppings.find(t => t.name === 'Mazorca');

    if (!platanitos) {
      console.log('⚠️ Platanitos not found in toppings table');
    }
    if (!mazorca) {
      console.log('⚠️ Mazorca not found in toppings table');
    }

    // 3. Check if the rule already exists
    if (platanitos && mazorca) {
      console.log('\n3. Checking if Platanitos → Mazorca rule exists:');
      const { data: existingRule, error: existingError } = await supabase
        .from('substitution_rules')
        .select('*')
        .eq('substitution_type', 'topping_substitution')
        .eq('original_product_id', platanitos.id)
        .eq('substitute_product_id', mazorca.id);

      if (existingError) {
        console.error('Error checking existing rule:', existingError);
        return;
      }

      if (existingRule && existingRule.length > 0) {
        console.log('✅ Rule already exists:', existingRule[0]);
      } else {
        console.log('❌ Rule does not exist. Need to create it.');

        // 4. Create the rule
        console.log('\n4. Creating Platanitos → Mazorca substitution rule:');
        const { data: newRule, error: createError } = await supabase
          .from('substitution_rules')
          .insert({
            substitution_type: 'topping_substitution',
            original_product_id: platanitos.id,
            substitute_product_id: mazorca.id
          })
          .select();

        if (createError) {
          console.error('Error creating substitution rule:', createError);
        } else {
          console.log('✅ Successfully created rule:', newRule[0]);
        }
      }
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkSubstitutions();