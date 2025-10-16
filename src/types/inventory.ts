// Tipos para el sistema de inventario

export type UnitOfMeasure = 'kg' | 'g' | 'l' | 'ml' | 'unidades';

export interface Ingredient {
  id: string;
  name: string;
  stock: number; // Cantidad actual en la unidad especificada
  unit: UnitOfMeasure;
  minStock: number; // Stock mínimo recomendado
  cost: number; // Costo por unidad
  category: 'proteina' | 'vegetal' | 'grano' | 'lacteo' | 'condimento' | 'bebida' | 'otro';
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number; // Cantidad necesaria en la unidad del ingrediente
}

export interface Recipe {
  productId: string; // ID del plato/bebida
  productName: string;
  ingredients: RecipeIngredient[];
}

export interface Product {
  id: string;
  name: string;
  category: 'plato' | 'bebida';
  price: number;
  available: boolean;
  recipeId?: string; // Referencia a la receta si tiene
}

export interface InventoryStats {
  totalIngredients: number;
  lowStock: number;
  outOfStock: number;
  totalProducts: number;
  availableProducts: number;
}
