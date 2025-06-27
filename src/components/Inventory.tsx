
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Package, Plus } from 'lucide-react';
import { InventoryItem, Topping } from '@/types/delivery';
import { toast } from '@/hooks/use-toast';

interface InventoryProps {
  inventory: InventoryItem[];
  onUpdateInventory: (inventory: InventoryItem[]) => void;
}

export const Inventory: React.FC<InventoryProps> = ({
  inventory,
  onUpdateInventory
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...new Set(inventory.map(item => item.category))];
  
  const filteredItems = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleProductAvailability = (productId: string) => {
    const updatedInventory = inventory.map(item => 
      item.id === productId 
        ? { ...item, isAvailable: !item.isAvailable }
        : item
    );
    onUpdateInventory(updatedInventory);
    
    const product = inventory.find(item => item.id === productId);
    toast({
      title: "Producto actualizado",
      description: `${product?.name} ${product?.isAvailable ? 'desactivado' : 'activado'} correctamente.`,
    });
  };

  const toggleToppingAvailability = (productId: string, toppingId: string) => {
    const updatedInventory = inventory.map(item => {
      if (item.id === productId) {
        const updatedToppings = item.availableToppings.map(topping =>
          topping.id === toppingId 
            ? { ...topping, price: topping.price === 0 ? 1000 : 0 } // Use price 0 to indicate unavailable
            : topping
        );
        return { ...item, availableToppings: updatedToppings };
      }
      return item;
    });
    onUpdateInventory(updatedInventory);
    
    toast({
      title: "Topping actualizado",
      description: "Disponibilidad del topping cambiada correctamente.",
    });
  };

  const availableCount = inventory.filter(item => item.isAvailable).length;
  const unavailableCount = inventory.length - availableCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventario</h1>
          <p className="text-muted-foreground">
            {availableCount} productos disponibles • {unavailableCount} no disponibles
          </p>
        </div>
        <Button className="flex items-center gap-2">
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
              <p className="text-2xl font-bold">{inventory.length}</p>
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
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <Card key={item.id} className={!item.isAvailable ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                </div>
                <Switch
                  checked={item.isAvailable}
                  onCheckedChange={() => toggleProductAvailability(item.id)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Badge variant={item.isAvailable ? "default" : "secondary"}>
                  {item.isAvailable ? 'Disponible' : 'No Disponible'}
                </Badge>
                <span className="font-bold text-lg">${item.price.toLocaleString()}</span>
              </div>
            </CardHeader>
            
            {item.availableToppings.length > 0 && (
              <CardContent>
                <h4 className="font-medium mb-3">Toppings Disponibles</h4>
                <div className="space-y-2">
                  {item.availableToppings.map((topping) => (
                    <div key={topping.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={topping.price > 0}
                          onCheckedChange={() => toggleToppingAvailability(item.id, topping.id)}
                          size="sm"
                        />
                        <span className={`text-sm ${topping.price === 0 ? 'text-muted-foreground line-through' : ''}`}>
                          {topping.name}
                        </span>
                      </div>
                      {topping.price > 0 && (
                        <span className="text-sm font-medium">+${topping.price.toLocaleString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
