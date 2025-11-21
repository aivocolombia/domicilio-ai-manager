import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, AlertTriangle } from "lucide-react";
import { orderTypeService } from '@/services/orderTypeService';
import { toast } from '@/hooks/use-toast';
import { logInfo, logError } from '@/utils/logger';

interface ChangeOrderTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    orden_id: number;
    id_display: string;
    estado: string;
    type_order: string;
    repartidor?: string;
  };
  onSuccess: () => void;
}

export function ChangeOrderTypeDialog({
  open,
  onOpenChange,
  order,
  onSuccess
}: ChangeOrderTypeDialogProps) {
  const [isChanging, setIsChanging] = useState(false);

  const currentType = order.type_order || 'delivery';
  const newType = currentType === 'delivery' ? 'pickup' : 'delivery';

  // Verificar si se puede cambiar
  const canChange = orderTypeService.canChangeOrderType(order.estado);

  const handleConfirm = async () => {
    setIsChanging(true);

    try {
      logInfo('ChangeOrderTypeDialog', 'Iniciando cambio de tipo', {
        ordenId: order.orden_id,
        currentType,
        newType
      });

      const result = await orderTypeService.changeOrderType({
        ordenId: order.orden_id,
        newType,
        currentStatus: order.estado,
        currentType
      });

      if (result.success) {
        toast({
          title: "Tipo de orden actualizado",
          description: result.message,
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: "No se pudo cambiar el tipo",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      logError('ChangeOrderTypeDialog', 'Error al cambiar tipo de orden', error);
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado al cambiar el tipo de orden",
        variant: "destructive",
      });
    } finally {
      setIsChanging(false);
    }
  };

  const getTypeInfo = (type: string) => {
    if (type === 'delivery') {
      return {
        label: 'Domicilio',
        icon: <Truck className="h-4 w-4" />,
        color: 'bg-blue-500',
        description: 'El pedido será entregado por un repartidor'
      };
    } else {
      return {
        label: 'Recogida',
        icon: <Package className="h-4 w-4" />,
        color: 'bg-green-500',
        description: 'El cliente recogerá el pedido en la sede'
      };
    }
  };

  const currentInfo = getTypeInfo(currentType);
  const newInfo = getTypeInfo(newType);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            Cambiar Tipo de Orden
            <Badge variant="outline">{order.id_display}</Badge>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {!canChange ? (
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold">No se puede cambiar el tipo de orden</p>
                    <p className="mt-1">
                      El pedido está en estado <span className="font-medium">"{order.estado}"</span>.
                      Solo se puede cambiar cuando está en <span className="font-medium">"Recibidos"</span> o <span className="font-medium">"Cocina"</span>.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {/* Tipo actual */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className={`p-2 rounded-md ${currentInfo.color} text-white`}>
                          {currentInfo.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Tipo actual</p>
                          <p className="text-sm text-gray-600">{currentInfo.label}</p>
                        </div>
                      </div>
                    </div>

                    {/* Flecha */}
                    <div className="flex justify-center">
                      <div className="text-2xl text-gray-400">↓</div>
                    </div>

                    {/* Nuevo tipo */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div className={`p-2 rounded-md ${newInfo.color} text-white`}>
                          {newInfo.icon}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Nuevo tipo</p>
                          <p className="text-sm text-gray-600">{newInfo.label}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advertencias específicas */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm text-blue-900">
                      {newType === 'pickup' ? (
                        <>
                          {order.repartidor && (
                            <span className="block mb-2">
                              <strong>Nota:</strong> El repartidor "{order.repartidor}" será desasignado automáticamente.
                            </span>
                          )}
                          El cliente recogerá el pedido en la sede.
                        </>
                      ) : (
                        <>
                          El pedido será entregado a domicilio. Podrás asignar un repartidor después de confirmar.
                        </>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isChanging}>
            Cancelar
          </AlertDialogCancel>
          {canChange && (
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isChanging}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isChanging ? 'Cambiando...' : `Cambiar a ${newInfo.label}`}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
