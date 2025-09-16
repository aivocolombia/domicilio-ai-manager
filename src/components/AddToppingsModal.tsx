import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { menuService } from '@/services/menuService';
import { PlatoConSede, Topping } from '@/types/menu';
import { formatCurrency } from '@/utils/format';

interface AddToppingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  effectiveSedeId: string;
  onSuccess: () => void;
}

export const AddToppingsModal: React.FC<AddToppingsModalProps> = ({
  open,
  onOpenChange,
  effectiveSedeId,
  onSuccess
}) => {
  const [platosDisponibles, setPlatosDisponibles] = useState<PlatoConSede[]>([]);
  const [toppingsDisponibles, setToppingsDisponibles] = useState<Topping[]>([]);
  const [selectedPlato, setSelectedPlato] = useState<string>('');
  const [selectedToppings, setSelectedToppings] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar platos y toppings disponibles
  useEffect(() => {
    const loadData = async () => {
      if (!open || !effectiveSedeId) return;

      try {
        setLoadingData(true);
        
        // Cargar platos de la sede
        const menuData = await menuService.getMenuConSede(effectiveSedeId);
        setPlatosDisponibles(menuData.platos);
        
        // Cargar todos los toppings disponibles
        const toppingsData = await menuService.getToppings();
        setToppingsDisponibles(toppingsData);
        
      } catch (error) {
        console.error('Error cargando datos:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los datos necesarios.",
          variant: "destructive"
        });
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [open, effectiveSedeId]);

  // Filtrar toppings por búsqueda
  const filteredToppings = toppingsDisponibles.filter(topping =>
    topping.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Obtener toppings ya asociados al plato seleccionado
  const platoSeleccionado = platosDisponibles.find(p => p.id.toString() === selectedPlato);
  const toppingsExistentes = platoSeleccionado?.toppings?.map(t => t.id) || [];

  // Filtrar toppings que no están ya asociados al plato
  const toppingsParaAgregar = filteredToppings.filter(t => !toppingsExistentes.includes(t.id));

  const handleToggleTopping = (toppingId: number) => {
    setSelectedToppings(prev => 
      prev.includes(toppingId) 
        ? prev.filter(id => id !== toppingId)
        : [...prev, toppingId]
    );
  };

  const handleSubmit = async () => {
    if (!selectedPlato || selectedToppings.length === 0) {
      toast({
        title: "Error",
        description: "Selecciona un plato y al menos un topping.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Agregar cada topping seleccionado al plato
      for (const toppingId of selectedToppings) {
        await menuService.addToppingToPlato(parseInt(selectedPlato), toppingId);
      }

      toast({
        title: "Toppings agregados",
        description: `Se agregaron ${selectedToppings.length} toppings al plato exitosamente.`,
      });

      // Limpiar formulario
      setSelectedPlato('');
      setSelectedToppings([]);
      setSearchTerm('');
      
      // Cerrar modal y notificar éxito
      onOpenChange(false);
      onSuccess();
      
    } catch (error) {
      console.error('Error agregando toppings:', error);
      toast({
        title: "Error",
        description: "No se pudieron agregar los toppings.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedPlato('');
    setSelectedToppings([]);
    setSearchTerm('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Toppings a Producto</DialogTitle>
          <DialogDescription>
            Selecciona un plato existente y los toppings que deseas agregar
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Cargando datos...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selección de plato */}
            <div className="space-y-2">
              <Label htmlFor="plato">Seleccionar Plato</Label>
              <Select value={selectedPlato} onValueChange={setSelectedPlato}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un plato..." />
                </SelectTrigger>
                <SelectContent>
                  {platosDisponibles.map((plato) => (
                    <SelectItem key={plato.id} value={plato.id.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span>{plato.name}</span>
                        <Badge variant="secondary" className="ml-2">
                          {plato.toppings?.length || 0} toppings
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mostrar toppings existentes del plato seleccionado */}
            {platoSeleccionado && platoSeleccionado.toppings && platoSeleccionado.toppings.length > 0 && (
              <div className="space-y-2">
                <Label>Toppings actuales del plato</Label>
                <div className="flex flex-wrap gap-2">
                  {platoSeleccionado.toppings.map((topping) => (
                    <Badge key={topping.id} variant="default">
                      {topping.name}
                      {topping.sede_price > 0 && ` (+${formatCurrency(topping.sede_price)})`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Buscador de toppings */}
            {selectedPlato && (
              <div className="space-y-2">
                <Label htmlFor="search">Buscar Toppings para Agregar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Buscar toppings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            {/* Lista de toppings disponibles para agregar */}
            {selectedPlato && (
              <div className="space-y-2">
                <Label>Toppings Disponibles ({toppingsParaAgregar.length})</Label>
                
                {toppingsParaAgregar.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">
                        {searchTerm 
                          ? 'No se encontraron toppings con esa búsqueda'
                          : 'Todos los toppings ya están agregados a este plato'
                        }
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {toppingsParaAgregar.map((topping) => (
                      <Card key={topping.id} className="cursor-pointer hover:bg-accent/50">
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`topping-${topping.id}`}
                              checked={selectedToppings.includes(topping.id)}
                              onCheckedChange={() => handleToggleTopping(topping.id)}
                            />
                            <div className="flex-1">
                              <label 
                                htmlFor={`topping-${topping.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {topping.name}
                              </label>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(topping.pricing)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resumen de selección */}
            {selectedToppings.length > 0 && (
              <div className="space-y-2">
                <Label>Toppings Seleccionados ({selectedToppings.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedToppings.map((toppingId) => {
                    const topping = toppingsDisponibles.find(t => t.id === toppingId);
                    return topping ? (
                      <Badge key={toppingId} variant="default">
                        {topping.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !selectedPlato || selectedToppings.length === 0 || loadingData}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Agregar Toppings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};