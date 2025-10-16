import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Trash2,
  Users,
  Check,
  X,
  AlertCircle,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { OrderDialog } from './OrderDialog';
import { PaymentDialog } from './PaymentDialog';

interface OrderItem {
  product: {
    id: string;
    name: string;
    price: number;
  };
  quantity: number;
}

export interface Table {
  id: string;
  number: number;
  seats: number;
  isActive: boolean;
  isOccupied: boolean;
  currentOrderId?: string;
  customerName?: string;
  occupiedSince?: number;
  orderItems?: OrderItem[];
}

interface TableManagementProps {
  onSelectTable: (table: Table) => void;
}

const WAIT_THRESHOLD_MINUTES = 20;

export const TableManagement: React.FC<TableManagementProps> = ({ onSelectTable }) => {
  const [_refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setRefreshTick((prev) => prev + 1), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const now = Date.now();

  // Estado inicial con algunas mesas de ejemplo
  const [tables, setTables] = useState<Table[]>([
    { id: 't-1', number: 1, seats: 4, isActive: true, isOccupied: false },
    {
      id: 't-2',
      number: 2,
      seats: 4,
      isActive: true,
      isOccupied: true,
      customerName: 'Juan Pérez',
      occupiedSince: now - 12 * 60 * 1000,
      orderItems: [
        { product: { id: 'p1', name: 'Ajiaco Santafereño', price: 18000 }, quantity: 2 },
        { product: { id: 'b1', name: 'Jugo Natural', price: 5000 }, quantity: 2 }
      ]
    },
    { id: 't-3', number: 3, seats: 2, isActive: true, isOccupied: false },
    {
      id: 't-4',
      number: 4,
      seats: 6,
      isActive: true,
      isOccupied: true,
      customerName: 'María García',
      occupiedSince: now - 28 * 60 * 1000,
      orderItems: [
        { product: { id: 'p2', name: 'Bandeja Paisa', price: 25000 }, quantity: 1 },
        { product: { id: 'p5', name: 'Carne Asada', price: 22000 }, quantity: 1 },
        { product: { id: 'b2', name: 'Gaseosa', price: 3500 }, quantity: 3 }
      ]
    },
    { id: 't-5', number: 5, seats: 4, isActive: true, isOccupied: false },
    { id: 't-6', number: 6, seats: 2, isActive: true, isOccupied: false },
    { id: 't-7', number: 7, seats: 8, isActive: true, isOccupied: false },
    { id: 't-8', number: 8, seats: 4, isActive: false, isOccupied: false },
  ]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableSeats, setNewTableSeats] = useState('4');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // Crear nueva mesa
  const handleCreateTable = () => {
    const tableNumber = parseInt(newTableNumber);
    const seats = parseInt(newTableSeats);

    // Validaciones
    if (!tableNumber || tableNumber < 1) {
      toast({
        title: 'Error',
        description: 'El número de mesa debe ser mayor a 0',
        variant: 'destructive'
      });
      return;
    }

    if (tables.some(t => t.number === tableNumber)) {
      toast({
        title: 'Error',
        description: `La mesa ${tableNumber} ya existe`,
        variant: 'destructive'
      });
      return;
    }

    if (!seats || seats < 1 || seats > 20) {
      toast({
        title: 'Error',
        description: 'El número de puestos debe estar entre 1 y 20',
        variant: 'destructive'
      });
      return;
    }

    const newTable: Table = {
      id: `t-${Date.now()}`,
      number: tableNumber,
      seats,
      isActive: true,
      isOccupied: false
    };

    setTables(prev => [...prev, newTable].sort((a, b) => a.number - b.number));
    setIsCreateDialogOpen(false);
    setNewTableNumber('');
    setNewTableSeats('4');

    toast({
      title: 'Mesa creada',
      description: `Mesa ${tableNumber} creada exitosamente`,
    });
  };

  // Activar/Desactivar mesa
  const toggleTableActive = (tableId: string) => {
    setTables(prev => prev.map(table => {
      if (table.id === tableId) {
        // No permitir desactivar si está ocupada
        if (table.isOccupied && table.isActive) {
          toast({
            title: 'Error',
            description: 'No se puede desactivar una mesa ocupada',
            variant: 'destructive'
          });
          return table;
        }

        const newState = !table.isActive;
        toast({
          title: newState ? 'Mesa activada' : 'Mesa desactivada',
          description: `Mesa ${table.number} ${newState ? 'activada' : 'desactivada'}`,
        });

        return { ...table, isActive: newState };
      }
      return table;
    }));
  };

  // Eliminar mesa
  const handleDeleteTable = (tableId: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    if (table.isOccupied) {
      toast({
        title: 'Error',
        description: 'No se puede eliminar una mesa ocupada',
        variant: 'destructive'
      });
      return;
    }

    setTables(prev => prev.filter(t => t.id !== tableId));
    toast({
      title: 'Mesa eliminada',
      description: `Mesa ${table.number} eliminada`,
    });
  };

  // Seleccionar mesa para tomar pedido
  const handleTableClick = (table: Table) => {
    if (!table.isActive) {
      toast({
        title: 'Mesa inactiva',
        description: 'Activa la mesa antes de tomar un pedido',
        variant: 'destructive'
      });
      return;
    }

    setSelectedTable(table);

    if (table.isOccupied) {
      // Mesa ocupada - abrir diálogo de pago
      setIsPaymentDialogOpen(true);
    } else {
      // Mesa disponible - abrir diálogo para tomar pedido
      setIsOrderDialogOpen(true);
    }
  };

  // Confirmar pedido y ocupar mesa
  const handleConfirmOrder = (customerName: string, items: any[], total: number) => {
    if (!selectedTable) return;

    const normalizedName = customerName.trim();
    const displayName = normalizedName.length > 0 ? normalizedName : undefined;

    setTables(prev => prev.map(t => {
      if (t.id === selectedTable.id) {
        // Si la mesa ya estaba ocupada, combinar items
        if (t.isOccupied && t.orderItems) {
          const combinedItems = [...t.orderItems];

          // Agregar o actualizar cantidades de los nuevos items
          items.forEach(newItem => {
            const existingIndex = combinedItems.findIndex(
              existing => existing.product.id === newItem.product.id
            );

            if (existingIndex >= 0) {
              combinedItems[existingIndex] = {
                ...combinedItems[existingIndex],
                quantity: combinedItems[existingIndex].quantity + newItem.quantity
              };
            } else {
              combinedItems.push(newItem);
            }
          });

          return {
            ...t,
            orderItems: combinedItems
          };
        }

        // Si es un pedido nuevo, ocupar la mesa
        return {
          ...t,
          isOccupied: true,
          customerName: displayName,
          currentOrderId: `ORD-${Date.now()}`,
          occupiedSince: Date.now(),
          orderItems: items
        };
      }
      return t;
    }));

    const currencyFormatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    });

    const isAddingMore = selectedTable.isOccupied;
    toast({
      title: isAddingMore ? 'Productos agregados' : 'Pedido creado',
      description: `Mesa ${selectedTable.number}${displayName ? ` - ${displayName}` : ''} - ${isAddingMore ? 'Agregados' : 'Total'}: ${currencyFormatter.format(total)}`,
    });

    setSelectedTable(null);
    setIsOrderDialogOpen(false);
  };

  // Agregar más productos a un pedido existente
  const handleAddMoreProducts = () => {
    setIsPaymentDialogOpen(false);
    setIsOrderDialogOpen(true);
  };

  // Procesar pago y liberar mesa
  const handleProcessPayment = (paymentMethod: string) => {
    if (!selectedTable) return;

    const table = tables.find(t => t.id === selectedTable.id);
    if (!table) return;

    const total = (table.orderItems || []).reduce((sum, item) =>
      sum + (item.product.price * item.quantity), 0
    );

    const currencyFormatter = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    });

    // Liberar la mesa
    setTables(prev => prev.map(t =>
      t.id === selectedTable.id
        ? {
            ...t,
            isOccupied: false,
            customerName: undefined,
            currentOrderId: undefined,
            occupiedSince: undefined,
            orderItems: undefined
          }
        : t
    ));

    toast({
      title: 'Pago procesado',
      description: `Mesa ${selectedTable.number} - ${currencyFormatter.format(total)} - Método: ${paymentMethod}`,
    });

    setSelectedTable(null);
    setIsPaymentDialogOpen(false);
  };

  const getElapsedMinutes = (table: Table) => {
    if (!table.occupiedSince) return 0;
    return Math.floor((Date.now() - table.occupiedSince) / 60000);
  };

  const isPastThreshold = (table: Table) =>
    table.isOccupied && getElapsedMinutes(table) > WAIT_THRESHOLD_MINUTES;

  // Obtener clase de color según estado de mesa
  const getTableColor = (table: Table) => {
    if (!table.isActive) {
      return 'bg-gray-200 border-gray-400 text-gray-600 cursor-not-allowed';
    }
    if (table.isOccupied) {
      return isPastThreshold(table)
        ? 'bg-red-100 border-red-500 text-red-800 hover:bg-red-200 cursor-pointer'
        : 'bg-yellow-100 border-yellow-500 text-yellow-800 hover:bg-yellow-200 cursor-pointer';
    }
    return 'bg-green-100 border-green-500 text-green-800 hover:bg-green-200 cursor-pointer';
  };

  // Obtener icono según estado
  const getTableIcon = (table: Table) => {
    if (!table.isActive) {
      return <X className="h-8 w-8" />;
    }
    if (table.isOccupied) {
      return isPastThreshold(table) ? (
        <AlertCircle className="h-8 w-8 text-red-600" />
      ) : (
        <Clock className="h-8 w-8 text-yellow-600" />
      );
    }
    return <Check className="h-8 w-8" />;
  };

  const activeTables = tables.filter(t => t.isActive);
  const occupiedTables = activeTables.filter(t => t.isOccupied);
  const availableTables = activeTables.filter(t => !t.isOccupied);

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Mesas</p>
                <p className="text-3xl font-bold">{tables.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Activas</p>
                <p className="text-3xl font-bold text-green-600">{activeTables.length}</p>
              </div>
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ocupadas</p>
                <p className="text-3xl font-bold text-red-600">{occupiedTables.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Disponibles</p>
                <p className="text-3xl font-bold text-blue-600">{availableTables.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botón para crear nueva mesa */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Mesas del Restaurante</h3>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Mesa
        </Button>
      </div>

      {/* Grid de Mesas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {tables.map((table) => (
          <Card
            key={table.id}
            className={cn(
              'relative overflow-hidden transition-all duration-200 border-2',
              getTableColor(table)
            )}
            onClick={() => handleTableClick(table)}
          >
            <CardContent className="p-4">
              <div className="flex flex-col items-center gap-3">
                {/* Icono de estado */}
                <div className="relative">
                  {getTableIcon(table)}
                  {table.isActive && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {table.seats}
                    </Badge>
                  )}
                </div>

                {/* Número de mesa */}
                <div className="text-center">
                  <p className="text-2xl font-bold">Mesa {table.number}</p>
                  {table.isOccupied && table.customerName && (
                    <p className="text-xs mt-1 truncate max-w-full">
                      {table.customerName}
                    </p>
                  )}
                  {table.isOccupied && (
                    <p
                      className={cn(
                        'text-xs mt-1',
                        isPastThreshold(table) ? 'text-red-600 font-semibold' : 'text-yellow-600'
                      )}
                    >
                      Tiempo: {getElapsedMinutes(table)} min
                    </p>
                  )}
                  {!table.isActive && (
                    <p className="text-xs mt-1">Inactiva</p>
                  )}
                  {table.isActive && !table.isOccupied && (
                    <p className="text-xs mt-1">{table.seats} puestos</p>
                  )}
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTableActive(table.id);
                    }}
                  >
                    {table.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                  {!table.isOccupied && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTable(table.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog para crear mesa */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nueva Mesa</DialogTitle>
            <DialogDescription>
              Ingresa el número de mesa y la cantidad de puestos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="table-number">Número de Mesa</Label>
              <Input
                id="table-number"
                type="number"
                min="1"
                placeholder="Ej: 9"
                value={newTableNumber}
                onChange={(e) => setNewTableNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="table-seats">Cantidad de Puestos</Label>
              <Input
                id="table-seats"
                type="number"
                min="1"
                max="20"
                placeholder="Ej: 4"
                value={newTableSeats}
                onChange={(e) => setNewTableSeats(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTable}>
              Crear Mesa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para tomar pedido */}
      <OrderDialog
        isOpen={isOrderDialogOpen}
        onClose={() => {
          setIsOrderDialogOpen(false);
          setSelectedTable(null);
        }}
        tableNumber={selectedTable?.number || 0}
        onConfirm={handleConfirmOrder}
      />

      {/* Dialog para pago */}
      {selectedTable && (
        <PaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => {
            setIsPaymentDialogOpen(false);
            setSelectedTable(null);
          }}
          tableNumber={selectedTable.number}
          customerName={selectedTable.customerName}
          orderItems={selectedTable.orderItems || []}
          onAddMoreProducts={handleAddMoreProducts}
          onProcessPayment={handleProcessPayment}
        />
      )}
    </div>
  );
};
