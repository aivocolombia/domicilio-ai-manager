import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, Trash2, Plus, Minus, Navigation, ArrowUpDown } from 'lucide-react';
import { DashboardOrder } from '@/services/dashboardService';
import { useMenu } from '@/hooks/useMenu';
import { addressService } from '@/services/addressService';
import { supabase } from '@/lib/supabase';
import { sedeService } from '@/services/sedeService';
import { ProductSubstitutionDialog } from '@/components/ProductSubstitutionDialog';
import type { SubstitutionDetails } from '@/services/substitutionService';
import { substitutionHistoryService } from '@/services/substitutionHistoryService';

interface OrderItem {
  id: string;
  tipo: 'plato' | 'bebida' | 'topping';
  nombre: string;
  cantidad: number;
  precio_unitario: number;
  precio_total: number;
  producto_id: number;
  orden_item_id?: number; // ID único del item en ordenes_platos/bebidas/toppings
  substitutions?: SubstitutionDetails[];
}

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  order: DashboardOrder | null;
  onOrderUpdated: () => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  orderId,
  order,
  onOrderUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchingPrice, setSearchingPrice] = useState(false);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [newAddress, setNewAddress] = useState('');
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [sedeAddress, setSedeAddress] = useState<string>('');
  const [sedeId, setSedeId] = useState<string>('');
  const [cutleryCount, setCutleryCount] = useState<number>(0);

  // Estado para el diálogo de sustituciones
  const [substitutionDialogOpen, setSubstitutionDialogOpen] = useState(false);
  const [selectedItemForSubstitution, setSelectedItemForSubstitution] = useState<OrderItem | null>(null);

  // REMOVIDO: Estados de toppingsDialog - consolidado en ProductSubstitutionDialog

  // Estado para rastrear sustituciones realizadas
  const [substitutionHistory, setSubstitutionHistory] = useState<SubstitutionDetails[]>([]);

  // Estado para productos específicos de sede (disponibles)
  const [sedeProducts, setSedeProducts] = useState({
    platos: [] as any[],
    bebidas: [] as any[],
    toppings: [] as any[]
  });
  const [loadingSedeProducts, setLoadingSedeProducts] = useState(false);

  const { platos, bebidas, toppings } = useMenu();

  // Debug de productos de sede
  useEffect(() => {
    console.log('🔍 EditOrderModal: Productos de sede cargados:', sedeProducts);
  }, [sedeProducts]);

  // Funciones para agregar productos
  const handleAddPlato = (plato: { id: number; name: string; pricing?: number }) => {
    const newItem: OrderItem = {
      id: `new_plato_${Date.now()}_${Math.random()}`,
      tipo: 'plato',
      nombre: plato.name,
      cantidad: 1,
      precio_unitario: plato.pricing || 0,
      precio_total: plato.pricing || 0,
      producto_id: plato.id
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleAddBebida = (bebida: { id: number; name: string; pricing?: number }) => {
    const newItem: OrderItem = {
      id: `new_bebida_${Date.now()}_${Math.random()}`,
      tipo: 'bebida',
      nombre: bebida.name,
      cantidad: 1,
      precio_unitario: bebida.pricing || 0,
      precio_total: bebida.pricing || 0,
      producto_id: bebida.id
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleAddTopping = (topping: { id: number; name: string; pricing?: number }) => {
    const newItem: OrderItem = {
      id: `new_topping_${Date.now()}_${Math.random()}`,
      tipo: 'topping',
      nombre: topping.name,
      cantidad: 1,
      precio_unitario: topping.pricing || 0,
      precio_total: topping.pricing || 0,
      producto_id: topping.id
    };
    setItems(prev => [...prev, newItem]);
  };

  // Helpers para contador por producto disponible en grillas de agregar
  const getSelectedCount = (tipo: 'plato' | 'bebida' | 'topping', productoId: number) => {
    // Para los items cargados desde la BD, contar por producto_id (pueden tener múltiples instancias)
    const count = items
      .filter(item => item.tipo === tipo && item.producto_id === productoId)
      .reduce((sum, item) => sum + item.cantidad, 0);

    console.log(`🔍 [DEBUG] getSelectedCount(${tipo}, ${productoId}):`, count, 'items encontrados:', items.filter(item => item.tipo === tipo && item.producto_id === productoId));

    return count;
  };

  const incrementSelected = (tipo: 'plato' | 'bebida' | 'topping', producto: { id: number; name: string; pricing?: number }) => {
    // Buscar items existentes del mismo producto
    const existingItems = items.filter(item => item.tipo === tipo && item.producto_id === producto.id);

    if (existingItems.length > 0) {
      // Si hay items existentes, aumentar la cantidad del primero
      const firstItem = existingItems[0];
      handleQuantityChange(firstItem.id, firstItem.cantidad + 1);
      console.log(`🔍 [DEBUG] incrementSelected: Incrementando cantidad de ${firstItem.id} a ${firstItem.cantidad + 1}`);
    } else {
      // Si no hay items existentes, crear uno nuevo
      if (tipo === 'plato') handleAddPlato(producto as any);
      else if (tipo === 'bebida') handleAddBebida(producto as any);
      else handleAddTopping(producto as any);
      console.log(`🔍 [DEBUG] incrementSelected: Creando nuevo item ${tipo}_${producto.id}`);
    }
  };

  const decrementSelected = (tipo: 'plato' | 'bebida' | 'topping', productoId: number) => {
    // Buscar items existentes del mismo producto
    const existingItems = items.filter(item => item.tipo === tipo && item.producto_id === productoId);

    if (existingItems.length === 0) return;

    // Tomar el primer item para decrementar
    const firstItem = existingItems[0];

    if (firstItem.cantidad > 1) {
      handleQuantityChange(firstItem.id, firstItem.cantidad - 1);
      console.log(`🔍 [DEBUG] decrementSelected: Decrementando cantidad de ${firstItem.id} a ${firstItem.cantidad - 1}`);
    } else {
      handleRemoveItem(firstItem.id);
      console.log(`🔍 [DEBUG] decrementSelected: Eliminando item ${firstItem.id}`);
    }
  };

  // Funciones para manejar cantidades y eliminar items
  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            cantidad: newQuantity, 
            precio_total: item.precio_unitario * newQuantity 
          }
        : item
    ));
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  // Función para abrir el diálogo de sustitución
  const handleOpenSubstitution = (item: OrderItem) => {
    console.log('🔍 DEBUG EditOrderModal: Opening substitution for item:', item);
    console.log('🔍 DEBUG EditOrderModal: Item orden_item_id:', item.orden_item_id);
    setSelectedItemForSubstitution(item);
    setSubstitutionDialogOpen(true);
  };

  // Función para aplicar una sustitución
  const handleSubstitutionApplied = (originalItem: OrderItem, substitutedItem: OrderItem) => {
    // Conservar el orden_item_id del item original
    const updatedItem = {
      ...substitutedItem,
      orden_item_id: originalItem.orden_item_id
    };

    setItems(prev => prev.map(item =>
      item.id === originalItem.id ? updatedItem : item
    ));

    // Agregar al historial de sustituciones si es una sustitución de producto (sin duplicar)
    if (substitutedItem.producto_id !== originalItem.producto_id) {
      const substitutionDetail: SubstitutionDetails & { orden_item_id?: number } = {
        type: 'product_substitution',
        original_name: originalItem.nombre,
        substitute_name: substitutedItem.nombre,
        price_difference: substitutedItem.precio_unitario - originalItem.precio_unitario,
        orden_item_id: originalItem.orden_item_id // Incluir ID específico del item
      };

      setSubstitutionHistory(prev => {
        // Evitar duplicados de sustitución de productos para este item específico
        const filtered = prev.filter(existing =>
          !(existing.type === 'product_substitution' &&
            existing.original_name === substitutionDetail.original_name &&
            existing.substitute_name === substitutionDetail.substitute_name &&
            (existing as any).orden_item_id === substitutionDetail.orden_item_id)
        );
        return [...filtered, substitutionDetail];
      });
    }

    // Agregar detalles de sustitución de toppings si existen (sin duplicar)
    if ((substitutedItem as any)._substitutionDetails) {
      const newSubstitutions = (substitutedItem as any)._substitutionDetails as SubstitutionDetails[];
      console.log('🔍 DEBUG EditOrderModal: New substitutions from toppings dialog:', newSubstitutions);
      setSubstitutionHistory(prev => {
        const filtered = prev.filter(existing =>
          !newSubstitutions.some(newSub =>
            existing.original_name === newSub.original_name &&
            existing.substitute_name === newSub.substitute_name &&
            existing.parent_item_name === newSub.parent_item_name &&
            (existing as any).orden_item_id === (newSub as any).orden_item_id
          )
        );
        return [...filtered, ...newSubstitutions];
      });
    }

    toast({
      title: "Producto sustituido",
      description: `${originalItem.nombre} → ${substitutedItem.nombre}`,
    });
  };

  // REMOVIDO: handleOpenToppings y handleToppingsChanged - consolidado en ProductSubstitutionDialog

  // Función para normalizar direcciones (usa la misma que addressService)
  const normalizeAddress = (address: string) => {
    return addressService.normalizeAddress(address);
  };

  // Función para abrir Google Maps
  const openGoogleMaps = () => {
    if (!newAddress.trim()) {
      toast({
        title: "Error",
        description: "Debe ingresar una dirección para calcular la ruta",
        variant: "destructive"
      });
      return;
    }

    if (!sedeAddress) {
      toast({
        title: "Error",
        description: "No se pudo obtener la dirección de la sede",
        variant: "destructive"
      });
      return;
    }

    const orderAddress = newAddress.trim();

    const googleMapsUrl = `https://www.google.com/maps/dir/${encodeURIComponent(sedeAddress)}/${encodeURIComponent(orderAddress)}`;
    window.open(googleMapsUrl, '_blank');
  };

  // Función para buscar precio de delivery basado en dirección
  const searchDeliveryPrice = useCallback(async (address: string) => {
    if (!address.trim() || address.length < 5 || !order?.sede_id) {
      return;
    }

    try {
      setSearchingPrice(true);
      console.log('🔍 EditOrder: Buscando precio para dirección:', address);
      
      const lastPrice = await addressService.getLastDeliveryPriceForAddress(address, order.sede_id);
      
      if (lastPrice && lastPrice > 0) {
        console.log('✅ EditOrder: Precio encontrado:', lastPrice);
        setDeliveryCost(lastPrice);
        toast({
          title: "Precio encontrado",
          description: `Se estableció $${lastPrice.toLocaleString()} basado en entregas anteriores`,
        });
      } else {
        console.log('ℹ️ EditOrder: No se encontró precio previo para esta dirección');
      }
    } catch (error) {
      console.error('❌ EditOrder: Error buscando precio:', error);
    } finally {
      setSearchingPrice(false);
    }
  }, [order?.sede_id]);

  // Efecto para buscar precio cuando cambia la dirección (con debounce)
  useEffect(() => {
    if (newAddress) {
      const timeout = setTimeout(() => {
        searchDeliveryPrice(newAddress);
      }, 800);

      return () => clearTimeout(timeout);
    }
  }, [newAddress, searchDeliveryPrice]);

  // Cargar sede info y productos cuando se abre el modal
  useEffect(() => {
    const loadSedeInfo = async () => {
      if (!isOpen || !order) return;

      try {
        // Obtener la sede del dashboard order
        const { data: orderData, error } = await supabase
          .from('ordenes')
          .select('sede_id')
          .eq('id', order.orden_id)
          .single();

        if (!error && orderData?.sede_id) {
          setSedeId(orderData.sede_id);

          const sedeInfo = await sedeService.getSedeById(orderData.sede_id);
          if (sedeInfo) {
            setSedeAddress(sedeInfo.address);
          }

          // Cargar productos específicos de sede
          await loadSedeProducts(orderData.sede_id);
        }
      } catch (error) {
        console.error('Error loading sede info:', error);
      }
    };

    loadSedeInfo();
  }, [isOpen, order]);

  // Función para cargar productos específicos de sede
  const loadSedeProducts = async (sedeId: string) => {
    setLoadingSedeProducts(true);
    try {
      console.log('🏢 EditOrderModal: Cargando productos para sede:', sedeId);

      const { platos, bebidas, toppings } = await sedeService.getSedeCompleteInfo(sedeId, true);

      // Filtrar solo productos disponibles en la sede
      const availablePlatos = platos.filter(p => p.is_available);
      const availableBebidas = bebidas.filter(b => b.is_available);
      const availableToppings = toppings.filter(t => t.is_available);

      setSedeProducts({
        platos: availablePlatos,
        bebidas: availableBebidas,
        toppings: availableToppings
      });

      console.log('✅ EditOrderModal: Productos de sede cargados:', {
        platos: availablePlatos.length,
        bebidas: availableBebidas.length,
        toppings: availableToppings.length
      });
    } catch (error) {
      console.error('❌ EditOrderModal: Error cargando productos de sede:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los productos disponibles para esta sede.",
        variant: "destructive"
      });
    } finally {
      setLoadingSedeProducts(false);
    }
  };

  // Cargar datos reales de la orden al abrir
  useEffect(() => {
    const loadOrderItems = async () => {
      if (!isOpen || !order || !orderId) {
        // Limpiar historial cuando se cierra el modal
        if (!isOpen) {
          setSubstitutionHistory([]);
        }
        return;
      }

      try {
        setLoading(true);
        // Limpiar historial al cargar una nueva orden
        setSubstitutionHistory([]);
        // Cargar campos adicionales de orden (cubiertos, address, precio_envio)
        const { data: baseOrder, error: baseOrderErr } = await supabase
          .from('ordenes')
          .select('cubiertos, address, precio_envio')
          .eq('id', orderId)
          .single();
        if (!baseOrderErr && baseOrder) {
          setCutleryCount(typeof baseOrder.cubiertos === 'number' ? baseOrder.cubiertos : (baseOrder.cubiertos ? Number(baseOrder.cubiertos) : 0));
          setNewAddress(baseOrder.address || order.address || '');
          setDeliveryCost(typeof baseOrder.precio_envio === 'number' ? baseOrder.precio_envio : (baseOrder.precio_envio ? Number(baseOrder.precio_envio) : 0));
        }
        
        // Cargar platos de la orden
        const { data: platosData, error: platosError } = await supabase
          .from('ordenes_platos')
          .select(`
            id,
            plato_id,
            platos!plato_id(id, name, pricing)
          `)
          .eq('orden_id', orderId);

        if (platosError) {
          console.error('❌ Error obteniendo platos:', platosError);
        }

        // Cargar bebidas de la orden
        const { data: bebidasData, error: bebidasError } = await supabase
          .from('ordenes_bebidas')
          .select(`
            id,
            bebidas_id,
            bebidas!bebidas_id(id, name, pricing)
          `)
          .eq('orden_id', orderId);

        if (bebidasError) {
          console.error('❌ Error obteniendo bebidas:', bebidasError);
        }
        
        // Cargar toppings de la orden
        const { data: toppingsData, error: toppingsError } = await supabase
          .from('ordenes_toppings')
          .select(`
            id,
            topping_id,
            toppings!topping_id(id, name, pricing)
          `)
          .eq('orden_id', orderId);

        if (toppingsError) {
          console.error('❌ Error obteniendo toppings:', toppingsError);
        }
        
        // NUEVO: Mantener items individuales sin agrupar (para sustituciones específicas)
        const finalItems: OrderItem[] = [];

        // Procesar platos individualmente
        (platosData || []).forEach((item, index) => {
          if (item.platos) {
            finalItems.push({
              id: `plato_${item.id}_${index}`, // Usar ID único del registro
              tipo: 'plato',
              nombre: item.platos.name,
              cantidad: 1, // Siempre 1 para items individuales
              precio_unitario: item.platos.pricing || 0,
              precio_total: item.platos.pricing || 0,
              producto_id: item.platos.id,
              orden_item_id: item.id // ID específico del item en ordenes_platos
            });
          }
        });

        // Procesar bebidas individualmente
        (bebidasData || []).forEach((item, index) => {
          if (item.bebidas) {
            finalItems.push({
              id: `bebida_${item.id}_${index}`, // Usar ID único del registro
              tipo: 'bebida',
              nombre: item.bebidas.name,
              cantidad: 1, // Siempre 1 para items individuales
              precio_unitario: item.bebidas.pricing || 0,
              precio_total: item.bebidas.pricing || 0,
              producto_id: item.bebidas.id,
              orden_item_id: item.id // ID específico del item en ordenes_bebidas
            });
          }
        });

        // Procesar toppings individualmente
        (toppingsData || []).forEach((item, index) => {
          if (item.toppings) {
            finalItems.push({
              id: `topping_${item.id}_${index}`, // Usar ID único del registro
              tipo: 'topping',
              nombre: item.toppings.name,
              cantidad: 1, // Siempre 1 para items individuales
              precio_unitario: item.toppings.pricing || 0,
              precio_total: item.toppings.pricing || 0,
              producto_id: item.toppings.id,
              orden_item_id: item.id // ID específico del item en ordenes_toppings
            });
          }
        });
        console.log('🔍 EditOrderModal: Items procesados:', {
          platosData: platosData?.length || 0,
          bebidasData: bebidasData?.length || 0,
          toppingsData: toppingsData?.length || 0,
          finalItems: finalItems.length,
          itemsDetailed: finalItems
        });

        // Debug detallado para troubleshooting
        console.log('🔍 EditOrderModal: Raw data debug:', {
          platosRaw: platosData,
          bebidasRaw: bebidasData,
          toppingsRaw: toppingsData
        });

        // Verificar si hay datos y qué estructura tienen
        if (platosData && platosData.length > 0) {
          console.log('🍽️ EditOrderModal: Primer plato estructura:', platosData[0]);
        }
        if (bebidasData && bebidasData.length > 0) {
          console.log('🥤 EditOrderModal: Primera bebida estructura:', bebidasData[0]);
        }
        if (toppingsData && toppingsData.length > 0) {
          console.log('🧀 EditOrderModal: Primer topping estructura:', toppingsData[0]);
        }

        setItems(finalItems);
        if (!baseOrder) {
          setNewAddress(order.address || '');
          setDeliveryCost(order.precio_envio || 0);
        }
        
      } catch (error) {
        console.error('Error cargando items de la orden:', error);
        toast({
          title: "Error",
          description: "Error cargando los productos de la orden",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadOrderItems();
  }, [isOpen, order, orderId]);

  // Calcular total cuando cambian items o delivery cost
  useEffect(() => {
    const itemsTotal = items.reduce((sum, item) => sum + item.precio_total, 0);
    setTotalAmount(itemsTotal + deliveryCost);
  }, [items, deliveryCost]);

  const handleSaveChanges = async () => {
    if (!order || !orderId) return;

    try {
      setLoading(true);
      setError(null);

      // 1. Actualizar dirección del cliente y de la orden si cambió
      if (newAddress.trim() && newAddress !== order.address) {
        // Actualizar dirección del cliente para futuras órdenes
        const { error: clientError } = await supabase
          .from('clientes')
          .update({ direccion: newAddress })
          .eq('telefono', order.cliente_telefono);

        if (clientError) {
          console.error('Error actualizando dirección del cliente:', clientError);
          throw new Error('Error actualizando dirección del cliente');
        }

        // Actualizar dirección específica de esta orden
        const { error: orderAddressError } = await supabase
          .from('ordenes')
          .update({ address: newAddress })
          .eq('id', orderId);

        if (orderAddressError) {
          console.error('Error actualizando dirección de la orden:', orderAddressError);
          throw new Error('Error actualizando dirección de la orden');
        }
      }

      // 2. Actualizar precio de envío o cubiertos si cambiaron
      const updates: Record<string, any> = {};
      if (deliveryCost !== order.precio_envio) {
        updates.precio_envio = deliveryCost;
      }
      updates.cubiertos = cutleryCount; // siempre actualizar (puede ser 0)

      if (Object.keys(updates).length > 0) {
        const { error: orderError } = await supabase
          .from('ordenes')
          .update(updates)
          .eq('id', orderId);
        
        if (orderError) {
          console.error('Error actualizando orden (envío/cubiertos):', orderError);
          throw new Error('Error actualizando datos de la orden');
        }
      }

      // 3. Obtener payment_id de la orden y actualizar total de pago
      const { data: ordenData, error: ordenDataError } = await supabase
        .from('ordenes')
        .select('payment_id')
        .eq('id', orderId)
        .single();
      
      if (ordenDataError || !ordenData?.payment_id) {
        console.error('Error obteniendo payment_id:', ordenDataError);
        throw new Error('Error obteniendo información de pago');
      }

      const { error: paymentError } = await supabase
        .from('pagos')
        .update({ total_pago: totalAmount })
        .eq('id', ordenData.payment_id);
      
      if (paymentError) {
        console.error('Error actualizando total:', paymentError);
        throw new Error('Error actualizando total de pago');
      }

      // 4. Guardar historial de sustituciones ANTES de modificar items
      if (substitutionHistory.length > 0) {
        console.log('💾 Guardando historial de sustituciones:', substitutionHistory);

        const substitutionsToRecord = substitutionHistory.map(substitution => {
          const enrichedSub = substitution as any; // Acceso temporal a orden_item_id
          console.log('🔍 DEBUG: Preparando sustitución para guardar:', {
            substitution: substitution,
            enrichedSub_orden_item_id: enrichedSub.orden_item_id,
            type: substitution.type,
            original: substitution.original_name,
            substitute: substitution.substitute_name
          });

          return {
            itemType: 'plato' as const, // Se puede mejorar para determinar el tipo real
            itemId: 1, // Se puede mejorar para obtener el ID real del item
            ordenItemId: enrichedSub.orden_item_id, // Usar ID específico del item
            substitutionDetail: substitution
          };
        });

        const historySuccess = await substitutionHistoryService.recordMultipleSubstitutions(
          parseInt(orderId),
          substitutionsToRecord
        );

        if (historySuccess) {
          console.log('✅ Historial de sustituciones guardado exitosamente');
          // Limpiar el historial de la sesión después de guardarlo
          setSubstitutionHistory([]);
        } else {
          console.warn('⚠️ No se pudo guardar el historial de sustituciones, pero la orden se actualizó correctamente');
        }
      } else {
        console.log('ℹ️ No hay sustituciones para guardar en el historial');
      }

      // 5. SOLUCIÓN TEMPORAL: Solo recrear items si realmente cambiaron los productos base
      // (las sustituciones no requieren cambios en ordenes_platos)

      // Por ahora, saltarse la eliminación si solo hay sustituciones de toppings
      const hasProductSubstitutions = substitutionHistory.some(sub => sub.type === 'product_substitution');
      const hasOnlyToppingSubstitutions = substitutionHistory.length > 0 && !hasProductSubstitutions;

      if (hasOnlyToppingSubstitutions) {
        console.log('🔧 SOLUCIÓN TEMPORAL: Solo hay sustituciones de toppings, preservando IDs originales');
        console.log('ℹ️ Saltando eliminación/recreación de items para preservar orden_item_id');
      } else {
        console.log('⚠️ ADVERTENCIA: Eliminando y recreando items - esto rompe las referencias de orden_item_id');
        await Promise.all([
          supabase.from('ordenes_platos').delete().eq('orden_id', orderId),
          supabase.from('ordenes_bebidas').delete().eq('orden_id', orderId),
          supabase.from('ordenes_toppings').delete().eq('orden_id', orderId)
        ]);
      }

      // 6. Insertar los nuevos items (solo si se eliminaron los anteriores)
      if (!hasOnlyToppingSubstitutions) {
        const platos = items.filter(item => item.tipo === 'plato');
        const bebidas = items.filter(item => item.tipo === 'bebida');
        const toppings = items.filter(item => item.tipo === 'topping');

        // Insertar platos
        for (const plato of platos) {
          for (let i = 0; i < plato.cantidad; i++) {
            await supabase
              .from('ordenes_platos')
              .insert({ orden_id: orderId, plato_id: plato.producto_id });
          }
        }

        // Insertar bebidas
        for (const bebida of bebidas) {
          for (let i = 0; i < bebida.cantidad; i++) {
            await supabase
              .from('ordenes_bebidas')
              .insert({ orden_id: orderId, bebidas_id: bebida.producto_id });
          }
        }

        // Insertar toppings
        for (const topping of toppings) {
          for (let i = 0; i < topping.cantidad; i++) {
            await supabase
              .from('ordenes_toppings')
              .insert({ orden_id: orderId, topping_id: topping.producto_id });
          }
        }
      } else {
        console.log('ℹ️ Preservando items existentes - solo se guardaron sustituciones de toppings');
      }
      
      toast({
        title: "Orden actualizada",
        description: "Los cambios se han guardado correctamente",
      });

      onOrderUpdated();
      onClose();
      // Limpiar historial al cerrar exitosamente
      setSubstitutionHistory([]);
    } catch (error) {
      console.error('Error actualizando orden:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al actualizar la orden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Orden {order.id_display}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cliente</Label>
                  <Input value={order.cliente_nombre} disabled />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={order.cliente_telefono} disabled />
                </div>
              </div>
              
              <div>
                <Label>Dirección de Entrega (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Ingresa la nueva dirección"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={openGoogleMaps}
                    disabled={!newAddress.trim()}
                    title="Abrir en Google Maps para calcular ruta"
                  >
                    <Navigation className="h-4 w-4" />
                  </Button>
                  {searchingPrice && (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Costo de Envío</Label>
                <Input 
                  type="number"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

    {/* Cubiertos */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🍴 Cubiertos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">Cantidad de cubiertos enviados con el pedido</div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCutleryCount(c => Math.max(0, c - 1))}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center font-mono">{cutleryCount}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCutleryCount(c => c + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

          {/* Items de la orden */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Productos de la Orden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={`${item.tipo}-${item.orden_item_id || item.id}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.nombre}</div>
                      <div className="text-sm text-gray-600">
                        ${item.precio_unitario.toLocaleString()} c/u
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">
                          {item.tipo === 'plato' ? '🍽️ Plato' :
                           item.tipo === 'bebida' ? '🥤 Bebida' : '🧀 Topping'}
                        </Badge>
                        {/* Botón de toppings removido - consolidado en ProductSubstitutionDialog */}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuantityChange(item.id, item.cantidad - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <span className="mx-2 font-medium">{item.cantidad}</span>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuantityChange(item.id, item.cantidad + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>

                      {/* Solo mostrar botón de cambio para platos principales (que pueden tener toppings) */}
                      {item.tipo === 'plato' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenSubstitution(item)}
                          className="ml-2"
                          title="Cambiar producto o toppings"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveItem(item.id)}
                        className="ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="ml-4 text-right">
                      <div className="font-medium">
                        ${item.precio_total.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                
                {items.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay productos en esta orden
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agregar Platos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🍽️ Agregar Platos</CardTitle>
              {loadingSedeProducts && (
                <div className="text-sm text-gray-500">Cargando platos disponibles...</div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {sedeProducts.platos.map((plato) => (
                  <div key={plato.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{plato.name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      ${plato.pricing?.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => decrementSelected('plato', plato.id)}
                          disabled={loadingSedeProducts}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-mono">{getSelectedCount('plato', plato.id)}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => incrementSelected('plato', plato)}
                          disabled={loadingSedeProducts}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {sedeProducts.platos.length === 0 && !loadingSedeProducts && (
                  <div className="col-span-full text-center py-4 text-gray-500">
                    No hay platos disponibles para esta sede
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agregar Bebidas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🥤 Agregar Bebidas</CardTitle>
              {loadingSedeProducts && (
                <div className="text-sm text-gray-500">Cargando bebidas disponibles...</div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {sedeProducts.bebidas.map((bebida) => (
                  <div key={bebida.id} className="border rounded-lg p-3">
                    <div className="font-medium text-sm">{bebida.name}</div>
                    <div className="text-xs text-gray-600 mb-2">
                      ${bebida.pricing?.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => decrementSelected('bebida', bebida.id)}
                          disabled={loadingSedeProducts}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-mono">{getSelectedCount('bebida', bebida.id)}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => incrementSelected('bebida', bebida)}
                          disabled={loadingSedeProducts}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {sedeProducts.bebidas.length === 0 && !loadingSedeProducts && (
                  <div className="col-span-full text-center py-4 text-gray-500">
                    No hay bebidas disponibles para esta sede
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agregar Toppings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-orange-600">🧀 Agregar Toppings Extra</CardTitle>
              {loadingSedeProducts && (
                <div className="text-sm text-gray-500">Cargando toppings disponibles...</div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                {sedeProducts.toppings.map((topping) => (
                  <div key={topping.id} className="border border-orange-200 rounded-lg p-3">
                    <div className="font-medium text-sm">{topping.name}</div>
                    <div className="text-xs text-orange-600 mb-2">
                      ${topping.pricing?.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => decrementSelected('topping', topping.id)}
                          disabled={loadingSedeProducts}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-mono">{getSelectedCount('topping', topping.id)}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => incrementSelected('topping', topping)}
                          className="bg-orange-600 text-white hover:bg-orange-700"
                          disabled={loadingSedeProducts}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {sedeProducts.toppings.length === 0 && !loadingSedeProducts && (
                  <div className="col-span-full text-center py-4 text-gray-500">
                    No hay toppings disponibles para esta sede
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Total */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal productos:</span>
                  <span>${(totalAmount - deliveryCost).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Costo de envío:</span>
                  <span>${deliveryCost.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>${totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : (
                'Guardar Cambios'
              )}
            </Button>
          </div>
        </div>

        {/* Diálogo de sustitución de productos */}
        <ProductSubstitutionDialog
          isOpen={substitutionDialogOpen}
          onClose={() => {
            setSubstitutionDialogOpen(false);
            setSelectedItemForSubstitution(null);
          }}
          item={selectedItemForSubstitution}
          onSubstitutionApplied={handleSubstitutionApplied}
        />

        {/* REMOVIDO: PlatoToppingsDialog - consolidado en ProductSubstitutionDialog */}
      </DialogContent>
    </Dialog>
  );
};