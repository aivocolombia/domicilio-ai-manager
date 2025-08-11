// Tipos para el menú basados en el esquema de base de datos

export interface Plato {
  id: number;
  name: string;
  description: string | null;
  pricing: number; // Precio en pesos (sin decimales)
  available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Topping {
  id: number;
  name: string;
  pricing: number; // Precio en pesos (siempre 0 si viene incluido)
  available: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatoTopping {
  id: number;
  plato_id: number;
  "topping_Id": number;
  created_at: string;
}

export interface Bebida {
  id: number;
  name: string;
  pricing: number; // Precio en pesos (sin decimales)
  available: boolean;
  created_at: string;
  updated_at: string;
}

// Tipos para respuestas de API
export interface PlatoConToppings extends Plato {
  toppings: Topping[];
}

export interface MenuResponse {
  platos: PlatoConToppings[];
  bebidas: Bebida[];
  toppings?: Topping[]; // Opcional para compatibilidad con código existente
}

// Tipos para crear/actualizar productos
export interface CreatePlatoRequest {
  name: string;
  description?: string;
  pricing: number;
  available?: boolean;
  toppingIds?: number[]; // IDs de toppings existentes
}

export interface UpdatePlatoRequest {
  name?: string;
  description?: string;
  pricing?: number;
  available?: boolean;
  toppingIds?: number[];
}

export interface CreateBebidaRequest {
  name: string;
  pricing: number;
  available?: boolean;
}

export interface UpdateBebidaRequest {
  name?: string;
  pricing?: number;
  available?: boolean;
}

export interface CreateToppingRequest {
  name: string;
  pricing: number;
  available?: boolean;
}

export interface UpdateToppingRequest {
  name?: string;
  pricing?: number;
  available?: boolean;
} 