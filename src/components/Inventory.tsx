
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Package, Plus, Loader2, AlertCircle } from 'lucide-react';
import { useMenu } from '@/hooks/useMenu';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/format';

export const Inventory: React.FC = () => {
  const {
    platos,
    bebidas,
    toppings,
    loading,
    error,
    loadInventory,
    updatePlato,
    updateBebida,
    updateTopping,
    clearError
  } = useMenu();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(true); // Mostrar inactivos por defecto

  // Combinar solo platos y bebidas para mostrar en el inventario (incluyendo inactivos)
  const allProducts = [
    ...platos.map(plato => ({
      ...plato,
      type: 'plato' as const,
      category: 'Platos Principales',
      description: plato.description || 'Sin descripción'
    })),
    ...bebidas.map(bebida => ({
      ...bebida,
      type: 'bebida' as const,
      category: 'Bebidas',
      description: 'Bebida refrescante'
    }))
  ];

  const categories = ['all', ...new Set(allProducts.map(item => item.category))];
  
  const filteredItems = allProducts.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesAvailability = showInactive || item.available; // Mostrar todos si showInactive es true, o solo activos si es false
    return matchesSearch && matchesCategory && matchesAvailability;
  });

  const toggleProductAvailability = async (productId: number, type: 'plato' | 'bebida') => {
    try {
      const product = allProducts.find(item => item.id === productId);
      if (!product) return;

      const isCurrentlyAvailable = product.available;
      
      switch (type) {
        case 'plato':
          await updatePlato(productId, { available: !isCurrentlyAvailable });
          break;
        case 'bebida':
          await updateBebida(productId, { available: !isCurrentlyAvailable });
          break;
      }

      // Recargar el inventario para actualizar el frontend
      await loadInventory();

      toast({
        title: "Producto actualizado",
        description: `${product.name} ${isCurrentlyAvailable ? 'desactivado' : 'activado'} correctamente.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto.",
        variant: "destructive"
      });
    }
  };

  const toggleToppingAvailability = async (toppingId: number) => {
    try {
      const topping = toppings.find(t => t.id === toppingId);
      if (!topping) return;

      const isCurrentlyAvailable = topping.available;
      
      await updateTopping(toppingId, { available: !isCurrentlyAvailable });

      // Recargar el inventario para actualizar el frontend
      await loadInventory();

      toast({
        title: "Topping actualizado",
        description: `${topping.name} ${isCurrentlyAvailable ? 'desactivado' : 'activado'} correctamente.`,
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el topping.",
        variant: "destructive"
      });
    }
  };

  const availableCount = allProducts.filter(item => item.available).length;
  const unavailableCount = allProducts.filter(item => !item.available).length;
  const totalCount = allProducts.length;
  
  // Contar toppings disponibles e inactivos para información adicional
  const availableToppings = toppings.filter(topping => topping.available).length;
  const unavailableToppings = toppings.filter(topping => !topping.available).length;

  // Cargar inventario cuando el componente se monta
  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Error: {error}</span>
        </div>
        <Button onClick={clearError}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventario</h1>
          <p className="text-muted-foreground">
            {availableCount} productos disponibles • {unavailableCount} no disponibles • {availableToppings} toppings disponibles
          </p>
        </div>
        <Button className="flex items-center gap-2" disabled={loading} onClick={() => {
          toast({
            title: "Funcionalidad en desarrollo",
            description: "La funcionalidad de agregar productos estará disponible pronto.",
          });
        }}>
          <Plus className="h-4 w-4" />
          Agregar Producto
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-2xl font-bold text-green-600">{availableCount}</p>
              <p className="text-sm text-muted-foreground">Disponibles</p>
            </div>
            <Package className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-2xl font-bold text-red-600">{unavailableCount}</p>
              <p className="text-sm text-muted-foreground">No Disponibles</p>
            </div>
            <Package className="h-8 w-8 text-red-600" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-2xl font-bold text-blue-600">{totalCount}</p>
              <p className="text-sm text-muted-foreground">Total Productos</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === 'all' ? 'Todos' : category}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
                id="show-inactive"
              />
              <label htmlFor="show-inactive" className="text-sm font-medium">
                Mostrar inactivos
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando inventario...</span>
        </div>
      )}

      {/* Products Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <Card 
              key={`${item.type}-${item.id}`} 
              className={`${!item.available ? 'opacity-75 border-dashed' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  </div>
                  <Switch
                    checked={item.available}
                    onCheckedChange={() => toggleProductAvailability(item.id, item.type)}
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant={item.available ? "default" : "destructive"}>
                    {item.available ? 'Disponible' : 'No Disponible'}
                  </Badge>
                  <span className="font-bold text-lg">{formatCurrency(item.pricing)}</span>
                </div>
              </CardHeader>
              
              {/* Mostrar toppings solo para platos */}
              {item.type === 'plato' && item.toppings && item.toppings.length > 0 && (
                <CardContent>
                  <h4 className="font-medium mb-3">Toppings Incluidos</h4>
                  <div className="space-y-2">
                    {item.toppings.map((topping) => (
                      <div key={topping.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{topping.name}</span>
                          {!topping.available && (
                            <Badge variant="secondary" className="text-xs">No disponible</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {topping.pricing > 0 && (
                            <span className="text-sm font-medium">+{formatCurrency(topping.pricing)}</span>
                          )}
                          <Switch
                            checked={topping.available}
                            onCheckedChange={() => toggleToppingAvailability(topping.id)}
                            disabled={loading}
                            size="sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <div className="text-center py-8">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No se encontraron productos</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Intenta con otros términos de búsqueda.' : 'No hay productos en el inventario.'}
          </p>
        </div>
      )}
    </div>
  );
};
