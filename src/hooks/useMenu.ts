import { useState, useEffect, useCallback } from 'react';
import { menuService } from '@/services/menuService';
import { 
  Plato, 
  Topping, 
  Bebida, 
  PlatoConToppings, 
  MenuResponse,
  CreatePlatoRequest,
  UpdatePlatoRequest,
  CreateBebidaRequest,
  UpdateBebidaRequest,
  CreateToppingRequest,
  UpdateToppingRequest
} from '@/types/menu';

interface UseMenuReturn {
  // Estado
  platos: PlatoConToppings[];
  bebidas: Bebida[];
  toppings: Topping[];
  loading: boolean;
  error: string | null;
  
  // Acciones
  loadMenu: () => Promise<void>;
  loadInventory: () => Promise<void>; // Nuevo método para inventario
  loadPlatos: () => Promise<void>;
  loadBebidas: () => Promise<void>;
  loadToppings: () => Promise<void>;
  
  // Operaciones CRUD para platos
  createPlato: (plato: CreatePlatoRequest) => Promise<void>;
  updatePlato: (id: number, plato: UpdatePlatoRequest) => Promise<void>;
  deletePlato: (id: number) => Promise<void>;
  
  // Operaciones CRUD para bebidas
  createBebida: (bebida: CreateBebidaRequest) => Promise<void>;
  updateBebida: (id: number, bebida: UpdateBebidaRequest) => Promise<void>;
  deleteBebida: (id: number) => Promise<void>;
  
  // Operaciones CRUD para toppings
  createTopping: (topping: CreateToppingRequest) => Promise<void>;
  updateTopping: (id: number, topping: UpdateToppingRequest) => Promise<void>;
  deleteTopping: (id: number) => Promise<void>;
  
  // Operaciones de toppings para platos
  assignToppingsToPlato: (platoId: number, toppingIds: number[]) => Promise<void>;
  removeToppingsFromPlato: (platoId: number, toppingIds: number[]) => Promise<void>;
  
  // Utilidades
  clearError: () => void;
}

export const useMenu = (): UseMenuReturn => {
  const [platos, setPlatos] = useState<PlatoConToppings[]>([]);
  const [bebidas, setBebidas] = useState<Bebida[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const menu = await menuService.getMenu();
      setPlatos(menu.platos);
      setBebidas(menu.bebidas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el menú');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inventory = await menuService.getInventory();
      setPlatos(inventory.platos);
      setBebidas(inventory.bebidas);
      setToppings(inventory.toppings || []); // Cargar toppings del inventario
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const platosData = await menuService.getPlatos();
      setPlatos(platosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los platos');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBebidas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bebidasData = await menuService.getBebidas();
      setBebidas(bebidasData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las bebidas');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadToppings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const toppingsData = await menuService.getToppings();
      setToppings(toppingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los toppings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Operaciones CRUD para platos
  const createPlato = useCallback(async (plato: CreatePlatoRequest) => {
    setLoading(true);
    setError(null);
    try {
      const newPlato = await menuService.createPlato(plato);
      setPlatos(prev => [...prev, newPlato]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el plato');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePlato = useCallback(async (id: number, plato: UpdatePlatoRequest) => {
    setLoading(true);
    setError(null);
    try {
      const updatedPlato = await menuService.updatePlato(id, plato);
      setPlatos(prev => prev.map(p => p.id === id ? updatedPlato : p));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el plato');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePlato = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await menuService.deletePlato(id);
      setPlatos(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el plato');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Operaciones CRUD para bebidas
  const createBebida = useCallback(async (bebida: CreateBebidaRequest) => {
    setLoading(true);
    setError(null);
    try {
      const newBebida = await menuService.createBebida(bebida);
      setBebidas(prev => [...prev, newBebida]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la bebida');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateBebida = useCallback(async (id: number, bebida: UpdateBebidaRequest) => {
    setLoading(true);
    setError(null);
    try {
      const updatedBebida = await menuService.updateBebida(id, bebida);
      setBebidas(prev => prev.map(b => b.id === id ? updatedBebida : b));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar la bebida');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteBebida = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await menuService.deleteBebida(id);
      setBebidas(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la bebida');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Operaciones CRUD para toppings
  const createTopping = useCallback(async (topping: CreateToppingRequest) => {
    setLoading(true);
    setError(null);
    try {
      const newTopping = await menuService.createTopping(topping);
      setToppings(prev => [...prev, newTopping]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el topping');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTopping = useCallback(async (id: number, topping: UpdateToppingRequest) => {
    setLoading(true);
    setError(null);
    try {
      const updatedTopping = await menuService.updateTopping(id, topping);
      setToppings(prev => prev.map(t => t.id === id ? updatedTopping : t));
      // También actualizar en los platos que usen este topping
      setPlatos(prev => prev.map(plato => ({
        ...plato,
        toppings: plato.toppings.map(t => t.id === id ? updatedTopping : t)
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el topping');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTopping = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await menuService.deleteTopping(id);
      setToppings(prev => prev.filter(t => t.id !== id));
      // También remover de los platos que usen este topping
      setPlatos(prev => prev.map(plato => ({
        ...plato,
        toppings: plato.toppings.filter(t => t.id !== id)
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el topping');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Operaciones de toppings para platos
  const assignToppingsToPlato = useCallback(async (platoId: number, toppingIds: number[]) => {
    setLoading(true);
    setError(null);
    try {
      await menuService.assignToppingsToPlato(platoId, toppingIds);
      // Recargar el plato para obtener los toppings actualizados
      const updatedPlato = await menuService.getPlato(platoId);
      setPlatos(prev => prev.map(p => p.id === platoId ? updatedPlato : p));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar toppings al plato');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeToppingsFromPlato = useCallback(async (platoId: number, toppingIds: number[]) => {
    setLoading(true);
    setError(null);
    try {
      await menuService.removeToppingsFromPlato(platoId, toppingIds);
      // Recargar el plato para obtener los toppings actualizados
      const updatedPlato = await menuService.getPlato(platoId);
      setPlatos(prev => prev.map(p => p.id === platoId ? updatedPlato : p));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al remover toppings del plato');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  return {
    // Estado
    platos,
    bebidas,
    toppings,
    loading,
    error,
    
    // Acciones
    loadMenu,
    loadInventory,
    loadPlatos,
    loadBebidas,
    loadToppings,
    
    // Operaciones CRUD para platos
    createPlato,
    updatePlato,
    deletePlato,
    
    // Operaciones CRUD para bebidas
    createBebida,
    updateBebida,
    deleteBebida,
    
    // Operaciones CRUD para toppings
    createTopping,
    updateTopping,
    deleteTopping,
    
    // Operaciones de toppings para platos
    assignToppingsToPlato,
    removeToppingsFromPlato,
    
    // Utilidades
    clearError,
  };
}; 