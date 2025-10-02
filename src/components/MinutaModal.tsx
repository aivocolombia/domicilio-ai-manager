import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Truck, Package, MapPin } from 'lucide-react';
import { minutaService, MinutaOrderDetails } from '@/services/minutaService';
import { substitutionHistoryService } from '@/services/substitutionHistoryService';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      loadOrderDetails();
    }
  }, [isOpen, orderId]);

  const loadOrderDetails = async () => {
    console.log('🔄 MinutaModal: INICIANDO loadOrderDetails para orden:', orderId);
    setLoading(true);
    setError(null);
    try {
      // Usar el mismo patrón que OrderDetailsModal
      const details = await minutaService.getOrderDetailsForMinuta(orderId);
      console.log('🔄 MinutaModal: minutaService.getOrderDetailsForMinuta completado:', !!details);
      if (details) {
        console.log('🖨️ MinutaModal: Detalles base cargados:', details);
        // MinutaService ya aplicó las sustituciones correctamente por orden_item_id
        console.log('✅ MinutaModal: Usando detalles con sustituciones ya aplicadas por MinutaService');
        setOrderDetails(details);
      } else {
        setError('No se encontraron detalles para esta orden');
      }
    } catch (error) {
      logError('MinutaModal', 'Error cargando detalles de la orden', error);
      setError(error instanceof Error ? error.message : 'Error desconocido cargando la minuta');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!orderDetails) return;
    
    // Abrir ventana de impresión inmediatamente
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = generatePrintHTML(orderDetails);
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    
    // Cambiar estado en segundo plano (sin bloquear impresión)
    minutaService.updateOrderStatusToCocina(orderId).then(statusChanged => {
      if (statusChanged) {
        console.log('📋 Estado cambiado automáticamente de "Recibidos" a "Cocina" al imprimir minuta');
      }
    }).catch(error => {
      console.error('Error cambiando estado al imprimir:', error);
    });
  };

  // Función para agrupar productos idénticos
  const groupIdenticalProducts = (products: any[]) => {
    const grouped: { [key: string]: any } = {};

    products.forEach(product => {
      // Crear una clave única basada en el nombre del producto y las sustituciones
      const substitutionsKey = product.substitutions
        ? product.substitutions.map((sub: any) => `${sub.original_name}->${sub.substitute_name}`).sort().join('|')
        : 'no_substitutions';

      const productKey = `${product.plato_nombre || product.bebida_nombre || product.topping_nombre}_${substitutionsKey}`;

      if (grouped[productKey]) {
        // Si ya existe, sumar cantidad y precio total
        grouped[productKey].cantidad += product.cantidad;
        grouped[productKey].precio_total += product.precio_total;
      } else {
        // Si es nuevo, crear entrada
        grouped[productKey] = { ...product };
      }
    });

    return Object.values(grouped);
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

    // Determinar el encabezado según el tipo de pedido
    const minutaTitle = details.tipo_pedido === 'delivery' ? 'DOMICILIO' : 'RECOGER';

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

    // Agrupar productos idénticos
    const groupedPlatos = groupIdenticalProducts(details.platos);
    const groupedBebidas = groupIdenticalProducts(details.bebidas);
    const groupedToppings = groupIdenticalProducts(details.toppings);

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
            background: white;
            border: 2px solid #000;
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

        .product-item {
            font-size: 11px;
            font-weight: bold;
            margin: 3px 0;
            padding: 3px;
            color: #000;
        }
        
        .products-table th {
            background-color: white;
            font-weight: bold;
            text-transform: uppercase;
            border: 2px solid #000;
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
            background-color: white;
            border: 3px solid #000;
            text-align: center;
        }
        
        .total-amount {
            font-size: 11px;
            font-weight: bold;
        }
        
        .observations {
            margin-top: 4px;
            padding: 3px;
            background-color: white;
            border: 2px dashed #000;
            font-size: 8px;
        }
        
        .footer {
            margin-top: 6px;
            text-align: center;
            font-size: 7px;
            color: #000;
            border-top: 1px solid #000;
            padding-top: 2px;
        }
        
        .delivery-info {
            background-color: white;
            border-left: 4px solid #000;
            border-style: solid;
        }

        .pickup-info {
            background-color: white;
            border-left: 4px double #000;
            border-style: double;
        }

        .dine-in-info {
            background-color: white;
            border-left: 4px dashed #000;
            border-style: dashed;
        }

        .substitution-info {
            font-size: 8px;
            margin-left: 10px;
            color: #000;
            font-weight: bold;
            padding: 1px 0;
            border-left: 2px solid #000;
            padding-left: 5px;
            margin-top: 2px;
            background-color: white;
            border: 1px solid #000;
        }

        .substitution-topping {
            color: #000;
            border-left: 3px solid #000;
            background-color: white;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">🍲 AJIACO RESTAURANTE</div>
        <div class="minuta-number">${minutaTitle} #${details.minuta_id}</div>
        <div style="font-size: 9px; margin: 3px 0; color: #333; text-align: center; font-weight: bold;">
            ${details.sede_direccion}
        </div>
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
      ${typeof details.cubiertos === 'number' ? `
      <div style="margin: 5px 0;"><strong>🍴 Cubiertos:</strong> ${details.cubiertos}</div>
      ` : ''}
        
        ${groupedPlatos.length > 0 ? `
        <div style="margin: 5px 0;"><strong>Platos:</strong></div>
        ${groupedPlatos.map(plato => {
          console.log(`🖨️ HTML: Renderizando ${plato.plato_nombre}, substitutions:`, plato.substitutions);
          let platoHTML = `<div class="product-item">• ${plato.plato_nombre}${plato.cantidad > 1 ? ` x${plato.cantidad}` : ''} - $${plato.precio_total.toLocaleString()}</div>`;

          if (plato.substitutions && plato.substitutions.length > 0) {
            console.log(`✅ HTML: ${plato.plato_nombre} tiene ${plato.substitutions.length} sustituciones`);
            platoHTML += plato.substitutions.map(sub =>
              `<div class="substitution-info ${sub.type === 'topping_substitution' ? 'substitution-topping' : ''}">
                 🔄 ${sub.type === 'topping_substitution' ? 'Topping' : 'Producto'}: ${sub.original_name} → ${sub.substitute_name}
               </div>`
            ).join('');
          }

          return platoHTML;
        }).join('')}
        ` : ''}

        ${groupedBebidas.length > 0 ? `
        <div style="margin: 5px 0;"><strong>Bebidas:</strong></div>
        ${groupedBebidas.map(bebida => `
        <div class="product-item">• ${bebida.bebida_nombre}${bebida.cantidad > 1 ? ` x${bebida.cantidad}` : ''} - $${bebida.precio_total.toLocaleString()}</div>
        ${bebida.substitutions ? bebida.substitutions.map(sub => `
        <div class="substitution-info">
          🔄 Producto: ${sub.original_name} → ${sub.substitute_name}
        </div>
        `).join('') : ''}
        `).join('')}
        ` : ''}

        ${groupedToppings.length > 0 ? `
        <div style="margin: 5px 0;"><strong>★ Toppings Extra:</strong></div>
        ${groupedToppings.map(topping => `
        <div class="product-item" style="color: #000; font-style: italic;">★ ${topping.topping_nombre}${topping.cantidad > 1 ? ` x${topping.cantidad}` : ''} - $${topping.precio_total.toLocaleString()}</div>
        ${topping.substitutions ? topping.substitutions.map(sub => `
        <div class="substitution-info substitution-topping">
          🔄 Topping: ${sub.original_name} → ${sub.substitute_name}
        </div>
        `).join('') : ''}
        `).join('')}
        ` : ''}
    </div>

    <!-- Total y Pago -->
    <div class="total-section">
        <div style="margin-bottom: 6px;">
            ${details.has_multiple_payments ? `
                <strong>Métodos de Pago:</strong><br>
                <span style="font-size: 10px;">
                  • ${details.pago_tipo}: $${(details.pago_monto1 || 0).toLocaleString()}<br>
                  • ${details.pago_tipo2}: $${(details.pago_monto2 || 0).toLocaleString()}
                </span>
            ` : `
                <strong>Método de Pago: ${details.pago_tipo}</strong>
            `}
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
        <div class="info-header" style="border: none; color: #000; font-weight: bold;">💬 OBSERVACIONES IMPORTANTES</div>
        <p style="font-weight: bold;">${details.observaciones}</p>
    </div>
    ` : ''}

    <div class="footer">
        <p>Minuta generada el ${new Date().toLocaleString('es-CO')}</p>
        <p>📍 Restaurante Ajiaco - Sistema de Gestión de Pedidos</p>
        <div style="text-align: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #000; font-size: 8px; display: flex; align-items: center; justify-content: center; gap: 2px;">
            <span>Powered by </span>
            <img src="https://hcyxhuvyqvtlvfsnrhjw.supabase.co/storage/v1/object/public/omnion/logo/logo_omnion_sin_fondo.png" alt="OMNION" style="height: 10px; width: auto; max-width: 30px;" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';" />
            <span style="font-weight: bold; background: #000; color: #fff; padding: 1px 3px; border-radius: 2px; display: none;">OMNION</span>
            <span style="font-weight: bold;">Omnion</span>
        </div>
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
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <div className="text-muted-foreground">Cargando detalles de la orden...</div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center space-y-3">
              <div className="text-red-600 font-medium">{error}</div>
              <Button onClick={loadOrderDetails} variant="outline">
                Reintentar
              </Button>
            </div>
          </div>
        ) : orderDetails ? (
          <div className="space-y-4">
            {/* Preview de la minuta */}
            <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
              <div className="text-center space-y-2 mb-4">
                <h3 className="text-lg font-bold">🍲 AJIACO RESTAURANTE</h3>
                <div className="text-2xl font-bold border-2 border-black inline-block px-4 py-2">
                  {orderDetails.tipo_pedido === 'delivery' ? 'DOMICILIO' : 'RECOGER'} #{orderDetails.minuta_id}
                </div>
                <div className="text-sm font-bold text-gray-800 mb-2">
                  {orderDetails.sede_direccion}
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
                  <div className="border-2 border-black p-2 bg-white rounded">
                    <strong>🚚 Repartidor</strong>
                    <div>Nombre: {orderDetails.repartidor_nombre}</div>
                  </div>
                )}

                <div className="border p-2 bg-white rounded">
                  <strong>🍽️ Productos</strong>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">🍴 Cubiertos:</span> {typeof orderDetails.cubiertos === 'number' ? orderDetails.cubiertos : 0}
                  </div>
                  {groupIdenticalProducts(orderDetails.platos).length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium">Platos:</div>
                      {groupIdenticalProducts(orderDetails.platos).map((plato, index) => (
                        <div key={index}>
                          <div className="ml-2 text-base font-bold text-black">
                            • {plato.plato_nombre}{plato.cantidad > 1 ? ` x${plato.cantidad}` : ''} - ${plato.precio_total.toLocaleString()}
                          </div>
                          {plato.substitutions && plato.substitutions.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {plato.substitutions.map((sub, subIdx) => (
                                <div
                                  key={subIdx}
                                  className={`text-xs font-bold px-2 py-1 rounded border-l-2 bg-white border-black text-black ${
                                    sub.type === 'topping_substitution' ? 'italic' : ''
                                  }`}
                                  style={{
                                    border: sub.type === 'topping_substitution' ? '2px solid #000' : '1px solid #000',
                                    backgroundColor: 'white'
                                  }}
                                >
                                  🔄 {sub.type === 'topping_substitution' ? 'Topping' : 'Producto'}: {sub.original_name} → {sub.substitute_name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {groupIdenticalProducts(orderDetails.bebidas).length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium">Bebidas:</div>
                      {groupIdenticalProducts(orderDetails.bebidas).map((bebida, index) => (
                        <div key={index}>
                          <div className="ml-2 text-base font-bold text-black">
                            • {bebida.bebida_nombre}{bebida.cantidad > 1 ? ` x${bebida.cantidad}` : ''} - ${bebida.precio_total.toLocaleString()}
                          </div>
                          {bebida.substitutions && bebida.substitutions.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {bebida.substitutions.map((sub, subIdx) => (
                                <div
                                  key={subIdx}
                                  className="text-xs font-bold px-2 py-1 rounded border-l-2 bg-white border-black text-black"
                                  style={{ border: '1px solid #000', backgroundColor: 'white' }}
                                >
                                  🔄 Producto: {sub.original_name} → {sub.substitute_name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {groupIdenticalProducts(orderDetails.toppings).length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium text-black">★ Toppings Extra:</div>
                      {groupIdenticalProducts(orderDetails.toppings).map((topping, index) => (
                        <div key={index}>
                          <div className="ml-2 text-base font-bold text-black italic">
                            ★ {topping.topping_nombre}{topping.cantidad > 1 ? ` x${topping.cantidad}` : ''} - ${topping.precio_total.toLocaleString()}
                          </div>
                          {topping.substitutions && topping.substitutions.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {topping.substitutions.map((sub, subIdx) => (
                                <div
                                  key={subIdx}
                                  className="text-xs font-bold px-2 py-1 rounded border-l-2 bg-white border-black text-black italic"
                                  style={{ border: '2px solid #000', backgroundColor: 'white' }}
                                >
                                  🔄 Topping: {sub.original_name} → {sub.substitute_name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-2 border-black p-2 bg-gray-100 rounded text-center">
                  {orderDetails.has_multiple_payments ? (
                    <div>
                      <strong>Métodos de Pago:</strong>
                      <div className="text-sm mt-1">
                        <div>• {orderDetails.pago_tipo}: ${(orderDetails.pago_monto1 || 0).toLocaleString()}</div>
                        <div>• {orderDetails.pago_tipo2}: ${(orderDetails.pago_monto2 || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ) : (
                    <strong>Método de Pago: {orderDetails.pago_tipo}</strong>
                  )}
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
                  <div className="border-2 border-dashed border-black p-2 bg-white rounded">
                    <strong>💬 OBSERVACIONES IMPORTANTES</strong>
                    <div className="font-bold">{orderDetails.observaciones}</div>
                  </div>
                )}

                {/* Omnion Branding Footer */}
                <div className="text-center mt-4 pt-2 border-t border-black print:border-black">
                  <div className="flex items-center justify-center gap-1 text-xs text-black print:text-black">
                    <span>Powered by</span>
                    <img
                      src="https://hcyxhuvyqvtlvfsnrhjw.supabase.co/storage/v1/object/public/omnion/logo/logo_omnion_sin_fondo.png"
                      alt="Omnion"
                      className="h-3 w-auto print:h-3 print:opacity-100"
                      style={{ printColorAdjust: 'exact' }}
                      onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                    <span className="font-semibold">Omnion</span>
                  </div>
                </div>
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