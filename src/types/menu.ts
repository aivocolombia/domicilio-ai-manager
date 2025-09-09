// Tipos para el menú basados en el esquema de base de datos

export interface Plato {
  id: number; // bigint in DB
  name: string | null; // nullable in DB
  description: string | null;
  pricing: number | null; // integer, nullable in DB
  created_at: string;
  updated_at: string | null; // nullable in DB
}

export interface Topping {
  id: number; // integer in DB
  name: string | null; // nullable in DB
  pricing: number | null; // smallint, nullable in DB
  created_at: string;
  updated_at: string | null; // nullable in DB
}

export interface PlatoTopping {
  id: number; // bigint in DB
  plato_id: number | null; // bigint, nullable in DB
  topping_id: number | null; // integer, nullable in DB
  created_at: string;
}

export interface Bebida {
  id: number; // smallint in DB
  name: string | null; // nullable in DB
  pricing: number | null; // bigint, nullable in DB
  created_at: string;
  updated_at: string | null; // nullable in DB
}

// Nuevas interfaces para disponibilidad por sede
export interface SedePlato {
  sede_id: string; // uuid in DB
  plato_id: number; // bigint in DB
  available: boolean | null; // nullable in DB
  price_override: number | null; // integer, nullable in DB
  updated_at: string | null; // nullable in DB
}

export interface SedeBebida {
  sede_id: string; // uuid in DB
  bebida_id: number; // smallint in DB
  available: boolean | null; // nullable in DB
  price_override: number | null; // integer, nullable in DB
  updated_at: string | null; // nullable in DB
}

export interface SedeTopping {
  sede_id: string; // uuid in DB
  topping_id: number; // integer in DB
  available: boolean | null; // nullable in DB
  price_override: number | null; // integer, nullable in DB
  updated_at: string | null; // nullable in DB
}

// Interfaces para productos con información de sede
export interface PlatoConSede extends Plato {
  sede_available: boolean;
  sede_price: number; // Precio final para esta sede
  sede_is_available: boolean; // Alias para compatibilidad
  sede_pricing: number; // Alias para compatibilidad
  toppings: ToppingConSede[];
}

export interface BebidaConSede extends Bebida {
  sede_available: boolean;
  sede_price: number; // Precio final para esta sede
  sede_is_available: boolean; // Alias para compatibilidad
  sede_pricing: number; // Alias para compatibilidad
}

export interface ToppingConSede extends Topping {
  sede_available: boolean;
  sede_price: number; // Precio final para esta sede
  sede_is_available: boolean; // Alias para compatibilidad
  sede_pricing: number; // Alias para compatibilidad
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

// Nueva interfaz para menú con información de sede
export interface MenuResponseConSede {
  platos: PlatoConSede[];
  bebidas: BebidaConSede[];
  toppings?: ToppingConSede[];
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