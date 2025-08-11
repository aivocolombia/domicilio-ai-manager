export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  estimatedDeliveryTime: Date;
  actualDeliveryTime?: Date;
  createdAt: Date;
  source: OrderSource;
  specialInstructions?: string;
  extraTime?: number;
  extraTimeReason?: string;
  assignedDeliveryPersonId?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  originSede?: string; // Nueva propiedad para sede de origen
  assignedSede?: string; // Nueva propiedad para sede asignada
  deliveryType: DeliveryType; // Nueva propiedad para tipo de entrega
  pickupSede?: string; // Sede donde se recoge el pedido (solo para pickup)
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  toppings: OrderTopping[];
}

export interface OrderTopping {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isAvailable: boolean;
  estimatedPrepTime: number; // minutes
}

export interface InventoryItem extends Product {
  availableToppings: Topping[];
}

export interface DeliveryPerson {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: Date;
  totalDeliveries: number;
  activeOrders: number;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'callcenter' | 'sede' | 'repartidor';
  sede: string;
  phone?: string;
  createdAt: Date;
}

export interface Sede {
  id: string;
  name: string;
  address: string;
  phone: string;
  isActive: boolean;
  currentCapacity: number;
  maxCapacity: number;
}

export type OrderStatus = 'received' | 'kitchen' | 'delivery' | 'delivered' | 'cancelled' | 'ready_pickup';
export type OrderSource = 'ai_agent' | 'call_center' | 'web' | 'app' | 'sede';
export type PaymentMethod = 'card' | 'cash' | 'nequi' | 'transfer';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type DeliveryType = 'delivery' | 'pickup'; // Nuevo tipo para método de entrega

export interface DeliverySettings {
  acceptingOrders: boolean;
  defaultDeliveryTime: number; // minutes
  maxOrdersPerHour: number;
  deliveryFee: number;
}

// Tipos para productos
export interface PlatoFuerte {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  image_url: string | null;
  category: string;
  preparation_time: number;
  created_at: string;
  updated_at: string;
}

export interface Topping {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface PlatoTopping {
  id: string;
  plato_fuerte_id: string;
  topping_id: string;
  is_default: boolean;
  created_at: string;
}

export interface Bebida {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  image_url: string | null;
  category: string;
  size: string;
  created_at: string;
  updated_at: string;
}

// Tipo para productos con toppings incluidos
export interface PlatoFuerteConToppings extends PlatoFuerte {
  toppings?: Topping[];
  default_toppings?: Topping[];
}

// Tipo para inventario actualizado
export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  price: number;
  isAvailable: boolean;
  category: 'plato_fuerte' | 'topping' | 'bebida';
  stock?: number;
  imageUrl?: string;
  preparationTime?: number;
  size?: string;
  toppings?: Topping[];
}
