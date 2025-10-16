import { Ingredient, Recipe, Product } from '@/types/inventory';

// Ingredientes/Insumos del restaurante
export const MOCK_INGREDIENTS: Ingredient[] = [
  // Proteínas
  { id: 'ing-1', name: 'Pollo', stock: 15, unit: 'kg', minStock: 10, cost: 8000, category: 'proteina' },
  { id: 'ing-2', name: 'Carne de Res', stock: 8, unit: 'kg', minStock: 10, cost: 18000, category: 'proteina' },
  { id: 'ing-3', name: 'Carne de Cerdo', stock: 12, unit: 'kg', minStock: 8, cost: 12000, category: 'proteina' },
  { id: 'ing-4', name: 'Pescado', stock: 3, unit: 'kg', minStock: 5, cost: 15000, category: 'proteina' },
  { id: 'ing-5', name: 'Chorizo', stock: 5, unit: 'kg', minStock: 3, cost: 10000, category: 'proteina' },
  { id: 'ing-6', name: 'Chicharrón', stock: 4, unit: 'kg', minStock: 3, cost: 12000, category: 'proteina' },
  { id: 'ing-7', name: 'Huevo', stock: 60, unit: 'unidades', minStock: 50, cost: 500, category: 'proteina' },
  { id: 'ing-8', name: 'Gallina', stock: 8, unit: 'kg', minStock: 5, cost: 12000, category: 'proteina' },

  // Vegetales
  { id: 'ing-9', name: 'Papa', stock: 25, unit: 'kg', minStock: 15, cost: 2000, category: 'vegetal' },
  { id: 'ing-10', name: 'Mazorca', stock: 20, unit: 'unidades', minStock: 15, cost: 1500, category: 'vegetal' },
  { id: 'ing-11', name: 'Yuca', stock: 10, unit: 'kg', minStock: 8, cost: 2500, category: 'vegetal' },
  { id: 'ing-12', name: 'Plátano', stock: 30, unit: 'unidades', minStock: 20, cost: 1000, category: 'vegetal' },
  { id: 'ing-13', name: 'Aguacate', stock: 15, unit: 'unidades', minStock: 10, cost: 2000, category: 'vegetal' },
  { id: 'ing-14', name: 'Tomate', stock: 8, unit: 'kg', minStock: 5, cost: 3000, category: 'vegetal' },
  { id: 'ing-15', name: 'Cebolla', stock: 12, unit: 'kg', minStock: 8, cost: 2500, category: 'vegetal' },
  { id: 'ing-16', name: 'Ajo', stock: 3, unit: 'kg', minStock: 2, cost: 8000, category: 'vegetal' },
  { id: 'ing-17', name: 'Cilantro', stock: 2, unit: 'kg', minStock: 1, cost: 4000, category: 'vegetal' },
  { id: 'ing-18', name: 'Guascas', stock: 1.5, unit: 'kg', minStock: 0.5, cost: 15000, category: 'vegetal' },

  // Granos
  { id: 'ing-19', name: 'Arroz', stock: 40, unit: 'kg', minStock: 30, cost: 3500, category: 'grano' },
  { id: 'ing-20', name: 'Frijol', stock: 20, unit: 'kg', minStock: 15, cost: 5000, category: 'grano' },
  { id: 'ing-21', name: 'Arepa', stock: 100, unit: 'unidades', minStock: 50, cost: 800, category: 'grano' },

  // Lácteos
  { id: 'ing-22', name: 'Crema de Leche', stock: 8, unit: 'l', minStock: 5, cost: 8000, category: 'lacteo' },
  { id: 'ing-23', name: 'Leche', stock: 15, unit: 'l', minStock: 10, cost: 3500, category: 'lacteo' },

  // Condimentos y otros
  { id: 'ing-24', name: 'Aceite', stock: 8, unit: 'l', minStock: 5, cost: 12000, category: 'condimento' },
  { id: 'ing-25', name: 'Sal', stock: 5, unit: 'kg', minStock: 3, cost: 2000, category: 'condimento' },
  { id: 'ing-26', name: 'Alcaparra', stock: 2, unit: 'kg', minStock: 1, cost: 15000, category: 'condimento' },
  { id: 'ing-27', name: 'Especias', stock: 3, unit: 'kg', minStock: 2, cost: 10000, category: 'condimento' },

  // Bebidas (ingredientes base)
  { id: 'ing-28', name: 'Frutas para Jugo', stock: 25, unit: 'kg', minStock: 15, cost: 4000, category: 'bebida' },
  { id: 'ing-29', name: 'Gaseosa Embotellada', stock: 45, unit: 'unidades', minStock: 30, cost: 2000, category: 'bebida' },
  { id: 'ing-30', name: 'Agua Embotellada', stock: 50, unit: 'unidades', minStock: 30, cost: 1500, category: 'bebida' },
  { id: 'ing-31', name: 'Cerveza', stock: 24, unit: 'unidades', minStock: 20, cost: 2500, category: 'bebida' },
  { id: 'ing-32', name: 'Limón', stock: 10, unit: 'kg', minStock: 5, cost: 3500, category: 'bebida' },
  { id: 'ing-33', name: 'Azúcar', stock: 15, unit: 'kg', minStock: 10, cost: 3000, category: 'condimento' },
  { id: 'ing-34', name: 'Café', stock: 5, unit: 'kg', minStock: 3, cost: 18000, category: 'bebida' },
];

// Recetas de cada plato (cantidades por porción)
export const RECIPES: Recipe[] = [
  {
    productId: 'p1',
    productName: 'Ajiaco Santafereño',
    ingredients: [
      { ingredientId: 'ing-1', quantity: 0.25 }, // 250g pollo
      { ingredientId: 'ing-9', quantity: 0.3 },  // 300g papa
      { ingredientId: 'ing-10', quantity: 1 },   // 1 mazorca
      { ingredientId: 'ing-18', quantity: 0.02 }, // 20g guascas
      { ingredientId: 'ing-22', quantity: 0.05 }, // 50ml crema
      { ingredientId: 'ing-13', quantity: 0.5 },  // medio aguacate
      { ingredientId: 'ing-26', quantity: 0.01 }  // 10g alcaparras
    ]
  },
  {
    productId: 'p2',
    productName: 'Bandeja Paisa',
    ingredients: [
      { ingredientId: 'ing-2', quantity: 0.2 },   // 200g carne
      { ingredientId: 'ing-5', quantity: 0.1 },   // 100g chorizo
      { ingredientId: 'ing-6', quantity: 0.1 },   // 100g chicharrón
      { ingredientId: 'ing-19', quantity: 0.15 }, // 150g arroz
      { ingredientId: 'ing-20', quantity: 0.1 },  // 100g frijol
      { ingredientId: 'ing-7', quantity: 1 },     // 1 huevo
      { ingredientId: 'ing-12', quantity: 1 },    // 1 plátano
      { ingredientId: 'ing-21', quantity: 1 },    // 1 arepa
      { ingredientId: 'ing-13', quantity: 0.5 }   // medio aguacate
    ]
  },
  {
    productId: 'p3',
    productName: 'Sancocho de Gallina',
    ingredients: [
      { ingredientId: 'ing-8', quantity: 0.3 },   // 300g gallina
      { ingredientId: 'ing-9', quantity: 0.25 },  // 250g papa
      { ingredientId: 'ing-11', quantity: 0.2 },  // 200g yuca
      { ingredientId: 'ing-12', quantity: 1 },    // 1 plátano
      { ingredientId: 'ing-10', quantity: 1 },    // 1 mazorca
      { ingredientId: 'ing-17', quantity: 0.02 }, // 20g cilantro
      { ingredientId: 'ing-19', quantity: 0.1 }   // 100g arroz
    ]
  },
  {
    productId: 'p4',
    productName: 'Mondongo',
    ingredients: [
      { ingredientId: 'ing-3', quantity: 0.25 },  // 250g cerdo (mondongo)
      { ingredientId: 'ing-9', quantity: 0.2 },   // 200g papa
      { ingredientId: 'ing-11', quantity: 0.15 }, // 150g yuca
      { ingredientId: 'ing-9', quantity: 0.15 },  // 150g papa
      { ingredientId: 'ing-17', quantity: 0.02 }, // 20g cilantro
      { ingredientId: 'ing-19', quantity: 0.1 }   // 100g arroz
    ]
  },
  {
    productId: 'p5',
    productName: 'Carne Asada',
    ingredients: [
      { ingredientId: 'ing-2', quantity: 0.3 },   // 300g carne
      { ingredientId: 'ing-9', quantity: 0.2 },   // 200g papa
      { ingredientId: 'ing-19', quantity: 0.15 }, // 150g arroz
      { ingredientId: 'ing-12', quantity: 1 },    // 1 plátano
      { ingredientId: 'ing-21', quantity: 1 }     // 1 arepa
    ]
  },
  {
    productId: 'p6',
    productName: 'Pollo a la Plancha',
    ingredients: [
      { ingredientId: 'ing-1', quantity: 0.3 },   // 300g pollo
      { ingredientId: 'ing-9', quantity: 0.2 },   // 200g papa
      { ingredientId: 'ing-19', quantity: 0.15 }, // 150g arroz
      { ingredientId: 'ing-14', quantity: 0.05 }, // 50g tomate
      { ingredientId: 'ing-15', quantity: 0.03 }  // 30g cebolla
    ]
  },
  {
    productId: 'p7',
    productName: 'Pescado Frito',
    ingredients: [
      { ingredientId: 'ing-4', quantity: 0.3 },   // 300g pescado
      { ingredientId: 'ing-9', quantity: 0.2 },   // 200g papa
      { ingredientId: 'ing-19', quantity: 0.15 }, // 150g arroz
      { ingredientId: 'ing-12', quantity: 1 },    // 1 plátano
      { ingredientId: 'ing-24', quantity: 0.05 }  // 50ml aceite
    ]
  },
  {
    productId: 'p8',
    productName: 'Arroz con Pollo',
    ingredients: [
      { ingredientId: 'ing-1', quantity: 0.25 },  // 250g pollo
      { ingredientId: 'ing-19', quantity: 0.2 },  // 200g arroz
      { ingredientId: 'ing-9', quantity: 0.1 },   // 100g papa
      { ingredientId: 'ing-14', quantity: 0.05 }, // 50g tomate
      { ingredientId: 'ing-15', quantity: 0.03 }, // 30g cebolla
      { ingredientId: 'ing-12', quantity: 1 }     // 1 plátano
    ]
  },
  // Bebidas
  {
    productId: 'b1',
    productName: 'Jugo Natural',
    ingredients: [
      { ingredientId: 'ing-28', quantity: 0.3 },  // 300g fruta
      { ingredientId: 'ing-33', quantity: 0.03 }, // 30g azúcar
      { ingredientId: 'ing-30', quantity: 0.2 }   // 200ml agua (reutilizando)
    ]
  },
  {
    productId: 'b2',
    productName: 'Gaseosa',
    ingredients: [
      { ingredientId: 'ing-29', quantity: 1 }     // 1 unidad
    ]
  },
  {
    productId: 'b3',
    productName: 'Agua',
    ingredients: [
      { ingredientId: 'ing-30', quantity: 1 }     // 1 unidad
    ]
  },
  {
    productId: 'b4',
    productName: 'Cerveza',
    ingredients: [
      { ingredientId: 'ing-31', quantity: 1 }     // 1 unidad
    ]
  },
  {
    productId: 'b5',
    productName: 'Limonada Natural',
    ingredients: [
      { ingredientId: 'ing-32', quantity: 0.15 }, // 150g limón
      { ingredientId: 'ing-33', quantity: 0.04 }, // 40g azúcar
      { ingredientId: 'ing-30', quantity: 0.3 }   // 300ml agua
    ]
  },
  {
    productId: 'b6',
    productName: 'Café',
    ingredients: [
      { ingredientId: 'ing-34', quantity: 0.015 }, // 15g café
      { ingredientId: 'ing-33', quantity: 0.02 },  // 20g azúcar
      { ingredientId: 'ing-23', quantity: 0.05 }   // 50ml leche
    ]
  }
];

export const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Ajiaco Santafereño', category: 'plato', price: 18000, available: true, recipeId: 'p1' },
  { id: 'p2', name: 'Bandeja Paisa', category: 'plato', price: 25000, available: true, recipeId: 'p2' },
  { id: 'p3', name: 'Sancocho de Gallina', category: 'plato', price: 20000, available: true, recipeId: 'p3' },
  { id: 'p4', name: 'Mondongo', category: 'plato', price: 19000, available: true, recipeId: 'p4' },
  { id: 'p5', name: 'Carne Asada', category: 'plato', price: 22000, available: true, recipeId: 'p5' },
  { id: 'p6', name: 'Pollo a la Plancha', category: 'plato', price: 18000, available: true, recipeId: 'p6' },
  { id: 'p7', name: 'Pescado Frito', category: 'plato', price: 24000, available: true, recipeId: 'p7' },
  { id: 'p8', name: 'Arroz con Pollo', category: 'plato', price: 17000, available: true, recipeId: 'p8' },
  { id: 'b1', name: 'Jugo Natural', category: 'bebida', price: 5000, available: true, recipeId: 'b1' },
  { id: 'b2', name: 'Gaseosa', category: 'bebida', price: 3500, available: true, recipeId: 'b2' },
  { id: 'b3', name: 'Agua', category: 'bebida', price: 2500, available: true, recipeId: 'b3' },
  { id: 'b4', name: 'Cerveza', category: 'bebida', price: 4500, available: true, recipeId: 'b4' },
  { id: 'b5', name: 'Limonada Natural', category: 'bebida', price: 5500, available: true, recipeId: 'b5' },
  { id: 'b6', name: 'Café', category: 'bebida', price: 3000, available: true, recipeId: 'b6' },
];

// Calcular cuántas porciones se pueden hacer de un producto
export const calculateAvailablePortions = (
  productId: string,
  ingredients: Ingredient[],
  recipes: Recipe[]
): number => {
  const recipe = recipes.find(r => r.productId === productId);
  if (!recipe) return 0;

  let minPortions = Infinity;

  for (const recipeIngredient of recipe.ingredients) {
    const ingredient = ingredients.find(i => i.id === recipeIngredient.ingredientId);
    if (!ingredient) {
      return 0; // Si falta un ingrediente, no se puede hacer
    }

    const possiblePortions = Math.floor(ingredient.stock / recipeIngredient.quantity);
    minPortions = Math.min(minPortions, possiblePortions);
  }

  return minPortions === Infinity ? 0 : minPortions;
};

// Obtener el ingrediente limitante (el que menos porciones permite)
export const getLimitingIngredient = (
  productId: string,
  ingredients: Ingredient[],
  recipes: Recipe[]
): { ingredient: Ingredient; portions: number } | null => {
  const recipe = recipes.find(r => r.productId === productId);
  if (!recipe) return null;

  let minPortions = Infinity;
  let limitingIngredient: Ingredient | null = null;

  for (const recipeIngredient of recipe.ingredients) {
    const ingredient = ingredients.find(i => i.id === recipeIngredient.ingredientId);
    if (!ingredient) continue;

    const possiblePortions = Math.floor(ingredient.stock / recipeIngredient.quantity);
    if (possiblePortions < minPortions) {
      minPortions = possiblePortions;
      limitingIngredient = ingredient;
    }
  }

  if (!limitingIngredient) return null;

  return {
    ingredient: limitingIngredient,
    portions: minPortions === Infinity ? 0 : minPortions
  };
};
