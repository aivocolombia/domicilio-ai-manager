import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowRight, ArrowUpDown, Info, Settings } from 'lucide-react';
import { useSubstitutions } from '@/hooks/useSubstitutions';
import type { AvailableSubstitution, SubstitutionDetails } from '@/services/substitutionService';
import { PlatoToppingsDialog } from '@/components/PlatoToppingsDialog';

interface ProductSubstitutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    producto_id: number;
    tipo: 'plato' | 'bebida' | 'topping';
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    precio_total: number;
    orden_item_id?: number; // ID único del item en ordenes_platos/bebidas/toppings
  } | null;
  onSubstitutionApplied: (originalItem: any, substitutedItem: any) => void;
}

export const ProductSubstitutionDialog: React.FC<ProductSubstitutionDialogProps> = ({
  isOpen,
  onClose,
  item,
  onSubstitutionApplied
}) => {
  const {
    loading,
    availableSubstitutions,
    getSubstitutions,
    prepareSubstitution,
    formatPriceDifference,
    calculatePriceChange,
    clearSubstitutions
  } = useSubstitutions();

  const [selectedSubstitution, setSelectedSubstitution] = useState<AvailableSubstitution | null>(null);
  const [applying, setApplying] = useState(false);

  // Estado para el diálogo de toppings del producto ACTUAL
  const [toppingsDialogOpen, setToppingsDialogOpen] = useState(false);

  // Cargar sustituciones cuando se abre el diálogo
  useEffect(() => {
    if (isOpen && item) {
      getSubstitutions(item.producto_id, item.tipo);
    } else {
      clearSubstitutions();
      setSelectedSubstitution(null);
      setToppingsDialogOpen(false);
    }
  }, [isOpen, item, getSubstitutions, clearSubstitutions]);

  const handleApplySubstitution = async () => {
    if (!item || !selectedSubstitution) return;

    setApplying(true);
    try {
      const result = await prepareSubstitution(
        item,
        selectedSubstitution.substitute_id,
        selectedSubstitution.substitute_type
      );

      if (result.success && result.substitute_item) {
        onSubstitutionApplied(item, result.substitute_item);
        onClose();
      }
    } catch (error) {
      console.error('Error aplicando sustitución:', error);
    } finally {
      setApplying(false);
    }
  };

  // Función para abrir diálogo de toppings del producto ACTUAL
  const handleOpenCurrentToppings = () => {
    if (!item || item.tipo !== 'plato') return;
    console.log('🔍 DEBUG ProductSubstitutionDialog: Opening toppings for item:', item);
    setToppingsDialogOpen(true);
  };

  // Función para aplicar cambios de toppings del producto actual
  const handleCurrentToppingsChanged = (updatedItem: any, substitutionDetails?: SubstitutionDetails[]) => {
    console.log('🔍 DEBUG ProductSubstitutionDialog: Received substitution details:', substitutionDetails);

    // Los substitution details ya vienen con orden_item_id desde PlatoToppingsDialog
    if (substitutionDetails && substitutionDetails.length > 0) {
      updatedItem._substitutionDetails = substitutionDetails;
    }

    // Notificar al componente padre que el item original ha cambiado
    onSubstitutionApplied(item, updatedItem);
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Cambiar Producto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Producto actual */}
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold">{item.nombre}</h3>
                  <p className="text-sm text-gray-600">
                    {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}
                  </p>
                  <p className="text-sm">
                    Cantidad: {item.cantidad} × {formatCurrency(item.precio_unitario)}
                  </p>
                  {/* Botón para cambiar toppings del producto actual */}
                  {item.tipo === 'plato' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenCurrentToppings}
                      className="mt-2"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Ver/Cambiar Toppings de {item.nombre}
                    </Button>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(item.precio_total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sustituciones disponibles */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Opciones de Cambio
            </h4>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Cargando opciones...</span>
              </div>
            )}

            {!loading && availableSubstitutions.length === 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No hay sustituciones disponibles para este producto según las reglas configuradas.
                </AlertDescription>
              </Alert>
            )}

            {!loading && availableSubstitutions.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableSubstitutions.map((substitution) => {
                  const totalPriceChange = calculatePriceChange(substitution.price_difference, item.cantidad);
                  const newUnitPrice = Math.max(0, item.precio_unitario + substitution.price_difference);
                  const newTotalPrice = newUnitPrice * item.cantidad;

                  return (
                    <Card
                      key={`${substitution.substitute_id}_${substitution.substitute_type}`}
                      className={`cursor-pointer transition-colors ${
                        selectedSubstitution?.substitute_id === substitution.substitute_id &&
                        selectedSubstitution?.substitute_type === substitution.substitute_type
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedSubstitution(substitution)}
                    >
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium">{substitution.substitute_name}</h5>
                              {substitution.is_bidirectional && (
                                <Badge variant="outline" className="text-xs">
                                  ↔
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 capitalize">
                              {substitution.substitute_type}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm">
                                {formatPriceDifference(substitution.price_difference)} por unidad
                              </span>
                              {totalPriceChange !== 0 && (
                                <Badge
                                  variant={totalPriceChange > 0 ? "destructive" : "secondary"}
                                  className="text-xs"
                                >
                                  {totalPriceChange > 0 ? '+' : ''}{formatCurrency(totalPriceChange)} total
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-semibold">{formatCurrency(newTotalPrice)}</p>
                            <p className="text-gray-500">{formatCurrency(newUnitPrice)} c/u</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumen del cambio seleccionado */}
          {selectedSubstitution && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Cambio Seleccionado</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-medium">{item.nombre}</span>
                    {' → '}
                    <span className="font-medium">{selectedSubstitution.substitute_name}</span>
                  </p>
                  <p>
                    Precio: {formatCurrency(item.precio_unitario)}
                    {' → '}
                    {formatCurrency(Math.max(0, item.precio_unitario + selectedSubstitution.price_difference))}
                    <span className="ml-2 text-gray-600">
                      ({formatPriceDifference(selectedSubstitution.price_difference)} por unidad)
                    </span>
                  </p>
                  {selectedSubstitution.price_difference !== 0 && (
                    <p>
                      <span className="font-medium">
                        Cambio total: {formatPriceDifference(calculatePriceChange(selectedSubstitution.price_difference, item.cantidad))}
                      </span>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleApplySubstitution}
            disabled={!selectedSubstitution || applying}
          >
            {applying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              'Aplicar Cambio'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Diálogo de toppings del producto actual */}
      <PlatoToppingsDialog
        isOpen={toppingsDialogOpen}
        onClose={() => setToppingsDialogOpen(false)}
        platoItem={item}
        onToppingsChanged={handleCurrentToppingsChanged}
      />
    </Dialog>
  );
};