
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Package, Plus, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useMenu } from '@/hooks/useMenu';
import { useInventoryEvents } from '@/contexts/InventoryContext';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/format';
import { menuService } from '@/services/menuService';
import { PlatoConSede, BebidaConSede } from '@/types/menu';
import { debugUtils } from '@/utils/debug';
import { supabase } from '@/lib/supabase';

interface InventoryProps {
  effectiveSedeId: string;
  currentSedeName: string;
}

export const Inventory: React.FC<InventoryProps> = ({ 
  effectiveSedeId, 
  currentSedeName: propCurrentSedeName 
}) => {
  const { profile } = useAuth();
  const { currentSedeName: contextSedeName } = useSede();
  const { triggerUpdate } = useInventoryEvents();
  
  // Usar la sede efectiva (la seleccionada por admin o la asignada al agente)
  const currentSedeName = propCurrentSedeName || contextSedeName;
  
  // Estado local para nombre de sede (fallback si contexto no funciona)
  const [localSedeName, setLocalSedeName] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platosConSede, setPlatosConSede] = useState<PlatoConSede[]>([]);
  const [bebidasConSede, setBebidasConSede] = useState<BebidaConSede[]>([]);

  // Función para cargar el inventario con información de sede
  const loadInventoryConSede = async () => {
    if (!effectiveSedeId) {
      setError('No se ha seleccionado una sede');
      setLoading(false);
      return;
    }

    // Evitar cargas concurrentes
    if (loading) {
      console.log('🔄 Ya hay una carga de inventario en progreso, saltando...');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Cargando inventario para sede:', effectiveSedeId);
      
      // Timeout para evitar cuelgues
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout cargando inventario')), 15000);
      });
      
      const menuPromise = menuService.getMenuConSede(effectiveSedeId);
      const menuData = await Promise.race([menuPromise, timeoutPromise]);
      
      setPlatosConSede(menuData.platos);
      setBebidasConSede(menuData.bebidas);
      
      console.log('✅ Inventario cargado exitosamente');
    } catch (err) {
      console.error('❌ Error al cargar inventario:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  // Cargar inventario al montar el componente
  useEffect(() => {
    loadInventoryConSede();
  }, [effectiveSedeId]);

  // Cargar nombre de la sede al montar el componente
  useEffect(() => {
    loadSedeName();
  }, [effectiveSedeId]);

  // Combinar solo platos y bebidas para mostrar en el inventario (incluyendo inactivos)
  const allProducts = [
    ...platosConSede.map(plato => ({
      ...plato,
      type: 'plato' as const,
      category: 'Platos Principales',
      description: plato.description || 'Sin descripción',
      available: plato.sede_available,
      pricing: plato.sede_price,
      toppings: plato.toppings || [] // Incluir los toppings del plato
    })),
    ...bebidasConSede.map(bebida => ({
      ...bebida,
      type: 'bebida' as const,
      category: 'Bebidas',
      description: 'Bebida refrescante',
      available: bebida.sede_available,
      pricing: bebida.sede_price
    }))
  ];

  const categories = ['all', ...new Set(allProducts.map(item => item.category))];
  
  const filteredItems = allProducts.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleProductAvailability = async (productId: number, type: 'plato' | 'bebida') => {
    console.log('🚀 toggleProductAvailability INICIADO:', { productId, type, profile_sede_id: profile?.sede_id });
    
    if (!profile?.sede_id) {
      toast({
        title: "Error",
        description: "No se ha asignado una sede al usuario.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔄 Toggleando producto:', { productId, type, sedeId: profile.sede_id });
      
      const product = allProducts.find(item => item.id === productId && item.type === type);
      if (!product) {
        console.log('❌ Producto no encontrado:', { productId, type, availableProducts: allProducts.map(p => ({ id: p.id, name: p.name, type: p.type })) });
        return;
      }

      const isCurrentlyAvailable = product.available;
      console.log('📊 Estado actual:', { 
        name: product.name, 
        available: isCurrentlyAvailable,
        productId: product.id,
        type: product.type
      });
      
      // Debug específico para Limonada natural
      if (product.name.toLowerCase().includes('limonada')) {
        console.log('🍋 Debug Limonada ANTES del toggle:', {
          product,
          sedeId: profile.sede_id,
          isCurrentlyAvailable,
          toggleTo: !isCurrentlyAvailable,
          bebidasConSede: bebidasConSede.filter(b => b.name.toLowerCase().includes('limonada'))
        });
      }
      
      switch (type) {
        case 'plato':
          console.log('🍽️ Actualizando plato para sede...');
          await menuService.updatePlatoSedeAvailability(profile.sede_id, productId, !isCurrentlyAvailable);
          break;
        case 'bebida':
          console.log('🥤 Actualizando bebida para sede...');
          await menuService.updateBebidaSedeAvailability(profile.sede_id, productId, !isCurrentlyAvailable);
          break;
      }

      console.log('🔄 Recargando inventario...');
      
      // Pequeña pausa para asegurar que la DB se ha actualizado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Recargar el inventario para actualizar el frontend
      await loadInventoryConSede();
      
      // Debug específico para Limonada DESPUÉS del reload
      if (product.name.toLowerCase().includes('limonada')) {
        console.log('🍋 Debug Limonada INMEDIATAMENTE después del primer reload:', {
          bebidasConSede_length: bebidasConSede.length,
          bebidasConSede_limonada: bebidasConSede.filter(b => b.name?.toLowerCase().includes('limonada')),
          allProducts_length: allProducts.length,
          allProducts_limonada: allProducts.filter(p => p.name?.toLowerCase().includes('limonada'))
        });
        
        // Force re-fetch después del delay para asegurar que tenemos datos actualizados
        setTimeout(async () => {
          console.log('🍋 Haciendo segundo reload...');
          await loadInventoryConSede();
          
          // Verificar el estado después del segundo reload
          setTimeout(() => {
            console.log('🍋 Debug Limonada DESPUÉS del segundo reload:', {
              bebidasConSede_final: bebidasConSede.filter(b => b.name?.toLowerCase().includes('limonada')),
              allProducts_final: allProducts.filter(p => p.name?.toLowerCase().includes('limonada'))
            });
          }, 50);
        }, 500);
      }

      // Disparar evento de actualización para el StatusBar
      triggerUpdate();

      toast({
        title: "Producto actualizado",
        description: `${product.name} ${isCurrentlyAvailable ? 'desactivado' : 'activado'} correctamente para esta sede.`,
      });
    } catch (err) {
      console.error('❌ Error al actualizar producto:', err);
      toast({
        title: "Error",
        description: "No se pudo actualizar el producto.",
        variant: "destructive"
      });
    }
  };

  const toggleToppingAvailability = async (toppingId: number) => {
    if (!profile?.sede_id) {
      toast({
        title: "Error",
        description: "No se ha asignado una sede al usuario.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔄 Toggleando topping:', { toppingId, sedeId: profile.sede_id });
      
      // Buscar el topping en todos los platos para obtener su estado actual
      let currentTopping: any = null;
      let isCurrentlyAvailable = false;
      
      for (const plato of platosConSede) {
        const topping = plato.toppings.find(t => t.id === toppingId);
        if (topping) {
          currentTopping = topping;
          isCurrentlyAvailable = topping.sede_available;
          break;
        }
      }

      if (!currentTopping) {
        console.log('❌ Topping no encontrado:', toppingId);
        return;
      }

      console.log('📊 Estado actual del topping:', { 
        name: currentTopping.name, 
        available: isCurrentlyAvailable 
      });
      
      await menuService.updateToppingSedeAvailability(
        profile.sede_id, 
        toppingId, 
        !isCurrentlyAvailable
      );

      console.log('🔄 Recargando inventario...');
      // Recargar el inventario para actualizar el frontend
      await loadInventoryConSede();

      // Disparar evento de actualización para el StatusBar
      triggerUpdate();

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

  // Función para limpiar errores
  const clearError = () => {
    setError(null);
  };

  // Función de debug para la Limonada natural
  const debugLimonada = async () => {
    if (!profile?.sede_id) {
      toast({
        title: "Error",
        description: "No se ha asignado una sede al usuario.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔍 Debug: Iniciando verificación de Limonada natural...');
      
      // Verificar estado de la Limonada
      const limonadaStatus = await debugUtils.checkBebidaStatus('Limonada natural', profile.sede_id);
      console.log('🍋 Estado de Limonada:', limonadaStatus);

      if (limonadaStatus.error) {
        toast({
          title: "Error en debug",
          description: limonadaStatus.error,
          variant: "destructive"
        });
        return;
      }

      if (!limonadaStatus.exists) {
        console.log('➕ Creando registro faltante para Limonada...');
        const createResult = await debugUtils.createSedeBebidaRecord(
          profile.sede_id, 
          limonadaStatus.bebida.id
        );
        
        if (createResult.error) {
          toast({
            title: "Error al crear registro",
            description: createResult.error,
            variant: "destructive"
          });
          return;
        }

        toast({
          title: "Registro creado",
          description: "Se creó el registro faltante para la Limonada natural.",
        });

        // Recargar inventario
        await loadInventoryConSede();
      } else {
        toast({
          title: "Registro existe",
          description: "La Limonada natural ya tiene registro en esta sede.",
        });
      }
    } catch (error) {
      console.error('❌ Error en debug:', error);
      toast({
        title: "Error",
        description: "Error al verificar la Limonada natural.",
        variant: "destructive"
      });
    }
  };

  // Función de debug para Toppings
  const debugToppings = async () => {
    if (!profile?.sede_id) {
      toast({
        title: "Error",
        description: "No se ha asignado una sede al usuario.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔍 Debug: Iniciando verificación de toppings...');
      
      // Verificar todos los toppings en la sede
      const result = await debugUtils.checkAllToppingsInSede(profile.sede_id);
      
      if (result.error) {
        toast({
          title: "Error en verificación",
          description: result.error,
          variant: "destructive"
        });
        return;
      }

      const toppingsFaltantes = result.data.filter(item => !item.hasRecord);
      
      if (toppingsFaltantes.length > 0) {
        console.log('❌ Toppings faltantes:', toppingsFaltantes);
        
        // Crear registros faltantes
        for (const item of toppingsFaltantes) {
          const createResult = await debugUtils.createSedeToppingRecord(profile.sede_id, item.topping.id);
          if (createResult.error) {
            console.error(`❌ Error al crear registro para ${item.topping.name}:`, createResult.error);
          }
        }

        toast({
          title: "Registros creados",
          description: `Se crearon ${toppingsFaltantes.length} registros faltantes para toppings.`,
        });

        // Recargar inventario
        await loadInventoryConSede();
      } else {
        toast({
          title: "Registros completos",
          description: "Todos los toppings tienen registros en esta sede.",
        });
      }
    } catch (error) {
      console.error('❌ Error en debugToppings:', error);
      toast({
        title: "Error",
        description: "Error inesperado al verificar toppings.",
        variant: "destructive"
      });
    }
  };

  // Función para inicializar productos de la sede
  const initializeSedeProducts = async () => {
    if (!profile?.sede_id) {
      toast({
        title: "Error",
        description: "No se ha asignado una sede al usuario.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔄 Inicializando productos para sede:', profile.sede_id);
      
      await menuService.initializeSedeProductsForAgent(profile.sede_id);
      
      // Recargar inventario
      await loadInventoryConSede();
      
      toast({
        title: "Productos inicializados",
        description: "Todos los productos han sido inicializados y activados para esta sede.",
      });
      
    } catch (error) {
      console.error('❌ Error inicializando productos:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al inicializar productos",
        variant: "destructive"
      });
    }
  };

  // Cargar nombre de la sede como fallback
  const loadSedeName = async () => {
    if (!effectiveSedeId) return;
    
    try {
      const { data, error } = await supabase
        .from('sedes')
        .select('name')
        .eq('id', effectiveSedeId)
        .single();
      
      if (!error && data) {
        setLocalSedeName(data.name);
      }
    } catch (error) {
      console.error('❌ Error cargando nombre de sede:', error);
    }
  };

  // Mostrar error si no hay sede seleccionada
  if (!effectiveSedeId) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-bold mb-4">Sede No Seleccionada</h2>
          <p className="text-muted-foreground mb-6">
            {profile?.role === 'admin' 
              ? 'Selecciona una sede desde el selector en la parte superior.'
              : 'No se ha asignado una sede a tu cuenta. Contacta al administrador para que te asigne una sede.'
            }
          </p>
        </div>
      </div>
    );
  }

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
            {availableCount} productos disponibles • {unavailableCount} no disponibles • Sede: {currentSedeName !== 'Sede Desconocida' ? currentSedeName : (localSedeName || 'Cargando...')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="flex items-center gap-2" disabled={loading} onClick={() => {
            toast({
              title: "Funcionalidad en desarrollo",
              description: "La funcionalidad de agregar productos estará disponible pronto.",
            });
          }}>
            <Plus className="h-4 w-4" />
            Agregar Producto
          </Button>
          
          {/* Botón para inicializar productos si hay problemas */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={initializeSedeProducts}
            disabled={loading}
            title="Inicializar productos si no aparecen o no se pueden activar"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Inicializar Productos
          </Button>
        </div>
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
                    onCheckedChange={() => {
                      console.log('🖱️ Switch clicked para producto:', item.name, 'ID:', item.id, 'Type:', item.type, 'Loading:', loading);
                      toggleProductAvailability(item.id, item.type);
                    }}
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
                          {!topping.sede_available && (
                            <Badge variant="secondary" className="text-xs">No disponible</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {topping.sede_price > 0 && (
                            <span className="text-sm font-medium">+{formatCurrency(topping.sede_price)}</span>
                          )}
                          <Switch
                            checked={topping.sede_available}
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
