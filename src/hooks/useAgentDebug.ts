import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

export const useAgentDebug = () => {
  const { profile, loading } = useAuth();
  const renderCount = useRef(0);
  const loadingHistory = useRef<boolean[]>([]);
  
  // Incrementar contador de renders
  renderCount.current += 1;
  
  // Mantener historial de estados de loading
  useEffect(() => {
    loadingHistory.current.push(loading);
    // Mantener solo los últimos 10 estados
    if (loadingHistory.current.length > 10) {
      loadingHistory.current = loadingHistory.current.slice(-10);
    }
  }, [loading]);

  // Debug para agentes
  useEffect(() => {
    if (profile?.role === 'agent' && process.env.NODE_ENV === 'development') {
      console.group('🔍 DEBUG AGENTE - Estado actual');
      console.log('👤 Perfil:', {
        name: profile?.name,
        email: profile?.email,
        sede_id: profile?.sede_id,
        sede_name: profile?.sede_name,
        role: profile?.role
      });
      console.log('⏳ Loading:', loading);
      console.log('🔄 Renders totales:', renderCount.current);
      console.log('📊 Historial loading:', loadingHistory.current);
      
      // Detectar posibles bucles
      const recentLoading = loadingHistory.current.slice(-5);
      const hasLoop = recentLoading.length >= 5 && 
                     recentLoading.every((state, index, arr) => 
                       index === 0 || state === arr[index - 1]
                     );
      
      if (hasLoop) {
        console.warn('⚠️ POSIBLE BUCLE DETECTADO - Loading no cambia en los últimos 5 renders');
      }
      
      if (renderCount.current > 20) {
        console.warn('⚠️ MUCHOS RENDERS - El componente se ha renderizado', renderCount.current, 'veces');
      }
      
      console.groupEnd();
    }
  }, [profile, loading]);

  return {
    renderCount: renderCount.current,
    loadingHistory: loadingHistory.current,
    isAgent: profile?.role === 'agent',
    debugInfo: {
      sede_id: profile?.sede_id,
      sede_name: profile?.sede_name,
      loading,
      renderCount: renderCount.current
    }
  };
};