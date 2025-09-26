import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Check, Loader2, Calculator } from 'lucide-react';
import { discountService, type DiscountRequest } from '@/services/discountService';
import { useAuth } from '@/hooks/useAuth';

// Tipos para la orden
interface Order {
  orden_id: number;
  id_display: string;
  cliente_nombre: string;
  total: number;
  estado: string;
  pago_estado: string;
  sede: string;
}

interface DiscountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onDiscountApplied: (orderId: number, discountAmount: number) => void;
}

export function DiscountDialog({
  isOpen,
  onClose,
  order,
  onDiscountApplied
}: DiscountDialogProps) {
  const { user } = useAuth();
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [discountComment, setDiscountComment] = useState<string>('');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setDiscountAmount('');
      setDiscountComment('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Validar entrada de descuento
  const validateInput = () => {
    const amount = parseFloat(discountAmount);

    if (!discountAmount || isNaN(amount) || amount <= 0) {
      setError('El monto del descuento debe ser mayor a 0');
      return false;
    }

    if (amount > (order?.total || 0)) {
      setError('El descuento no puede ser mayor al total de la orden');
      return false;
    }

    if (amount > 100000) {
      setError('El monto del descuento no puede exceder $100,000');
      return false;
    }

    if (!discountComment.trim()) {
      setError('El comentario es obligatorio para aplicar descuentos');
      return false;
    }

    if (discountComment.trim().length < 10) {
      setError('El comentario debe tener al menos 10 caracteres');
      return false;
    }

    if (discountComment.trim().length > 500) {
      setError('El comentario no puede exceder 500 caracteres');
      return false;
    }

    return true;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateInput()) {
      return;
    }

    // Aplicar descuento directamente sin modal de confirmación extra
    await applyDiscount();
  };

  // Aplicar descuento
  const applyDiscount = async () => {
    if (!order || !user) {
      setError('Información de usuario u orden no disponible');
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const request: DiscountRequest = {
        orderId: order.orden_id,
        discountAmount: parseFloat(discountAmount),
        discountComment: discountComment.trim(),
        userId: user.id,
        userRole: user.role,
        userSedeId: user.sede_id
      };

      await discountService.applyDiscount(request);

      setSuccess(true);
      onDiscountApplied(order.orden_id, parseFloat(discountAmount));

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('❌ Error aplicando descuento:', error);
      setError(error instanceof Error ? error.message : 'Error aplicando descuento');
    } finally {
      setIsApplying(false);
    }
  };

  // Formatear números
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Calcular nuevo total
  const calculateNewTotal = () => {
    const discount = parseFloat(discountAmount) || 0;
    const originalTotal = order?.total || 0;
    return Math.max(0, originalTotal - discount);
  };

  if (!order) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Aplicar Descuento
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600">¡Descuento Aplicado!</h3>
              <p className="text-sm text-gray-600">
                Descuento de {formatCurrency(parseFloat(discountAmount))} aplicado exitosamente
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Información de la orden */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Orden:</span>
                <Badge variant="outline">{order.id_display}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Cliente:</span>
                <span>{order.cliente_nombre}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Total actual:</span>
                <span className="font-bold">{formatCurrency(order.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Estado:</span>
                <Badge>{order.estado}</Badge>
              </div>
            </div>

            {/* Campos del descuento */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="discountAmount">
                  Monto del descuento *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    id="discountAmount"
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder="0"
                    className="pl-8"
                    min="0"
                    max={order.total}
                    step="1000"
                    required
                  />
                </div>
                {discountAmount && !isNaN(parseFloat(discountAmount)) && (
                  <p className="text-sm text-gray-600 mt-1">
                    Nuevo total: {formatCurrency(calculateNewTotal())}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="discountComment">
                  Motivo del descuento *
                </Label>
                <Textarea
                  id="discountComment"
                  value={discountComment}
                  onChange={(e) => setDiscountComment(e.target.value)}
                  placeholder="Explica el motivo del descuento (mínimo 10 caracteres)..."
                  rows={3}
                  maxLength={500}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  {discountComment.length}/500 caracteres
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!discountAmount || !discountComment.trim() || isApplying}>
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  'Aplicar Descuento'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

      </DialogContent>
    </Dialog>
  );
}