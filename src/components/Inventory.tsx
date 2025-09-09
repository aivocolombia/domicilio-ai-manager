
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Package, Plus, Loader2, AlertCircle, RefreshCw, Trash2, X } from 'lucide-react';
import { useMenu } from '@/hooks/useMenu';
import { useInventoryEvents } from '@/contexts/InventoryContext';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useSede } from '@/contexts/SedeContext';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/format';
import { menuService } from '@/services/menuService';
import { sedeServiceSimple } from '@/services/sedeServiceSimple';
import { PlatoConSede, BebidaConSede, ToppingConSede } from '@/types/menu';
import { debugUtils } from '@/utils/debug';
import { supabase } from '@/lib/supabase';
import { AddToppingsModal } from '@/components/AddToppingsModal';
import { CreateProductModal } from '@/components/CreateProductModal';

interface InventoryProps {
  effectiveSedeId: string;
  currentSedeName: string;
}

export const Inventory: React.FC<InventoryProps> = ({ 
  effectiveSedeId, 
  currentSedeName: propCurrentSedeName 
}) => {
  const { profile } = useAuth();
  const { permissions } = usePermissions();
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
  const [toppingsConSede, setToppingsConSede] = useState<ToppingConSede[]>([]);

  // Estado para controlar cargas concurrentes
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  
  // Estado para los modales
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddToppingsModal, setShowAddToppingsModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);

  // Función para cargar el inventario con información de sede
  const loadInventoryConSede = async () => {
    if (!effectiveSedeId) {
      setError('No se ha seleccionado una sede');
      setLoading(false);
      return;
    }

    // Evitar cargas concurrentes usando estado separado
    if (isLoadingInventory) {
      console.log('🔄 Ya hay una carga de inventario en progreso, saltando...');
      return;
    }

    try {
      setIsLoadingInventory(true);
      setLoading(true);
      setError(null);
      
      console.log('🔍 Cargando inventario para sede:', effectiveSedeId);
      
      // Invalidar caché para obtener datos frescos de inventario
      sedeServiceSimple.invalidateSedeCache(effectiveSedeId);
      
      // Usar el servicio optimizado con caché
      const { platos, bebidas, toppings } = await sedeServiceSimple.getSedeCompleteInfo(effectiveSedeId, true);
      
      // Transformar a formato compatible con el componente
      // En sedeServiceSimple, is_available es la disponibilidad específica de la sede
      const menuData = {
        platos: platos.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          pricing: p.pricing, // precio base del plato
          is_available: true, // asumimos que el plato base está disponible
          sede_pricing: p.pricing, // precio específico de la sede (o base si no hay override)
          sede_is_available: p.is_available, // disponibilidad específica de la sede
          sede_available: p.is_available, // alias para compatibilidad con StatusBar
          sede_price: p.pricing, // alias para compatibilidad con StatusBar
          toppings: (p.toppings || []).map(t => ({
            id: t.id,
            name: t.name,
            description: t.description || '',
            pricing: t.pricing,
            is_available: true,
            sede_pricing: t.pricing,
            sede_is_available: t.is_available,
            sede_available: t.is_available, // alias para compatibilidad con StatusBar
            sede_price: t.pricing // alias para compatibilidad con StatusBar
          }))
        })),
        bebidas: bebidas.map(b => ({
          id: b.id,
          name: b.name,
          description: b.description || '',
          pricing: b.pricing, // precio base de la bebida
          is_available: true, // asumimos que la bebida base está disponible
          sede_pricing: b.pricing, // precio específico de la sede (o base si no hay override)
          sede_is_available: b.is_available, // disponibilidad específica de la sede
          sede_available: b.is_available, // alias para compatibilidad con StatusBar
          sede_price: b.pricing // alias para compatibilidad con StatusBar
        })),
        toppings: toppings.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description || '',
          pricing: t.pricing, // precio base del topping
          is_available: true, // asumimos que el topping base está disponible
          sede_pricing: t.pricing, // precio específico de la sede (o base si no hay override)
          sede_is_available: t.is_available // disponibilidad específica de la sede
        }))
      };
      
      setPlatosConSede(menuData.platos);
      setBebidasConSede(menuData.bebidas);
      setToppingsConSede(menuData.toppings);
      
      console.log('✅ Inventario cargado exitosamente');
    } catch (err) {
      console.error('❌ Error al cargar inventario:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoadingInventory(false);
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
  // Los toppings se muestran dentro de cada plato
  const allProducts = [
    ...platosConSede.map(plato => ({
      ...plato,
      type: 'plato' as const,
      category: 'Platos Principales',
      description: plato.description || 'Sin descripción',
      available: plato.sede_is_available,
      pricing: plato.sede_pricing,
      toppings: plato.toppings || [] // Los toppings están dentro del plato
    })),
    ...bebidasConSede.map(bebida => ({
      ...bebida,
      type: 'bebida' as const,
      category: 'Bebidas',
      description: bebida.description || 'Bebida refrescante',
      available: bebida.sede_is_available,
      pricing: bebida.sede_pricing
    }))
    // ❌ NO incluimos toppings como productos separados
  ];

  const categories = ['all', ...new Set(allProducts.map(item => item.category))];
  
  const filteredItems = allProducts.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleProductAvailability = async (productId: number, type: 'plato' | 'bebida' | 'topping') => {
    console.log('🚀 toggleProductAvailability INICIADO:', { productId, type, effectiveSedeId });
    
    if (!effectiveSedeId) {
      toast({
        title: "Error",
        description: "No se ha seleccionado una sede para gestionar el inventario.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔄 Toggleando producto:', { productId, type, sedeId: effectiveSedeId });
      
      // Encontrar el producto en el estado local
      let product;
      let currentList;
      let updateFunction;
      
      if (type === 'plato') {
        product = platosConSede.find(p => p.id === productId);
        currentList = platosConSede;
        updateFunction = setPlatosConSede;
      } else if (type === 'bebida') {
        product = bebidasConSede.find(p => p.id === productId);
        currentList = bebidasConSede;
        updateFunction = setBebidasConSede;
      } else { // topping
        product = toppingsConSede.find(p => p.id === productId);
        currentList = toppingsConSede;
        updateFunction = setToppingsConSede;
      }
      
      if (!product) {
        console.log('❌ Producto no encontrado en estado local');
        return;
      }

      const newAvailability = !product.sede_is_available;
      console.log('📊 Toggle:', { 
        name: product.name, 
        from: product.sede_is_available,
        to: newAvailability
      });
      
      // Actualizar directamente en la base de datos
      const tableName = type === 'plato' ? 'sede_platos' : 
                       type === 'bebida' ? 'sede_bebidas' : 'sede_toppings';
      const idField = type === 'plato' ? 'plato_id' : 
                     type === 'bebida' ? 'bebida_id' : 'topping_id';
      
      const { error } = await supabase
        .from(tableName)
        .update({ available: newAvailability })
        .eq('sede_id', effectiveSedeId)
        .eq(idField, productId);

      if (error) {
        throw error;
      }

      // Actualizar estado local inmediatamente (optimistic update)
      const updatedList = currentList.map(item => 
        item.id === productId 
          ? { ...item, sede_is_available: newAvailability, is_available: newAvailability }
          : item
      );
      updateFunction(updatedList);

      // Invalidar caché para refrescar datos
      sedeServiceSimple.invalidateSedeCache(effectiveSedeId);

      toast({
        title: "Producto actualizado",
        description: `${product.name} ${newAvailability ? 'activado' : 'desactivado'} correctamente.`,
      });

      console.log('✅ Producto actualizado exitosamente');
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
    if (!effectiveSedeId) {
      toast({
        title: "Error",
        description: "No se ha seleccionado una sede para gestionar el inventario.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('🔄 Toggleando topping:', { toppingId, sedeId: effectiveSedeId });
      
      // Buscar el topping en todos los platos
      let toppingFound = null;
      let platoWithTopping = null;
      
      for (const plato of platosConSede) {
        const topping = plato.toppings?.find(t => t.id === toppingId);
        if (topping) {
          toppingFound = topping;
          platoWithTopping = plato;
          break;
        }
      }
      
      if (!toppingFound) {
        console.log('❌ Topping no encontrado en estado local');
        return;
      }

      const newAvailability = !toppingFound.sede_is_available;
      console.log('📊 Toggle topping:', { 
        name: toppingFound.name, 
        from: toppingFound.sede_is_available,
        to: newAvailability
      });
      
      // Actualizar directamente en la base de datos
      const { error } = await supabase
        .from('sede_toppings')
        .update({ available: newAvailability })
        .eq('sede_id', effectiveSedeId)
        .eq('topping_id', toppingId);

      if (error) {
        throw error;
      }

      // Actualizar estado local inmediatamente (optimistic update)
      // Actualizar el topping dentro de todos los platos que lo contengan
      const updatedPlatos = platosConSede.map(plato => ({
        ...plato,
        toppings: plato.toppings?.map(topping => 
          topping.id === toppingId 
            ? { 
                ...topping, 
                sede_is_available: newAvailability, 
                sede_available: newAvailability, // también actualizar el alias para compatibilidad
                is_available: newAvailability 
              }
            : topping
        ) || []
      }));
      setPlatosConSede(updatedPlatos);

      // Invalidar caché para refrescar datos
      sedeServiceSimple.invalidateSedeCache(effectiveSedeId);

      toast({
        title: "Topping actualizado",
        description: `${toppingFound.name} ${newAvailability ? 'activado' : 'desactivado'} correctamente.`,
      });

      console.log('✅ Topping actualizado exitosamente');
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

  // Eliminar producto completo
  const deleteProduct = async (productId: number, type: 'plato' | 'bebida', productName: string) => {
    try {
      console.log('🗑️ Eliminando producto:', { productId, type, productName });
      
      await menuService.deleteProduct(productId, type);
      
      // Recargar inventario
      await loadInventoryConSede();
      
      // Disparar evento de actualización para el StatusBar
      triggerUpdate();
      
      toast({
        title: "Producto eliminado",
        description: `${productName} eliminado exitosamente.`,
      });
      
    } catch (error) {
      console.error('❌ Error eliminando producto:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo eliminar el producto.",
        variant: "destructive"
      });
    }
  };

  // Eliminar relación topping-plato
  const removeToppingFromPlato = async (platoId: number, toppingId: number, toppingName: string, platoName: string) => {
    try {
      console.log('🗑️ Eliminando relación topping-plato:', { platoId, toppingId, toppingName, platoName });
      
      await menuService.removeToppingFromPlato(platoId, toppingId);
      
      // Recargar inventario
      await loadInventoryConSede();
      
      // Disparar evento de actualización para el StatusBar
      triggerUpdate();
      
      toast({
        title: "Topping removido",
        description: `${toppingName} removido de ${platoName} exitosamente.`,
      });
      
    } catch (error) {
      console.error('❌ Error removiendo topping:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo remover el topping.",
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
          {/* Botón Agregar Producto - Solo visible para usuarios con permisos */}
          {permissions.canCreateProduct && (
            <Button 
              className="flex items-center gap-2" 
              disabled={loading} 
              onClick={() => setShowAddProductModal(true)}
            >
              <Plus className="h-4 w-4" />
              Agregar Producto
            </Button>
          )}
          
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
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.available}
                      onCheckedChange={() => {
                        console.log('🖱️ Switch clicked para producto:', item.name, 'ID:', item.id, 'Type:', item.type, 'Loading:', loading);
                        toggleProductAvailability(item.id, item.type);
                      }}
                      disabled={loading}
                    />
                    {/* Botón eliminar - Solo visible para usuarios con permisos */}
                    {permissions.canDeleteProduct && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará permanentemente "{item.name}" y no se puede deshacer.
                            {item.type === 'plato' && item.toppings && item.toppings.length > 0 && (
                              <span className="block mt-2 font-medium text-orange-600">
                                También se eliminarán todas las relaciones con toppings asociados.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteProduct(item.id, item.type, item.name)}
                            disabled={loading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Eliminando...
                              </>
                            ) : (
                              'Eliminar'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    )}
                  </div>
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
                          {!topping.sede_is_available && (
                            <Badge variant="secondary" className="text-xs">No disponible</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {topping.sede_pricing > 0 && (
                            <span className="text-sm font-medium">+{formatCurrency(topping.sede_pricing)}</span>
                          )}
                          <Switch
                            checked={topping.sede_is_available}
                            onCheckedChange={() => toggleToppingAvailability(topping.id)}
                            disabled={loading}
                            size="sm"
                          />
                          {/* Botón eliminar topping - Solo visible para usuarios con permisos */}
                          {permissions.canDeleteTopping && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={loading}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Remover topping?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción removerá "{topping.name}" de "{item.name}".
                                  <span className="block mt-2 text-muted-foreground">
                                    Nota: Solo se elimina la relación, el topping seguirá existiendo para otros platos.
                                  </span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => removeToppingFromPlato(item.id, topping.id, topping.name, item.name)}
                                  disabled={loading}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {loading ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Removiendo...
                                    </>
                                  ) : (
                                    'Remover'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          )}
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

      {/* Modal para agregar productos */}
      <Dialog open={showAddProductModal} onOpenChange={setShowAddProductModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué deseas hacer?</DialogTitle>
            <DialogDescription>
              Elige una opción para agregar productos al inventario
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button
              onClick={() => {
                setShowAddProductModal(false);
                setShowAddToppingsModal(true);
              }}
              className="flex items-center justify-center gap-2 h-20"
              variant="outline"
            >
              <Package className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">Agregar Toppings</div>
                <div className="text-sm text-muted-foreground">A productos ya creados</div>
              </div>
            </Button>
            
            <Button
              onClick={() => {
                setShowAddProductModal(false);
                setShowCreateProductModal(true);
              }}
              className="flex items-center justify-center gap-2 h-20"
            >
              <Plus className="h-6 w-6" />
              <div className="text-left">
                <div className="font-medium">Crear Producto Nuevo</div>
                <div className="text-sm">Desde cero</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para agregar toppings a productos existentes */}
      <AddToppingsModal
        open={showAddToppingsModal}
        onOpenChange={setShowAddToppingsModal}
        effectiveSedeId={effectiveSedeId}
        onSuccess={loadInventoryConSede}
      />

      {/* Modal para crear productos nuevos */}
      <CreateProductModal
        open={showCreateProductModal}
        onOpenChange={setShowCreateProductModal}
        effectiveSedeId={effectiveSedeId}
        onSuccess={loadInventoryConSede}
      />
    </div>
  );
};
