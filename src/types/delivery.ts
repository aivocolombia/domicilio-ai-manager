
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
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  toppings: Topping[];
}

export interface Topping {
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

export type OrderStatus = 'received' | 'kitchen' | 'delivery' | 'delivered' | 'cancelled';
export type OrderSource = 'ai_agent' | 'call_center' | 'web' | 'app';
export type PaymentMethod = 'card' | 'cash' | 'nequi' | 'transfer';
export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface DeliverySettings {
  acceptingOrders: boolean;
  defaultDeliveryTime: number; // minutes
  maxOrdersPerHour: number;
  deliveryFee: number;
}
