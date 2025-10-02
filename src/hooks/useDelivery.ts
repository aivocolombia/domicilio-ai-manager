import { useState, useEffect, useCallback } from 'react';
import { deliveryService, Repartidor, RepartidorConEstadisticas } from '@/services/deliveryService';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRealtime } from '@/hooks/useRealtime';

export const useDelivery = (sedeId?: string, filterDate?: Date) => {
  const { profile } = useAuth();

  // Usar la sede pasada como parámetro o la del profile
  const effectiveSedeId = sedeId || profile?.sede_id;
  const [repartidores, setRepartidores] = useState<RepartidorConEstadisticas[]>([]);
  const [totalOrdenesAsignadas, setTotalOrdenesAsignadas] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar repartidores
    const loadRepartidores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Cargando repartidores para sede:', effectiveSedeId);

      // Solo cargar si hay sede asignada
      if (!effectiveSedeId) {
        console.log('⚠️ No hay sede seleccionada, no se cargan repartidores');
        setRepartidores([]);
        setTotalOrdenesAsignadas(0);
        setLoading(false);
        return;
      }

      // Primero ejecutar prueba de datos
      await deliveryService.testData();

      const [data, totalAsignadas] = await Promise.all([
        deliveryService.getRepartidoresConEstadisticas(effectiveSedeId, filterDate),
        deliveryService.getTotalOrdenesAsignadasPendientes(effectiveSedeId)
      ]);
      
      setRepartidores(data);
      setTotalOrdenesAsignadas(totalAsignadas);
      
      console.log('✅ Repartidores cargados exitosamente:', data.length);
      console.log('📊 Datos de repartidores:', data);
      console.log('✅ Total órdenes asignadas pendientes:', totalAsignadas);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar repartidores';
      console.error('❌ Error al cargar repartidores:', err);
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveSedeId, filterDate]);

  // Crear nuevo repartidor
  const crearRepartidor = useCallback(async (repartidorData: {
    nombre: string;
    telefono: string;
    placas?: string;
    disponible?: boolean;
  }) => {
    try {
      if (!effectiveSedeId) {
        throw new Error('No se puede crear repartidor sin sede seleccionada');
      }

      console.log('➕ Hook: Creando repartidor para sede:', effectiveSedeId, repartidorData);
      
      const nuevoRepartidor = await deliveryService.crearRepartidor({
        nombre: repartidorData.nombre,
        telefono: repartidorData.telefono,
        placas: repartidorData.placas || null,
        disponible: repartidorData.disponible ?? true,
        sede_id: effectiveSedeId
      });

      // Recargar la lista de repartidores
      await loadRepartidores();

      toast({
        title: "Repartidor creado",
        description: `${repartidorData.nombre} ha sido agregado correctamente.`,
      });

      return nuevoRepartidor;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear repartidor';
      console.error('❌ Error al crear repartidor:', err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [loadRepartidores, profile?.sede_id]);

  // Actualizar repartidor
  const actualizarRepartidor = useCallback(async (id: number, updates: Partial<Repartidor>) => {
    try {
      console.log('🔄 Actualizando repartidor:', { id, updates });
      
      const repartidorActualizado = await deliveryService.actualizarRepartidor(id, updates);
      
      // Actualizar el estado local
      setRepartidores(prev => 
        prev.map(rep => 
          rep.id === id 
            ? { ...rep, ...repartidorActualizado }
            : rep
        )
      );

      toast({
        title: "Repartidor actualizado",
        description: "Los datos del repartidor han sido actualizados correctamente.",
      });

      return repartidorActualizado;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar repartidor';
      console.error('❌ Error al actualizar repartidor:', err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, []);

  // Cambiar disponibilidad
  const cambiarDisponibilidad = useCallback(async (id: number, disponible: boolean) => {
    try {
      console.log('🔄 Cambiando disponibilidad:', { id, disponible });
      
      const repartidorActualizado = await deliveryService.cambiarDisponibilidad(id, disponible);
      
      // Actualizar el estado local
      setRepartidores(prev => 
        prev.map(rep => 
          rep.id === id 
            ? { ...rep, disponible: repartidorActualizado.disponible }
            : rep
        )
      );

      const repartidor = repartidores.find(r => r.id === id);
      toast({
        title: "Estado actualizado",
        description: `${repartidor?.nombre || 'Repartidor'} ${disponible ? 'activado' : 'desactivado'} correctamente.`,
      });

      return repartidorActualizado;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cambiar disponibilidad';
      console.error('❌ Error al cambiar disponibilidad:', err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [repartidores]);

  // Eliminar repartidor
  const eliminarRepartidor = useCallback(async (id: number) => {
    try {
      console.log('🗑️ Eliminando repartidor:', id);
      
      await deliveryService.eliminarRepartidor(id);
      
      // Actualizar el estado local
      setRepartidores(prev => prev.filter(rep => rep.id !== id));

      const repartidor = repartidores.find(r => r.id === id);
      toast({
        title: "Repartidor eliminado",
        description: `${repartidor?.nombre || 'Repartidor'} ha sido eliminado correctamente.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar repartidor';
      console.error('❌ Error al eliminar repartidor:', err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    }
  }, [repartidores]);

  // Limpiar error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cargar repartidores al montar el componente
  useEffect(() => {
    console.log('🚀 useDelivery: Iniciando carga de repartidores...');
    loadRepartidores();
  }, [loadRepartidores]);

  // Real-time para cambios en repartidores
  useRealtime({
    table: 'repartidores',
    enabled: !!effectiveSedeId,
    onPayload: (payload) => {
      console.log('🔔 Repartidor actualizado:', payload);
      // Recargar datos cuando hay cambios en repartidores
      loadRepartidores();
    },
    onError: (error) => {
      console.error('❌ Error en realtime de repartidores:', error);
    }
  });

  // Real-time para cambios en órdenes que afectan estadísticas de repartidores
  useRealtime({
    table: 'ordenes',
    enabled: !!effectiveSedeId,
    onPayload: (payload) => {
      console.log('🔔 Orden actualizada (afecta repartidores):', payload);
      // Solo recargar si el cambio afecta las estadísticas
      if (payload.eventType === 'UPDATE' && 
          (payload.old?.repartidor_id !== payload.new?.repartidor_id || 
           payload.old?.status !== payload.new?.status)) {
        console.log('📊 Recargando estadísticas de repartidores por cambio de asignación/estado');
        loadRepartidores();
      }
    },
    onError: (error) => {
      console.error('❌ Error en realtime de órdenes para repartidores:', error);
    }
  });

  // Función para refrescar con nueva fecha
  const refreshWithDate = useCallback(async (newDate: Date) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Refrescando repartidores con nueva fecha:', newDate);

      if (!effectiveSedeId) {
        console.log('⚠️ No hay sede seleccionada');
        setRepartidores([]);
        setTotalOrdenesAsignadas(0);
        setLoading(false);
        return;
      }

      const [data, totalAsignadas] = await Promise.all([
        deliveryService.getRepartidoresConEstadisticas(effectiveSedeId, newDate),
        deliveryService.getTotalOrdenesAsignadasPendientes(effectiveSedeId)
      ]);

      setRepartidores(data);
      setTotalOrdenesAsignadas(totalAsignadas);

      console.log('✅ Repartidores actualizados con nueva fecha:', data.length);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al refrescar con nueva fecha';
      console.error('❌ Error al refrescar con nueva fecha:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [effectiveSedeId]);

  return {
    repartidores,
    totalOrdenesAsignadas,
    loading,
    error,
    loadRepartidores,
    crearRepartidor,
    actualizarRepartidor,
    cambiarDisponibilidad,
    clearError,
    refreshWithDate
  };
}; 