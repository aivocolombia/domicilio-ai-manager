import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Package,
  AlertCircle,
  CheckCircle,
  Search,
  Plus,
  Minus,
  TrendingDown,
  UtensilsCrossed,
  ShoppingBasket,
  Info,
  Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Ingredient, Product } from '@/types/inventory';
import {
  MOCK_INGREDIENTS,
  PRODUCTS,
  RECIPES,
  calculateAvailablePortions,
  getLimitingIngredient
} from '@/services/inventoryService';

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const getUnitLabel = (unit: string): string => {
  const labels: Record<string, string> = {
    'kg': 'kg',
    'g': 'g',
    'l': 'L',
    'ml': 'ml',
    'unidades': 'unid.'
  };
  return labels[unit] || unit;
};

export const POSInventory: React.FC = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>(MOCK_INGREDIENTS);
  const [products] = useState<Product[]>(PRODUCTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'ingredients' | 'products'>('products');
  const [ingredientCategory, setIngredientCategory] = useState<string>('all');
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>('');

  // Filtrar ingredientes
  const filteredIngredients = ingredients.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = ingredientCategory === 'all' || item.category === ingredientCategory;
    return matchesSearch && matchesCategory;
  });

  // Calcular estadísticas de ingredientes
  const ingredientStats = {
    total: ingredients.length,
    lowStock: ingredients.filter(i => i.stock <= i.minStock).length,
    outOfStock: ingredients.filter(i => i.stock === 0).length,
    available: ingredients.filter(i => i.stock > i.minStock).length
  };

  // Calcular estadísticas de productos
  const productsWithPortions = products.map(product => ({
    ...product,
    availablePortions: calculateAvailablePortions(product.id, ingredients, RECIPES),
    limitingIngredient: getLimitingIngredient(product.id, ingredients, RECIPES)
  }));

  const productStats = {
    total: products.length,
    available: productsWithPortions.filter(p => p.availablePortions > 0).length,
    lowStock: productsWithPortions.filter(p => p.availablePortions > 0 && p.availablePortions <= 5).length,
    outOfStock: productsWithPortions.filter(p => p.availablePortions === 0).length
  };

  // Ajustar stock de ingrediente
  const adjustIngredientStock = (ingredientId: string, delta: number) => {
    setIngredients(prev => prev.map(ing => {
      if (ing.id === ingredientId) {
        const newStock = Math.max(0, ing.stock + delta);
        return { ...ing, stock: newStock };
      }
      return ing;
    }));

    toast({
      title: delta > 0 ? 'Stock aumentado' : 'Stock disminuido',
      description: `${Math.abs(delta)} ${getUnitLabel(ingredients.find(i => i.id === ingredientId)?.unit || '')}`,
    });
  };

  // Abrir diálogo para editar cantidad manualmente
  const openEditDialog = (ingredient: Ingredient) => {
    setEditingIngredient(ingredient);
    setEditQuantity(ingredient.stock.toString());
  };

  // Guardar cantidad editada manualmente
  const saveManualQuantity = () => {
    if (!editingIngredient) return;

    const quantity = parseFloat(editQuantity);
    if (isNaN(quantity) || quantity < 0) {
      toast({
        title: 'Error',
        description: 'Ingresa una cantidad válida',
        variant: 'destructive'
      });
      return;
    }

    setIngredients(prev => prev.map(ing => {
      if (ing.id === editingIngredient.id) {
        return { ...ing, stock: quantity };
      }
      return ing;
    }));

    toast({
      title: 'Stock actualizado',
      description: `${editingIngredient.name}: ${quantity} ${getUnitLabel(editingIngredient.unit)}`,
    });

    setEditingIngredient(null);
    setEditQuantity('');
  };

  const getIngredientStatus = (ingredient: Ingredient) => {
    if (ingredient.stock === 0) {
      return { label: 'Agotado', color: 'bg-red-100 text-red-800', icon: AlertCircle };
    }
    if (ingredient.stock <= ingredient.minStock) {
      return { label: 'Stock Bajo', color: 'bg-yellow-100 text-yellow-800', icon: TrendingDown };
    }
    return { label: 'Disponible', color: 'bg-green-100 text-green-800', icon: CheckCircle };
  };

  const getProductStatus = (portions: number) => {
    if (portions === 0) {
      return { label: 'Sin Stock', color: 'bg-red-100 text-red-800', icon: AlertCircle };
    }
    if (portions <= 5) {
      return { label: 'Stock Bajo', color: 'bg-yellow-100 text-yellow-800', icon: TrendingDown };
    }
    return { label: 'Disponible', color: 'bg-green-100 text-green-800', icon: CheckCircle };
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      'proteina': 'Proteínas',
      'vegetal': 'Vegetales',
      'grano': 'Granos',
      'lacteo': 'Lácteos',
      'condimento': 'Condimentos',
      'bebida': 'Bebidas',
      'otro': 'Otros'
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6">
      {/* Tabs: Productos vs Ingredientes */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="ingredients" className="flex items-center gap-2">
            <ShoppingBasket className="h-4 w-4" />
            Ingredientes
          </TabsTrigger>
        </TabsList>

        {/* Vista de Productos */}
        <TabsContent value="products" className="space-y-6 mt-6">
          {/* Estadísticas de productos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Productos</p>
                    <p className="text-3xl font-bold">{productStats.total}</p>
                  </div>
                  <Package className="h-10 w-10 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Disponibles</p>
                    <p className="text-3xl font-bold text-green-600">{productStats.available}</p>
                  </div>
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Stock Bajo</p>
                    <p className="text-3xl font-bold text-yellow-600">{productStats.lowStock}</p>
                  </div>
                  <TrendingDown className="h-10 w-10 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sin Stock</p>
                    <p className="text-3xl font-bold text-red-600">{productStats.outOfStock}</p>
                  </div>
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de productos con porciones disponibles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Productos - Porciones Disponibles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {productsWithPortions.map((product) => {
                const status = getProductStatus(product.availablePortions);
                const StatusIcon = status.icon;

                return (
                  <Card key={product.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        {/* Info del producto */}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-lg">{product.name}</h4>
                            <Badge className={status.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 text-sm">
                            <span className="font-bold text-2xl text-blue-600">
                              {product.availablePortions} porciones
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(product.price)}
                            </span>
                          </div>

                          {/* Ingrediente limitante */}
                          {product.limitingIngredient && product.availablePortions <= 10 && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Info className="h-3 w-3" />
                              <span>
                                Limitado por: <strong>{product.limitingIngredient.ingredient.name}</strong>
                                {' '}({product.limitingIngredient.ingredient.stock} {getUnitLabel(product.limitingIngredient.ingredient.unit)})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vista de Ingredientes */}
        <TabsContent value="ingredients" className="space-y-6 mt-6">
          {/* Estadísticas de ingredientes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Ingredientes</p>
                    <p className="text-3xl font-bold">{ingredientStats.total}</p>
                  </div>
                  <ShoppingBasket className="h-10 w-10 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Stock OK</p>
                    <p className="text-3xl font-bold text-green-600">{ingredientStats.available}</p>
                  </div>
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Stock Bajo</p>
                    <p className="text-3xl font-bold text-yellow-600">{ingredientStats.lowStock}</p>
                  </div>
                  <TrendingDown className="h-10 w-10 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Agotados</p>
                    <p className="text-3xl font-bold text-red-600">{ingredientStats.outOfStock}</p>
                  </div>
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Búsqueda y filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBasket className="h-5 w-5" />
                Gestión de Ingredientes e Insumos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Búsqueda */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ingrediente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtros por categoría */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={ingredientCategory === 'all' ? 'default' : 'outline'}
                  onClick={() => setIngredientCategory('all')}
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={ingredientCategory === 'proteina' ? 'default' : 'outline'}
                  onClick={() => setIngredientCategory('proteina')}
                >
                  Proteínas
                </Button>
                <Button
                  size="sm"
                  variant={ingredientCategory === 'vegetal' ? 'default' : 'outline'}
                  onClick={() => setIngredientCategory('vegetal')}
                >
                  Vegetales
                </Button>
                <Button
                  size="sm"
                  variant={ingredientCategory === 'grano' ? 'default' : 'outline'}
                  onClick={() => setIngredientCategory('grano')}
                >
                  Granos
                </Button>
                <Button
                  size="sm"
                  variant={ingredientCategory === 'lacteo' ? 'default' : 'outline'}
                  onClick={() => setIngredientCategory('lacteo')}
                >
                  Lácteos
                </Button>
                <Button
                  size="sm"
                  variant={ingredientCategory === 'condimento' ? 'default' : 'outline'}
                  onClick={() => setIngredientCategory('condimento')}
                >
                  Condimentos
                </Button>
                <Button
                  size="sm"
                  variant={ingredientCategory === 'bebida' ? 'default' : 'outline'}
                  onClick={() => setIngredientCategory('bebida')}
                >
                  Bebidas
                </Button>
              </div>

              {/* Lista de ingredientes */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {filteredIngredients.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingBasket className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No se encontraron ingredientes</p>
                  </div>
                ) : (
                  filteredIngredients.map((ingredient) => {
                    const status = getIngredientStatus(ingredient);
                    const StatusIcon = status.icon;
                    const percentage = (ingredient.stock / ingredient.minStock) * 100;

                    return (
                      <Card key={ingredient.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            {/* Info del ingrediente */}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{ingredient.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {getCategoryLabel(ingredient.category)}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-muted-foreground">
                                  Stock: <span className="font-bold text-lg">{ingredient.stock}</span> {getUnitLabel(ingredient.unit)}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">
                                  Mínimo: {ingredient.minStock} {getUnitLabel(ingredient.unit)}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-green-600 font-semibold">
                                  {formatCurrency(ingredient.cost)}/{getUnitLabel(ingredient.unit)}
                                </span>
                              </div>

                              <Badge className={cn(status.color, 'font-medium')}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                                {percentage < 100 && percentage > 0 && (
                                  <span className="ml-1">({Math.round(percentage)}%)</span>
                                )}
                              </Badge>
                            </div>

                            {/* Controles de stock */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => adjustIngredientStock(ingredient.id, -1)}
                                  disabled={ingredient.stock === 0}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => adjustIngredientStock(ingredient.id, 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => adjustIngredientStock(ingredient.id, 10)}
                                >
                                  +10
                                </Button>
                              </div>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openEditDialog(ingredient)}
                                className="gap-1"
                              >
                                <Edit3 className="h-3 w-3" />
                                Editar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Diálogo para editar cantidad manualmente */}
      <Dialog open={!!editingIngredient} onOpenChange={() => setEditingIngredient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Stock - {editingIngredient?.name}</DialogTitle>
            <DialogDescription>
              Ingresa la cantidad actual de stock en {editingIngredient && getUnitLabel(editingIngredient.unit)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Cantidad ({editingIngredient && getUnitLabel(editingIngredient.unit)})
              </Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej: 200"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveManualQuantity();
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">
                Stock actual: {editingIngredient?.stock} {editingIngredient && getUnitLabel(editingIngredient.unit)}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingIngredient(null)}>
              Cancelar
            </Button>
            <Button onClick={saveManualQuantity}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
