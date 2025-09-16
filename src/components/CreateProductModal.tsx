import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { menuService } from '@/services/menuService';
import { Topping } from '@/types/menu';
import { formatCurrency } from '@/utils/format';

interface CreateProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  effectiveSedeId: string;
  onSuccess: () => void;
}

export const CreateProductModal: React.FC<CreateProductModalProps> = ({
  open,
  onOpenChange,
  effectiveSedeId,
  onSuccess
}) => {
  // Estado del formulario
  const [productType, setProductType] = useState<'plato' | 'bebida' | 'topping'>('plato');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  
  // Estado para toppings (solo para platos)
  const [toppingsDisponibles, setToppingsDisponibles] = useState<Topping[]>([]);
  const [selectedToppings, setSelectedToppings] = useState<number[]>([]);
  const [toppingSearchTerm, setToppingSearchTerm] = useState('');
  
  // Estado para crear topping independiente
  const [platosDisponibles, setPlatosDisponibles] = useState<any[]>([]);
  const [selectedPlatos, setSelectedPlatos] = useState<number[]>([]);
  const [platoSearchTerm, setPlatoSearchTerm] = useState('');
  
  // Estado de carga
  const [loading, setLoading] = useState(false);
  const [loadingToppings, setLoadingToppings] = useState(false);
  const [loadingPlatos, setLoadingPlatos] = useState(false);

  // Cargar toppings disponibles
  useEffect(() => {
    const loadToppings = async () => {
      if (!open || productType !== 'plato') return;

      try {
        setLoadingToppings(true);
        const toppingsData = await menuService.getToppings();
        setToppingsDisponibles(toppingsData);
      } catch (error) {
        console.error('Error cargando toppings:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los toppings disponibles.",
          variant: "destructive"
        });
      } finally {
        setLoadingToppings(false);
      }
    };

    loadToppings();
  }, [open, productType]);

  // Cargar platos disponibles para enlazar toppings
  useEffect(() => {
    const loadPlatos = async () => {
      if (!open || productType !== 'topping') return;

      try {
        setLoadingPlatos(true);
        const menuData = await menuService.getMenuConSede(effectiveSedeId);
        setPlatosDisponibles(menuData.platos);
      } catch (error) {
        console.error('Error cargando platos:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los platos disponibles.",
          variant: "destructive"
        });
      } finally {
        setLoadingPlatos(false);
      }
    };

    loadPlatos();
  }, [open, productType, effectiveSedeId]);

  // Filtrar toppings por búsqueda
  const filteredToppings = toppingsDisponibles.filter(topping =>
    topping.name.toLowerCase().includes(toppingSearchTerm.toLowerCase())
  );

  // Filtrar platos por búsqueda
  const filteredPlatos = platosDisponibles.filter(plato =>
    plato.name.toLowerCase().includes(platoSearchTerm.toLowerCase())
  );

  const handleToggleTopping = (toppingId: number) => {
    setSelectedToppings(prev => 
      prev.includes(toppingId) 
        ? prev.filter(id => id !== toppingId)
        : [...prev, toppingId]
    );
  };

  const handleTogglePlato = (platoId: number) => {
    setSelectedPlatos(prev => 
      prev.includes(platoId) 
        ? prev.filter(id => id !== platoId)
        : [...prev, platoId]
    );
  };

  const validateForm = () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del producto es requerido.",
        variant: "destructive"
      });
      return false;
    }

    if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0) {
      toast({
        title: "Error",
        description: "El precio debe ser un número válido mayor a 0.",
        variant: "destructive"
      });
      return false;
    }

    // Categoría es opcional para platos

    // Para toppings, no requerir productos (pueden ser independientes)
    // La validación de precio y nombre ya se hace arriba

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      let productId: number;

      if (productType === 'plato') {
        // Crear plato
        const platoData = {
          name: name.trim(),
          description: description.trim() || undefined,
          pricing: Number(price),
          toppingIds: selectedToppings.length > 0 ? selectedToppings : undefined
        };

        const newPlato = await menuService.createPlato(platoData);
        productId = newPlato.id;

        // Agregar toppings seleccionados al plato
        if (selectedToppings.length > 0) {
          for (const toppingId of selectedToppings) {
            await menuService.addToppingToPlato(productId, toppingId);
          }
        }

        // Crear registro en sede_platos (habilitado por defecto)
        await menuService.createSedePlatoRecord(effectiveSedeId, productId, Number(price), true);

      } else if (productType === 'bebida') {
        // Crear bebida
        const bebidaData = {
          name: name.trim(),
          pricing: Number(price),
        };

        const newBebida = await menuService.createBebida(bebidaData);
        productId = newBebida.id;

        // Crear registro en sede_bebidas (habilitado por defecto)
        await menuService.createSedeBebidaRecord(effectiveSedeId, productId, Number(price), true);
        
      } else {
        // Crear topping
        const toppingData = {
          name: name.trim(),
          pricing: Number(price),
        };

        const newTopping = await menuService.createTopping(toppingData);
        productId = newTopping.id;

        // Enlazar a platos seleccionados (opcional)
        if (selectedPlatos.length > 0) {
          for (const platoId of selectedPlatos) {
            await menuService.addToppingToPlato(platoId, productId);
          }
        }

        // Crear registro en sede_toppings (habilitado por defecto)
        await menuService.createSedeToppingRecord(effectiveSedeId, productId, Number(price), true);
      }

      toast({
        title: "Producto creado",
        description: `${productType === 'plato' ? 'Plato' : productType === 'bebida' ? 'Bebida' : 'Topping'} "${name}" creado exitosamente.`,
      });

      // Limpiar formulario
      resetForm();
      
      // Cerrar modal y notificar éxito
      onOpenChange(false);
      onSuccess();
      
    } catch (error) {
      console.error('Error creando producto:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo crear el producto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
    setSelectedToppings([]);
    setToppingSearchTerm('');
    setSelectedPlatos([]);
    setPlatoSearchTerm('');
    setProductType('plato');
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  // Categorías predefinidas para platos
  const categorias = [
    'Platos Principales',
    'Entradas',
    'Postres',
    'Sopas',
    'Ensaladas',
    'Comida Rápida',
    'Especialidades'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Producto Nuevo</DialogTitle>
          <DialogDescription>
            Crea un nuevo producto desde cero y configúralo para esta sede
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selector de tipo de producto */}
          <Tabs value={productType} onValueChange={(value) => setProductType(value as 'plato' | 'bebida' | 'topping')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="plato">Plato</TabsTrigger>
              <TabsTrigger value="bebida">Bebida</TabsTrigger>
              <TabsTrigger value="topping">Topping</TabsTrigger>
            </TabsList>

            <TabsContent value="plato" className="space-y-4 mt-4">
              {/* Información básica del plato */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del Plato *</Label>
                  <Input
                    id="name"
                    placeholder="Ej. Bandeja Paisa"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price">Precio *</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Describe el plato (opcional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <Separator />

              {/* Selección de toppings para platos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Toppings Opcionales</Label>
                  <Badge variant="secondary">
                    {selectedToppings.length} seleccionados
                  </Badge>
                </div>

                {/* Buscador de toppings */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar toppings..."
                    value={toppingSearchTerm}
                    onChange={(e) => setToppingSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {loadingToppings ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Cargando toppings...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                    {filteredToppings.map((topping) => (
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
                                {formatCurrency(topping.pricing || topping.price || 0)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Resumen de toppings seleccionados */}
                {selectedToppings.length > 0 && (
                  <div className="space-y-2">
                    <Label>Toppings Seleccionados</Label>
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
            </TabsContent>

            <TabsContent value="bebida" className="space-y-4 mt-4">
              {/* Información básica de la bebida */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bebida-name">Nombre de la Bebida *</Label>
                  <Input
                    id="bebida-name"
                    placeholder="Ej. Limonada Natural"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bebida-price">Precio *</Label>
                  <Input
                    id="bebida-price"
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bebida-description">Descripción</Label>
                <Textarea
                  id="bebida-description"
                  placeholder="Describe la bebida (opcional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="topping" className="space-y-4 mt-4">
              {/* Información básica del topping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="topping-name">Nombre del Topping *</Label>
                  <Input
                    id="topping-name"
                    placeholder="Ej. Queso Extra"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="topping-price">Precio *</Label>
                  <Input
                    id="topping-price"
                    type="number"
                    placeholder="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topping-description">Descripción</Label>
                <Textarea
                  id="topping-description"
                  placeholder="Describe el topping (opcional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <Separator />

              {/* Enlazar a platos (opcional) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enlazar a Platos (Opcional)</Label>
                  <Badge variant="secondary">
                    {selectedPlatos.length} seleccionados
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Puedes enlazar este topping a platos específicos o dejarlo independiente para uso libre.
                </p>

                {/* Buscador de platos */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar platos para enlazar..."
                    value={platoSearchTerm}
                    onChange={(e) => setPlatoSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {loadingPlatos ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">Cargando platos...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                    {filteredPlatos.map((plato) => (
                      <Card key={plato.id} className="cursor-pointer hover:bg-accent/50">
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`plato-${plato.id}`}
                              checked={selectedPlatos.includes(plato.id)}
                              onCheckedChange={() => handleTogglePlato(plato.id)}
                            />
                            <div className="flex-1">
                              <label 
                                htmlFor={`plato-${plato.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {plato.name}
                              </label>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(plato.sede_price || plato.pricing || 0)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Resumen de platos seleccionados */}
                {selectedPlatos.length > 0 && (
                  <div className="space-y-2">
                    <Label>Platos Seleccionados</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlatos.map((platoId) => {
                        const plato = platosDisponibles.find(p => p.id === platoId);
                        return plato ? (
                          <Badge key={platoId} variant="default">
                            {plato.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Resumen del producto */}
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Resumen del Producto</h4>
              <div className="space-y-1 text-sm">
                <div><span className="font-medium">Tipo:</span> {productType === 'plato' ? 'Plato' : productType === 'bebida' ? 'Bebida' : 'Topping'}</div>
                <div><span className="font-medium">Nombre:</span> {name || 'Sin nombre'}</div>
                {category && <div><span className="font-medium">Categoría:</span> {category}</div>}
                <div><span className="font-medium">Precio:</span> {price ? formatCurrency(Number(price)) : 'No definido'}</div>
                {productType === 'plato' && selectedToppings.length > 0 && (
                  <div><span className="font-medium">Toppings:</span> {selectedToppings.length} seleccionados</div>
                )}
                {productType === 'topping' && selectedPlatos.length > 0 && (
                  <div><span className="font-medium">Enlazado a:</span> {selectedPlatos.length} platos</div>
                )}
                {productType === 'topping' && selectedPlatos.length === 0 && (
                  <div><span className="font-medium">Estado:</span> Topping independiente</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

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
            disabled={loading || !name.trim() || !price.trim()}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Crear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};