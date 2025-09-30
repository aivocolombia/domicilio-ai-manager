import { useState, useCallback } from 'react';
import { substitutionService, type AvailableSubstitution, type SubstitutionResult } from '@/services/substitutionService';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook personalizado para manejar sustituciones de productos
 */
export const useSubstitutions = () => {
  const [loading, setLoading] = useState(false);
  const [availableSubstitutions, setAvailableSubstitutions] = useState<AvailableSubstitution[]>([]);
  const { toast } = useToast();

  /**
   * Obtiene las sustituciones disponibles para un producto
   */
  const getSubstitutions = useCallback(async (
    productId: number,
    productType: 'plato' | 'bebida' | 'topping'
  ) => {
    setLoading(true);
    try {
      const substitutions = await substitutionService.getAvailableSubstitutions(productId, productType);
      setAvailableSubstitutions(substitutions);
      return substitutions;
    } catch (error) {
      console.error('Error obteniendo sustituciones:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las sustituciones disponibles",
        variant: "destructive"
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Verifica si una sustitución es válida
   */
  const checkSubstitution = useCallback(async (
    originalId: number,
    originalType: 'plato' | 'bebida' | 'topping',
    substituteId: number,
    substituteType: 'plato' | 'bebida' | 'topping'
  ) => {
    try {
      return await substitutionService.canSubstitute(originalId, originalType, substituteId, substituteType);
    } catch (error) {
      console.error('Error verificando sustitución:', error);
      return { canSubstitute: false };
    }
  }, []);

  /**
   * Prepara los datos para aplicar una sustitución
   */
  const prepareSubstitution = useCallback(async (
    originalItem: any,
    substituteId: number,
    substituteType: 'plato' | 'bebida' | 'topping'
  ): Promise<SubstitutionResult> => {
    setLoading(true);
    try {
      const result = await substitutionService.prepareSubstitution(originalItem, substituteId, substituteType);

      if (result.success) {
        toast({
          title: "Sustitución aplicada",
          description: result.message,
        });
      } else {
        toast({
          title: "Error en sustitución",
          description: result.message,
          variant: "destructive"
        });
      }

      return result;
    } catch (error) {
      const errorMessage = 'Error aplicando sustitución';
      console.error(errorMessage, error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      return {
        success: false,
        message: errorMessage
      };
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Busca productos para sustitución
   */
  const searchProducts = useCallback(async (
    query: string,
    productType?: 'plato' | 'bebida' | 'topping'
  ) => {
    if (query.length < 2) return [];

    try {
      return await substitutionService.searchProducts(query, productType);
    } catch (error) {
      console.error('Error buscando productos:', error);
      return [];
    }
  }, []);

  /**
   * Limpia las sustituciones disponibles
   */
  const clearSubstitutions = useCallback(() => {
    setAvailableSubstitutions([]);
  }, []);

  /**
   * Calcula el cambio de precio total para una sustitución
   */
  const calculatePriceChange = useCallback((
    priceDifference: number,
    quantity: number
  ) => {
    return priceDifference * quantity;
  }, []);

  /**
   * Formatea la diferencia de precio para mostrar
   */
  const formatPriceDifference = useCallback((priceDifference: number) => {
    if (priceDifference === 0) return 'Mismo precio';
    if (priceDifference > 0) return `+$${priceDifference.toLocaleString()}`;
    return `-$${Math.abs(priceDifference).toLocaleString()}`;
  }, []);

  /**
   * Obtiene el texto descriptivo de una sustitución
   */
  const getSubstitutionDescription = useCallback((substitution: AvailableSubstitution) => {
    const priceText = formatPriceDifference(substitution.price_difference);
    const directionText = substitution.is_bidirectional ? '↔' : '→';
    return `${directionText} ${substitution.substitute_name} (${priceText})`;
  }, [formatPriceDifference]);

  return {
    // Estado
    loading,
    availableSubstitutions,

    // Funciones principales
    getSubstitutions,
    checkSubstitution,
    prepareSubstitution,
    searchProducts,
    clearSubstitutions,

    // Utilidades
    calculatePriceChange,
    formatPriceDifference,
    getSubstitutionDescription,
  };
};