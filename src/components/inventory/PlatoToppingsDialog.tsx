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
import { Loader2, ArrowUpDown, Info, Check } from 'lucide-react';
import { substitutionService, type PlatoTopping, type AvailableSubstitution, type SubstitutionDetails } from '@/services/substitutionService';
import { toast } from '@/hooks/use-toast';

interface PlatoToppingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  platoItem: {
    id: string;
    producto_id: number;
    tipo: 'plato';
    nombre: string;
    cantidad: number;
    precio_unitario: number;
    precio_total: number;
    orden_item_id?: number; // ID específico del item en ordenes_platos
  } | null;
  onToppingsChanged: (updatedItem: any, substitutionDetails?: SubstitutionDetails[]) => void;
}

interface ToppingWithSubstitutions extends PlatoTopping {
  availableSubstitutions: AvailableSubstitution[];
  loading: boolean;
  selectedSubstitution?: AvailableSubstitution;
}

export const PlatoToppingsDialog: React.FC<PlatoToppingsDialogProps> = ({
  isOpen,
  onClose,
  platoItem,
  onToppingsChanged
}) => {
  const [loading, setLoading] = useState(false);
  const [toppings, setToppings] = useState<ToppingWithSubstitutions[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar toppings del plato cuando se abre el diálogo
  useEffect(() => {
    const loadPlatoToppings = async () => {
      if (!isOpen || !platoItem) return;

      console.log('🔍 DEBUG PlatoToppingsDialog: Received platoItem:', platoItem);

      setLoading(true);
      try {
        console.log('🔄 Cargando toppings para plato:', platoItem.nombre);

        const platoToppings = await substitutionService.getPlatoToppings(platoItem.producto_id);

        // Inicializar cada topping con sus sustituciones
        const toppingsWithSubstitutions: ToppingWithSubstitutions[] = platoToppings.map(topping => ({
          ...topping,
          availableSubstitutions: [],
          loading: false
        }));

        setToppings(toppingsWithSubstitutions);

        // Cargar sustituciones para cada topping
        for (let i = 0; i < toppingsWithSubstitutions.length; i++) {
          const topping = toppingsWithSubstitutions[i];

          // Marcar como cargando
          setToppings(prev => prev.map((t, idx) =>
            idx === i ? { ...t, loading: true } : t
          ));

          try {
            const substitutions = await substitutionService.getAvailableSubstitutions(
              topping.topping_id,
              'topping'
            );

            setToppings(prev => prev.map((t, idx) =>
              idx === i ? { ...t, availableSubstitutions: substitutions, loading: false } : t
            ));
          } catch (error) {
            console.error(`Error cargando sustituciones para topping ${topping.topping_name}:`, error);
            setToppings(prev => prev.map((t, idx) =>
              idx === i ? { ...t, loading: false } : t
            ));
          }
        }

      } catch (error) {
        console.error('Error cargando toppings del plato:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los toppings del plato",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadPlatoToppings();
  }, [isOpen, platoItem]);

  // Función para seleccionar una sustitución
  const handleSelectSubstitution = (toppingIndex: number, substitution: AvailableSubstitution | null) => {
    setToppings(prev => prev.map((topping, idx) =>
      idx === toppingIndex
        ? { ...topping, selectedSubstitution: substitution || undefined }
        : topping
    ));
    setHasChanges(true);
  };

  // Función para aplicar los cambios
  const handleApplyChanges = () => {
    if (!platoItem || !hasChanges) return;

    const changedToppings = toppings.filter(t => t.selectedSubstitution);

    if (changedToppings.length === 0) {
      onClose();
      return;
    }

    // Recopilar detalles de sustitución - las sustituciones son GRATUITAS
    const substitutionMessages: string[] = [];
    const substitutionDetails: SubstitutionDetails[] = [];

    changedToppings.forEach(topping => {
      if (topping.selectedSubstitution) {
        // Las sustituciones de toppings son gratuitas - no hay cambio de precio
        const priceChange = 0;

        const message = `${topping.topping_name} → ${topping.selectedSubstitution.substitute_name} (sin costo adicional)`;
        substitutionMessages.push(message);

        // Agregar detalle de sustitución
        const substitutionDetail = {
          type: 'topping_substitution' as const,
          original_name: topping.topping_name,
          substitute_name: topping.selectedSubstitution.substitute_name,
          price_difference: 0, // Siempre 0 - gratuito
          parent_item_name: platoItem.nombre,
          orden_item_id: platoItem.orden_item_id // Agregar ID específico del item
        };

        console.log('🔍 DEBUG PlatoToppingsDialog: Creating substitution detail:', substitutionDetail);
        substitutionDetails.push(substitutionDetail);
      }
    });

    // Crear el item actualizado - SIN cambio de precio (sustituciones gratuitas)
    const updatedItem = {
      ...platoItem,
      precio_unitario: platoItem.precio_unitario, // Mantener precio original
      precio_total: platoItem.precio_unitario * platoItem.cantidad // Mantener precio total original
    };

    // Enviar el item actualizado junto con los detalles de sustitución
    onToppingsChanged(updatedItem, substitutionDetails);

    toast({
      title: "Toppings sustituidos",
      description: substitutionMessages.join(', '),
    });

    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatPriceDifference = (priceDifference: number) => {
    // Todas las sustituciones de toppings son gratuitas
    return 'Sin costo adicional';
  };

  if (!platoItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Toppings de {platoItem.nombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Cargando toppings...</span>
            </div>
          )}

          {!loading && toppings.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Este plato no tiene toppings configurados o no se pueden sustituir.
              </AlertDescription>
            </Alert>
          )}

          {!loading && toppings.length > 0 && (
            <div className="space-y-4">
              {toppings.map((topping, index) => (
                <Card key={topping.id} className="border">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Topping actual */}
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{topping.topping_name}</h4>
                        </div>
                        {topping.selectedSubstitution && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Cambiado
                          </Badge>
                        )}
                      </div>

                      {/* Opciones de sustitución */}
                      {topping.loading && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Cargando opciones...
                        </div>
                      )}

                      {!topping.loading && topping.availableSubstitutions.length === 0 && (
                        <p className="text-sm text-gray-500">
                          No hay sustituciones disponibles para este topping
                        </p>
                      )}

                      {!topping.loading && topping.availableSubstitutions.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium text-gray-700">
                            Opciones de cambio:
                          </h5>

                          {/* Opción para mantener el original */}
                          <div
                            className={`p-2 border rounded cursor-pointer transition-colors ${
                              !topping.selectedSubstitution
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={() => handleSelectSubstitution(index, null)}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                Mantener {topping.topping_name}
                              </span>
                            </div>
                          </div>

                          {/* Opciones de sustitución */}
                          {topping.availableSubstitutions.map((substitution) => (
                            <div
                              key={`${substitution.substitute_id}_${substitution.substitute_type}`}
                              className={`p-2 border rounded cursor-pointer transition-colors ${
                                topping.selectedSubstitution?.substitute_id === substitution.substitute_id &&
                                topping.selectedSubstitution?.substitute_type === substitution.substitute_type
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                              onClick={() => handleSelectSubstitution(index, substitution)}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="text-sm font-medium">
                                    {substitution.substitute_name}
                                  </span>
                                  {substitution.is_bidirectional && (
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      ↔
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-green-600">
                                    {formatPriceDifference(substitution.price_difference)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Resumen de cambios */}
              {hasChanges && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-blue-800 mb-2">Resumen de cambios</h4>
                    <div className="space-y-1 text-sm">
                      {toppings
                        .filter(t => t.selectedSubstitution)
                        .map((topping, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {topping.topping_name} → {topping.selectedSubstitution!.substitute_name}
                            </span>
                            <span className="text-green-600">
                              Sin costo adicional
                            </span>
                          </div>
                        ))}

                      <div className="border-t pt-2 mt-2 font-medium">
                        <div className="flex justify-between">
                          <span>Cambios aplicados:</span>
                          <span className="text-green-600">
                            Sin costo adicional
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleApplyChanges}
            disabled={!hasChanges}
          >
            Aplicar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};