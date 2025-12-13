import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, FileText, AlertCircle } from 'lucide-react';
import { ClienteSelector } from './ClienteSelector';
import { FacturacionSelector } from './FacturacionSelector';
import { CreateFacturacionModal } from './CreateFacturacionModal';
import { clienteService, Cliente, ClienteFacturacion, PendingFacturacion, facturacionCache } from '@/services/clienteService';
import { toast } from '@/hooks/use-toast';

interface FacturacionElectronicaProps {
  isOpen: boolean;
  onClose: () => void;
  ordenItems: Array<{
    type: 'plato' | 'bebida' | 'topping';
    id: number;
    quantity: number;
  }>;
  sedeId: string;
  observaciones?: string;
  descuentoValor?: number;
  descuentoComentario?: string;
  onSuccess?: () => void; // Cambiado: ya no recibe response, solo notifica éxito
}

export const FacturacionElectronica: React.FC<FacturacionElectronicaProps> = ({
  isOpen,
  onClose,
  ordenItems,
  sedeId,
  observaciones,
  descuentoValor,
  descuentoComentario,
  onSuccess
}) => {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [facturaciones, setFacturaciones] = useState<ClienteFacturacion[]>([]);
  const [facturacionSeleccionada, setFacturacionSeleccionada] = useState<ClienteFacturacion | null>(null);
  const [isLoadingFacturaciones, setIsLoadingFacturaciones] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateFacturacion, setShowCreateFacturacion] = useState(false);
  const [pendingFacturacion, setPendingFacturacion] = useState<PendingFacturacion | null>(null);

  // Cargar facturación pendiente de caché al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const cached = facturacionCache.get();
      if (cached && cached.sede_id === sedeId) {
        setPendingFacturacion(cached);
        // Cargar cliente si está en caché
        if (cached.cliente_id) {
          clienteService.getClienteById(parseInt(cached.cliente_id))
            .then(setCliente)
            .catch(console.error);
        }
      } else {
        setPendingFacturacion(null);
      }
    }
  }, [isOpen, sedeId]);

  // Cargar facturaciones cuando se selecciona un cliente
  useEffect(() => {
    const cargarFacturaciones = async () => {
      if (!cliente?.id) {
        setFacturaciones([]);
        setFacturacionSeleccionada(null);
        return;
      }

      setIsLoadingFacturaciones(true);
      setError(null);
      try {
        const data = await clienteService.getFacturacionesByClienteId(cliente.id);
        setFacturaciones(data);
        
        if (data.length === 0) {
          setError('El cliente seleccionado no tiene registros de facturación activos');
        } else {
          // Si hay facturación pendiente en caché, seleccionar esa
          if (pendingFacturacion && pendingFacturacion.facturacion_id) {
            const cachedFact = data.find(f => f.id === pendingFacturacion.facturacion_id);
            if (cachedFact) {
              setFacturacionSeleccionada(cachedFact);
            }
          } else {
            // Seleccionar el default si existe
            const defaultFact = data.find(f => f.es_default);
            if (defaultFact) {
              setFacturacionSeleccionada(defaultFact);
            } else if (data.length === 1) {
              setFacturacionSeleccionada(data[0]);
            } else {
              setFacturacionSeleccionada(null);
            }
          }
        }
      } catch (err) {
        console.error('Error al cargar facturaciones:', err);
        let errorMessage = 'Error al cargar facturaciones';
        
        if (err instanceof Error) {
          if (err.message.includes('relation') && err.message.includes('does not exist')) {
            errorMessage = 'La tabla de facturación no existe en la base de datos. Por favor, verifica la configuración.';
          } else if (err.message.includes('permission denied') || err.message.includes('RLS')) {
            errorMessage = 'No tienes permisos para acceder a los registros de facturación.';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        setFacturaciones([]);
      } finally {
        setIsLoadingFacturaciones(false);
      }
    };

    cargarFacturaciones();
  }, [cliente, pendingFacturacion]);

  // Resetear cuando se cierra el modal (pero NO limpiar caché)
  useEffect(() => {
    if (!isOpen) {
      setCliente(null);
      setFacturaciones([]);
      setFacturacionSeleccionada(null);
      setError(null);
      setShowCreateFacturacion(false);
      // NO resetear pendingFacturacion aquí, se mantiene en caché
    }
  }, [isOpen]);

  const handleFacturacionCreated = async (newFacturacion: ClienteFacturacion) => {
    if (cliente?.id) {
      try {
        const data = await clienteService.getFacturacionesByClienteId(cliente.id);
        setFacturaciones(data);
        setFacturacionSeleccionada(newFacturacion);
        setError(null);
      } catch (err) {
        console.error('Error al recargar facturaciones:', err);
      }
    }
  };

  const handleGuardarFacturacion = () => {
    if (!cliente || !facturacionSeleccionada || !sedeId) {
      setError('Debe seleccionar cliente, facturación y sede');
      return;
    }

    if (ordenItems.length === 0) {
      setError('La orden debe tener al menos un item');
      return;
    }

    // Guardar en caché (NO crear orden ni factura aún)
    const pending: PendingFacturacion = {
      cliente_id: cliente.id.toString(),
      sede_id: sedeId,
      facturacion_id: facturacionSeleccionada.id,
      cliente_nombre: cliente.nombre,
      facturacion_nombre: facturacionSeleccionada.nombre_razon_social,
      platos: ordenItems
        .filter(item => item.type === 'plato')
        .map(item => ({
          plato_id: item.id,
          cantidad: item.quantity
        })),
      bebidas: ordenItems
        .filter(item => item.type === 'bebida')
        .map(item => ({
          bebida_id: item.id,
          cantidad: item.quantity
        })),
      toppings: ordenItems
        .filter(item => item.type === 'topping')
        .map(item => ({
          topping_id: item.id,
          cantidad: item.quantity
        })),
      observaciones: observaciones || undefined,
      descuento_valor: descuentoValor ? Math.round(descuentoValor * 100) : undefined,
      descuento_comentario: descuentoComentario || undefined
    };

    facturacionCache.save(pending);
    setPendingFacturacion(pending);

    toast({
      title: "Facturación guardada",
      description: "La información de facturación se guardó correctamente. Se creará la factura al crear el pedido.",
    });

    if (onSuccess) {
      onSuccess();
    }

    // Cerrar el modal después de guardar
    onClose();
  };


  const canSave = cliente && facturacionSeleccionada && sedeId && ordenItems.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Facturación Electrónica</DialogTitle>
          <DialogDescription>
            Selecciona el cliente y su registro de facturación. La factura se creará automáticamente al crear el pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Selector de Cliente */}
          <ClienteSelector
            cliente={cliente}
            onClienteChange={setCliente}
          />

          {/* Selector de Facturación */}
          {cliente && (
            <div>
              {isLoadingFacturaciones ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Cargando facturaciones...</span>
                </div>
              ) : (
                <FacturacionSelector
                  facturaciones={facturaciones}
                  seleccionada={facturacionSeleccionada}
                  onSeleccionar={setFacturacionSeleccionada}
                  onCreateNew={cliente ? () => setShowCreateFacturacion(true) : undefined}
                />
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleGuardarFacturacion}
              disabled={!canSave}
            >
              <FileText className="h-4 w-4 mr-2" />
              Guardar Facturación
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Modal para crear nueva facturación */}
      {cliente && (
        <CreateFacturacionModal
          isOpen={showCreateFacturacion}
          onClose={() => setShowCreateFacturacion(false)}
          cliente={cliente}
          onFacturacionCreated={handleFacturacionCreated}
        />
      )}
    </Dialog>
  );
};
