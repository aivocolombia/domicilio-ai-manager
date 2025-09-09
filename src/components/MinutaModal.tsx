import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Truck, Package, MapPin } from 'lucide-react';
import { minutaService, MinutaOrderDetails } from '@/services/minutaService';
import { logError } from '@/utils/logger';

interface MinutaModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: number;
}

export const MinutaModal: React.FC<MinutaModalProps> = ({
  isOpen,
  onClose,
  orderId
}) => {
  const [orderDetails, setOrderDetails] = useState<MinutaOrderDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderDetails();
    }
  }, [isOpen, orderId]);

  const loadOrderDetails = async () => {
    setLoading(true);
    try {
      const details = await minutaService.getOrderDetailsForMinuta(orderId);
      setOrderDetails(details);
    } catch (error) {
      logError('MinutaModal', 'Error cargando detalles de la orden', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !orderDetails) return;

    const printContent = generatePrintHTML(orderDetails);
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const generatePrintHTML = (details: MinutaOrderDetails): string => {
    const tipoPedidoLabel = {
      delivery: 'DOMICILIO',
      pickup: 'PARA LLEVAR',
      dine_in: 'EN SEDE'
    };

    const tipoPedidoIcon = {
      delivery: '🚚',
      pickup: '📦',
      dine_in: '🏪'
    };

    const fecha = new Date(details.created_at).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const hora = new Date(details.created_at).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Minuta #${details.minuta_id} - ${details.id_display}</title>
    <style>
        @media print {
            @page {
                size: 105mm 148mm;
                margin: 3mm;
            }
            body { -webkit-print-color-adjust: exact; }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            line-height: 1.2;
            color: #000;
            background: white;
            max-width: 105mm;
            margin: 0 auto;
            padding: 2mm;
        }
        
        .header {
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 1px solid #000;
            padding-bottom: 6px;
        }
        
        .title {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 3px;
        }
        
        .minuta-number {
            font-size: 16px;
            font-weight: bold;
            margin: 3px 0;
            padding: 4px 8px;
            border: 2px solid #000;
            display: inline-block;
        }
        
        .order-type {
            font-size: 10px;
            font-weight: bold;
            margin: 3px 0;
            padding: 2px 6px;
            background: #f0f0f0;
            border: 1px solid #000;
            display: inline-block;
        }
        
        .info-section {
            margin-bottom: 6px;
            padding: 3px;
            border: 1px solid #000;
        }
        
        .info-header {
            font-weight: bold;
            font-size: 9px;
            margin-bottom: 2px;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 1px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1px;
            font-size: 8px;
        }
        
        .products-table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        
        .products-table th,
        .products-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
        }
        
        .products-table th {
            background-color: #f0f0f0;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .products-table .qty {
            text-align: center;
            font-weight: bold;
        }
        
        .products-table .price {
            text-align: right;
        }
        
        .total-section {
            margin-top: 6px;
            padding: 4px;
            background-color: #f9f9f9;
            border: 1px solid #000;
            text-align: center;
        }
        
        .total-amount {
            font-size: 11px;
            font-weight: bold;
        }
        
        .observations {
            margin-top: 4px;
            padding: 3px;
            background-color: #fff9c4;
            border: 1px solid #000;
            font-size: 8px;
        }
        
        .footer {
            margin-top: 6px;
            text-align: center;
            font-size: 7px;
            color: #666;
            border-top: 1px solid #000;
            padding-top: 2px;
        }
        
        .delivery-info {
            background-color: #e8f5e8;
            border-left: 4px solid #4caf50;
        }
        
        .pickup-info {
            background-color: #fff3e0;
            border-left: 4px solid #ff9800;
        }
        
        .dine-in-info {
            background-color: #f3e5f5;
            border-left: 4px solid #9c27b0;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🍲 AJIACO RESTAURANTE</div>
        <div class="minuta-number">MINUTA #${details.minuta_id}</div>
        <div class="order-type">
            ${tipoPedidoIcon[details.tipo_pedido]} ${tipoPedidoLabel[details.tipo_pedido]}
        </div>
    </div>

    <!-- Información Básica -->
    <div class="info-section">
        <div class="info-header">📋 Información del Pedido</div>
        <div class="info-row">
            <span><strong>Orden:</strong></span>
            <span>${details.id_display}</span>
        </div>
        <div class="info-row">
            <span><strong>Fecha:</strong></span>
            <span>${fecha}</span>
        </div>
        <div class="info-row">
            <span><strong>Hora:</strong></span>
            <span>${hora}</span>
        </div>
        <div class="info-row">
            <span><strong>Estado:</strong></span>
            <span>${details.status}</span>
        </div>
    </div>

    <!-- Información del Cliente -->
    <div class="info-section">
        <div class="info-header">👤 Cliente</div>
        <div class="info-row">
            <span><strong>Nombre:</strong></span>
            <span>${details.cliente_nombre}</span>
        </div>
        <div class="info-row">
            <span><strong>Teléfono:</strong></span>
            <span>${details.cliente_telefono}</span>
        </div>
        ${details.tipo_pedido === 'delivery' && details.cliente_direccion ? `
        <div class="info-row">
            <span><strong>Dirección:</strong></span>
            <span>${details.cliente_direccion}</span>
        </div>
        ` : ''}
    </div>

    ${details.tipo_pedido === 'delivery' && details.repartidor_nombre ? `
    <!-- Información del Repartidor -->
    <div class="info-section delivery-info">
        <div class="info-header">🚚 Repartidor</div>
        <div class="info-row">
            <span><strong>Nombre:</strong></span>
            <span>${details.repartidor_nombre}</span>
        </div>
    </div>
    ` : ''}

    <!-- Productos -->
    <div class="info-section">
        <div class="info-header">🍽️ Productos</div>
        
        ${details.platos.length > 0 ? `
        <div style="margin: 5px 0;"><strong>Platos:</strong></div>
        ${details.platos.map(plato => `
        <div style="margin: 2px 0; padding: 2px;">• ${plato.plato_nombre}${plato.cantidad > 1 ? ` x${plato.cantidad}` : ''} - $${plato.precio_total.toLocaleString()}</div>
        `).join('')}
        ` : ''}
        
        ${details.bebidas.length > 0 ? `
        <div style="margin: 5px 0;"><strong>Bebidas:</strong></div>
        ${details.bebidas.map(bebida => `
        <div style="margin: 2px 0; padding: 2px;">• ${bebida.bebida_nombre}${bebida.cantidad > 1 ? ` x${bebida.cantidad}` : ''} - $${bebida.precio_total.toLocaleString()}</div>
        `).join('')}
        ` : ''}
    </div>

    <!-- Total y Pago -->
    <div class="total-section">
        <div style="margin-bottom: 6px;">
            <strong>Método de Pago: ${details.pago_tipo}</strong>
        </div>
        ${details.tipo_pedido === 'delivery' && details.precio_envio > 0 ? `
        <div style="margin-bottom: 4px; font-size: 9px; text-align: left;">
            Subtotal productos: $${(details.pago_total - details.precio_envio).toLocaleString()}<br>
            Envío: $${details.precio_envio.toLocaleString()}
        </div>
        ` : ''}
        <div class="total-amount">
            TOTAL: $${details.pago_total.toLocaleString()}
        </div>
    </div>

    ${details.observaciones ? `
    <!-- Observaciones -->
    <div class="observations">
        <div class="info-header" style="border: none; color: #f57f17;">💬 Observaciones</div>
        <p>${details.observaciones}</p>
    </div>
    ` : ''}

    <div class="footer">
        <p>Minuta generada el ${new Date().toLocaleString('es-CO')}</p>
        <p>📍 Restaurante Ajiaco - Sistema de Gestión de Pedidos</p>
    </div>
</body>
</html>`;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            Imprimir Minuta
            {orderDetails && (
              <span className="text-blue-600">#{orderDetails.minuta_id}</span>
            )}
          </DialogTitle>
          <DialogDescription>
            Vista previa e impresión de la minuta para el pedido seleccionado
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Cargando detalles de la orden...</div>
          </div>
        ) : orderDetails ? (
          <div className="space-y-4">
            {/* Preview de la minuta */}
            <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
              <div className="text-center space-y-2 mb-4">
                <h3 className="text-lg font-bold">🍲 AJIACO RESTAURANTE</h3>
                <div className="text-2xl font-bold border-2 border-black inline-block px-4 py-2">
                  MINUTA #{orderDetails.minuta_id}
                </div>
                <div className="flex items-center justify-center gap-2">
                  {orderDetails.tipo_pedido === 'delivery' && <Truck className="h-5 w-5" />}
                  {orderDetails.tipo_pedido === 'pickup' && <Package className="h-5 w-5" />}
                  {orderDetails.tipo_pedido === 'dine_in' && <MapPin className="h-5 w-5" />}
                  <span className="font-bold">
                    {orderDetails.tipo_pedido === 'delivery' && 'DOMICILIO'}
                    {orderDetails.tipo_pedido === 'pickup' && 'PARA LLEVAR'}
                    {orderDetails.tipo_pedido === 'dine_in' && 'EN SEDE'}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="border p-2 bg-white rounded">
                  <strong>📋 Información del Pedido</strong>
                  <div>Orden: {orderDetails.id_display}</div>
                  <div>Fecha: {new Date(orderDetails.created_at).toLocaleDateString('es-CO')}</div>
                  <div>Hora: {new Date(orderDetails.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                </div>

                <div className="border p-2 bg-white rounded">
                  <strong>👤 Cliente</strong>
                  <div>Nombre: {orderDetails.cliente_nombre}</div>
                  <div>Teléfono: {orderDetails.cliente_telefono}</div>
                  {orderDetails.tipo_pedido === 'delivery' && orderDetails.cliente_direccion && (
                    <div>Dirección: {orderDetails.cliente_direccion}</div>
                  )}
                </div>

                {orderDetails.tipo_pedido === 'delivery' && orderDetails.repartidor_nombre && (
                  <div className="border p-2 bg-green-50 rounded">
                    <strong>🚚 Repartidor</strong>
                    <div>Nombre: {orderDetails.repartidor_nombre}</div>
                  </div>
                )}

                <div className="border p-2 bg-white rounded">
                  <strong>🍽️ Productos</strong>
                  {orderDetails.platos.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium">Platos:</div>
                      {orderDetails.platos.map((plato, index) => (
                        <div key={index} className="ml-2">
                          • {plato.plato_nombre}{plato.cantidad > 1 ? ` x${plato.cantidad}` : ''} - ${plato.precio_total.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  )}
                  {orderDetails.bebidas.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium">Bebidas:</div>
                      {orderDetails.bebidas.map((bebida, index) => (
                        <div key={index} className="ml-2">
                          • {bebida.bebida_nombre}{bebida.cantidad > 1 ? ` x${bebida.cantidad}` : ''} - ${bebida.precio_total.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-2 border-black p-2 bg-gray-100 rounded text-center">
                  <strong>Método de Pago: {orderDetails.pago_tipo}</strong>
                  {orderDetails.tipo_pedido === 'delivery' && orderDetails.precio_envio > 0 && (
                    <div className="text-sm text-gray-700 mt-1 text-left">
                      Subtotal productos: ${(orderDetails.pago_total - orderDetails.precio_envio).toLocaleString()}
                      <br />
                      Envío: ${orderDetails.precio_envio.toLocaleString()}
                    </div>
                  )}
                  <div className="text-xl font-bold">TOTAL: ${orderDetails.pago_total.toLocaleString()}</div>
                </div>

                {orderDetails.observaciones && (
                  <div className="border p-2 bg-yellow-50 rounded">
                    <strong>💬 Observaciones</strong>
                    <div>{orderDetails.observaciones}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button onClick={handlePrint} className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Imprimir Minuta
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">No se pudieron cargar los detalles de la orden</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};