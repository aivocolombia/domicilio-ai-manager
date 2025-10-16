import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  DollarSign,
  User,
  UtensilsCrossed
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  price: number;
  category: 'plato' | 'bebida';
  image?: string;
}

interface OrderItem {
  product: Product;
  quantity: number;
}

interface OrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tableNumber: number;
  onConfirm: (customerName: string, items: OrderItem[], total: number) => void;
}

// Datos mock de productos
const MOCK_PRODUCTS: Product[] = [
  // Platos
  { id: 'p1', name: 'Ajiaco Santafereño', price: 18000, category: 'plato' },
  { id: 'p2', name: 'Bandeja Paisa', price: 25000, category: 'plato' },
  { id: 'p3', name: 'Sancocho de Gallina', price: 20000, category: 'plato' },
  { id: 'p4', name: 'Mondongo', price: 19000, category: 'plato' },
  { id: 'p5', name: 'Carne Asada', price: 22000, category: 'plato' },
  { id: 'p6', name: 'Pollo a la Plancha', price: 18000, category: 'plato' },
  { id: 'p7', name: 'Pescado Frito', price: 24000, category: 'plato' },
  { id: 'p8', name: 'Arroz con Pollo', price: 17000, category: 'plato' },

  // Bebidas
  { id: 'b1', name: 'Jugo Natural', price: 5000, category: 'bebida' },
  { id: 'b2', name: 'Gaseosa', price: 3500, category: 'bebida' },
  { id: 'b3', name: 'Agua', price: 2500, category: 'bebida' },
  { id: 'b4', name: 'Cerveza', price: 4500, category: 'bebida' },
  { id: 'b5', name: 'Limonada Natural', price: 5500, category: 'bebida' },
  { id: 'b6', name: 'Café', price: 3000, category: 'bebida' },
];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const OrderDialog: React.FC<OrderDialogProps> = ({
  isOpen,
  onClose,
  tableNumber,
  onConfirm
}) => {
  const [customerName, setCustomerName] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<'plato' | 'bebida'>('plato');

  // Filtrar productos por categoría
  const filteredProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter(p => p.category === activeCategory);
  }, [activeCategory]);

  // Calcular total
  const total = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  }, [orderItems]);

  // Validar si el botón debe estar deshabilitado
  const isConfirmDisabled = useMemo(() => orderItems.length === 0, [orderItems.length]);

  // Agregar producto al pedido
  const addProduct = (product: Product) => {
    setOrderItems(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);

      if (existingItem) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, { product, quantity: 1 }];
    });
  };

  // Actualizar cantidad
  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeProduct(productId);
      return;
    }

    setOrderItems(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  // Remover producto
  const removeProduct = (productId: string) => {
    setOrderItems(prev => prev.filter(item => item.product.id !== productId));
  };

  // Limpiar y cerrar
  const handleClose = () => {
    setCustomerName('');
    setOrderItems([]);
    setActiveCategory('plato');
    onClose();
  };

  // Confirmar pedido
  const handleConfirm = () => {
    if (orderItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Agrega al menos un producto al pedido',
        variant: 'destructive'
      });
      return;
    }

    const normalizedName = customerName.trim();
    onConfirm(normalizedName, orderItems, total);
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <UtensilsCrossed className="h-6 w-6" />
            Nuevo Pedido - Mesa {tableNumber}
          </DialogTitle>
          <DialogDescription>
            Selecciona los productos y agrega al pedido
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 pb-4 overflow-y-auto flex-1">
          {/* Columna izquierda: Productos */}
          <div className="md:col-span-2 space-y-4">
            {/* Campo nombre del cliente */}
            <div className="space-y-2">
              <Label htmlFor="customer-name" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Nombre del Cliente (opcional)
              </Label>
              <Input
                id="customer-name"
                type="text"
                placeholder="Ej: Juan Pérez"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoComplete="off"
              />
              {/* Debug info */}
              {customerName && (
                <p className="text-xs text-muted-foreground">
                  Nombre: {customerName} ({customerName.length} caracteres)
                </p>
              )}
            </div>

            {/* Tabs de categorías */}
            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="plato">Platos</TabsTrigger>
                <TabsTrigger value="bebida">Bebidas</TabsTrigger>
              </TabsList>

              <TabsContent value={activeCategory} className="mt-4">
                <div className="h-[280px] overflow-y-auto pr-4">
                  <div className="grid grid-cols-2 gap-3">
                    {filteredProducts.map((product) => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => addProduct(product)}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm">{product.name}</h4>
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(product.price)}
                            </p>
                            <Button
                              size="sm"
                              className="w-full"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                addProduct(product);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Agregar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Columna derecha: Resumen del pedido */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Pedido
                </h3>
                <Badge variant="secondary">{orderItems.length} items</Badge>
              </div>
              {/* Debug info */}
              <p className="text-xs text-muted-foreground">
                Productos: {orderItems.length} | Botón bloqueado: {isConfirmDisabled ? 'Sí' : 'No'}
              </p>
            </div>

            <div className="h-[260px] overflow-y-auto pr-4">
              {orderItems.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay productos agregados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <Card key={item.product.id}>
                      <CardContent className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{item.product.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(item.product.price)} c/u
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeProduct(item.product.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-semibold">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="font-bold text-sm">
                              {formatCurrency(item.product.price * item.quantity)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <Card className="bg-brand-primary text-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    <span className="font-semibold">TOTAL</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {formatCurrency(total)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 flex-shrink-0 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirmDisabled} className="min-w-[140px]">
            Confirmar Pedido ({orderItems.length} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
