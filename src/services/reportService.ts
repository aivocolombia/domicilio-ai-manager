import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { metricsService, MetricsFilters } from './metricsService';
import { discountService } from './discountService';
import { supabase } from '@/lib/supabase';

export interface ReportData {
  // Analisis de tiempos por fases
  timeMetrics: {
    avgReciboACocina: number;
    avgCocinaACamino: number;
    avgCaminoAEntrega: number;
    avgTotalPromedio: number;
  };

  // Analisis de cancelaciones
  cancellationMetrics: {
    totalCancelados: number;
    tasaCancelacion: number;
    montoPerdido: number;
    causales: Array<{ motivo: string; cantidad: number; porcentaje: number }>;
  };

  // Analisis de descuentos
  discountMetrics: {
    totalDescuentos: number;
    montoTotalDescuentos: number;
    causales: Array<{ razon: string; cantidad: number; monto: number }>;
  };

  // Analisis de ventas
  salesMetrics: {
    volumenVenta: Array<{ producto: string; cantidad: number; valor: number }>;
    totalVentas: number;
    totalIngresos: number;
  };

  // Informacion de sedes
  sedesMetrics: Array<{
    nombre: string;
    totalPedidos: number;
    totalIngresos: number;
    cancelados: number;
    tasaCancelacion: number;
    avgTiempoEntrega: number;
  }>;

  // Informacion de agentes call center
  agentMetrics: Array<{
    nombre: string;
    totalOrdenes: number;
    sede: string;
  }>;

  // Informacion de repartidores
  deliveryPerformance: {
    resumen: {
      totalRepartidores: number;
      mejorRepartidor: string;
      promedioEntregas: number;
      promedioExito: number;
    };
    repartidores: Array<{
      id: number;
      nombre: string;
      totalAsignados: number;
      totalEntregados: number;
      totalCancelados: number;
      porcentajeExito: number;
      promedioTiempoEntrega: number;
      diasTrabajados: number;
      montoTotalEntregado: number;
    }>;
  };

  // Informacion general del reporte
  reportInfo: {
    fechaInicio: string;
    fechaFin: string;
    fechaGeneracion: string;
  };
}

export class ReportService {
  /**
   * Recopila todos los datos necesarios para el reporte
   */
  async collectReportData(filters: MetricsFilters): Promise<ReportData> {
    // Obtener todas las metricas en paralelo
    const [
      phaseStats,
      cancelledMetrics,
      discountMetrics,
      productMetrics,
      sedeMetrics,
      dashboardMetrics,
      deliveryPerformanceRaw,
    ] = await Promise.all([
      metricsService.getPhaseTimeStats(filters),
      metricsService.getCancelledOrderMetrics(filters),
      discountService.getDiscountMetrics(filters.sede_id, filters.fecha_inicio, filters.fecha_fin),
      metricsService.getProductMetrics(filters),
      metricsService.getSedeMetrics(filters),
      metricsService.getDashboardMetrics(filters),
      metricsService.getDeliveryPersonPerformance(filters),
    ]);

    // Obtener causales de cancelacion
    const cancellationCausals = await this.getCancellationCausals(filters);

    // Obtener metricas de agentes (usuarios que crearon ordenes)
    const agentMetrics = await this.getAgentMetrics(filters);

    // Construir objeto de reporte
    const reportData: ReportData = {
      timeMetrics: {
        avgReciboACocina: phaseStats.avg_recibidos_a_cocina || 0,
        avgCocinaACamino: phaseStats.avg_cocina_a_camino || 0,
        avgCaminoAEntrega: phaseStats.avg_camino_a_fin || 0,
        avgTotalPromedio: phaseStats.avg_total_desde_recibidos || 0,
      },

      cancellationMetrics: {
        totalCancelados: cancelledMetrics.total,
        tasaCancelacion: cancelledMetrics.porcentaje,
        montoPerdido: cancelledMetrics.montoTotal,
        causales: cancellationCausals,
      },

      discountMetrics: {
        totalDescuentos: discountMetrics.totalDiscounts,
        montoTotalDescuentos: discountMetrics.totalDiscountAmount,
        causales: Object.entries(discountMetrics.discountsByStatus || {}).map(([razon, cantidad]) => ({
          razon,
          cantidad,
          monto: 0
        }))
      },

      salesMetrics: {
        volumenVenta: productMetrics.map(p => ({
          producto: p.producto_nombre,
          cantidad: p.total_vendido,
          valor: p.total_ingresos,
        })),
        totalVentas: dashboardMetrics.totalGeneral.pedidos,
        totalIngresos: dashboardMetrics.totalGeneral.ingresos,
      },

      sedesMetrics: sedeMetrics.map(s => ({
        nombre: s.sede_nombre,
        totalPedidos: s.total_pedidos,
        totalIngresos: s.total_ingresos,
        cancelados: cancelledMetrics.porSede.find(ps => ps.sede_id === s.sede_id)?.cancelados || 0,
        tasaCancelacion: cancelledMetrics.porSede.find(ps => ps.sede_id === s.sede_id)?.porcentaje || 0,
        avgTiempoEntrega: 0, // Se calculara despues
      })),

      agentMetrics,

      deliveryPerformance: {
        resumen: {
          totalRepartidores: deliveryPerformanceRaw.resumen.total_repartidores,
          mejorRepartidor: deliveryPerformanceRaw.resumen.mejor_repartidor,
          promedioEntregas: deliveryPerformanceRaw.resumen.promedio_entregas,
          promedioExito: deliveryPerformanceRaw.resumen.promedio_exito,
        },
        repartidores: (deliveryPerformanceRaw.repartidores || []).map(r => ({
          id: r.repartidor_id,
          nombre: r.repartidor_nombre,
          totalAsignados: r.total_asignados,
          totalEntregados: r.total_entregados,
          totalCancelados: r.total_cancelados,
          porcentajeExito: r.porcentaje_exito,
          promedioTiempoEntrega: r.promedio_tiempo_entrega,
          diasTrabajados: r.dias_trabajados,
          montoTotalEntregado: r.monto_total_entregado,
        })),
      },

      reportInfo: {
        fechaInicio: filters.fecha_inicio,
        fechaFin: filters.fecha_fin,
        fechaGeneracion: new Date().toLocaleDateString('es-CO'),
      },
    };

    return reportData;
  }

  /**
   * Obtiene causales de cancelacion con sus conteos
   */
  private async getCancellationCausals(filters: MetricsFilters): Promise<Array<{ motivo: string; cantidad: number; porcentaje: number }>> {
    const { data, error } = await supabase
      .from('ordenes')
      .select('motivo_cancelacion')
      .eq('status', 'Cancelado')
      .gte('created_at', `${filters.fecha_inicio}T00:00:00`)
      .lte('created_at', `${filters.fecha_fin}T23:59:59`);

    if (error || !data) return [];

    // Contar por motivo
    const motivoCounts = new Map<string, number>();
    let total = 0;

    data.forEach(order => {
      const motivo = order.motivo_cancelacion || 'Sin especificar';
      motivoCounts.set(motivo, (motivoCounts.get(motivo) || 0) + 1);
      total++;
    });

    // Convertir a array y calcular porcentajes
    return Array.from(motivoCounts.entries())
      .map(([motivo, cantidad]) => ({
        motivo,
        cantidad,
        porcentaje: total > 0 ? (cantidad / total) * 100 : 0,
      }))
      .sort((a, b) => b.cantidad - a.cantidad);
  }

  /**
   * Obtiene metricas de agentes call center
   */
  private async getAgentMetrics(filters: MetricsFilters): Promise<Array<{ nombre: string; totalOrdenes: number; sede: string }>> {
    // Por ahora retornamos array vacio ya que no tenemos tracking de que usuario creo cada orden
    // Esto se puede implementar agregando un campo created_by en la tabla ordenes
    return [];
  }

  /**
   * Genera reporte en formato Excel
   */
  async generateExcelReport(filters: MetricsFilters): Promise<Blob> {
    const reportData = await this.collectReportData(filters);

    // Crear workbook
    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen General
    const summaryData = [
      ['REPORTE DE METRICAS GLOBALES'],
      [''],
      ['Periodo del Reporte'],
      ['Fecha Inicio:', reportData.reportInfo.fechaInicio],
      ['Fecha Fin:', reportData.reportInfo.fechaFin],
      ['Fecha de Generacion:', reportData.reportInfo.fechaGeneracion],
      [''],
      ['RESUMEN GENERAL'],
      ['Total de Ventas:', reportData.salesMetrics.totalVentas],
      ['Total Ingresos:', `$${reportData.salesMetrics.totalIngresos.toLocaleString()}`],
      ['Total Cancelados:', reportData.cancellationMetrics.totalCancelados],
      ['Tasa de Cancelacion:', `${reportData.cancellationMetrics.tasaCancelacion.toFixed(2)}%`],
      ['Monto Perdido por Cancelaciones:', `$${reportData.cancellationMetrics.montoPerdido.toLocaleString()}`],
      ['Total Descuentos Aplicados:', reportData.discountMetrics.totalDescuentos],
      ['Monto Total Descuentos:', `$${reportData.discountMetrics.montoTotalDescuentos.toLocaleString()}`],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

    // Hoja 2: Analisis de Tiempos
    const timeData = [
      ['ANALISIS DE TIEMPOS POR ETAPAS (Minutos)'],
      [''],
      ['Etapa', 'Tiempo Promedio (min)'],
      ['Recibo > Cocina', reportData.timeMetrics.avgReciboACocina.toFixed(2)],
      ['Cocina > Camino', reportData.timeMetrics.avgCocinaACamino.toFixed(2)],
      ['Camino > Entrega', reportData.timeMetrics.avgCaminoAEntrega.toFixed(2)],
      ['Total Promedio', reportData.timeMetrics.avgTotalPromedio.toFixed(2)],
    ];
    const wsTime = XLSX.utils.aoa_to_sheet(timeData);
    XLSX.utils.book_append_sheet(wb, wsTime, 'Analisis de Tiempos');

    // Hoja 3: Analisis de Cancelaciones
    const cancellationData = [
      ['ANALISIS DE CANCELACIONES'],
      [''],
      ['Total Cancelados:', reportData.cancellationMetrics.totalCancelados],
      ['Tasa de Cancelacion:', `${reportData.cancellationMetrics.tasaCancelacion.toFixed(2)}%`],
      ['Monto Perdido:', `$${reportData.cancellationMetrics.montoPerdido.toLocaleString()}`],
      [''],
      ['CAUSALES DE CANCELACION'],
      ['Motivo', 'Cantidad', 'Porcentaje'],
      ...reportData.cancellationMetrics.causales.map(c => [
        c.motivo,
        c.cantidad,
        `${c.porcentaje.toFixed(2)}%`
      ]),
    ];
    const wsCancellation = XLSX.utils.aoa_to_sheet(cancellationData);
    XLSX.utils.book_append_sheet(wb, wsCancellation, 'Cancelaciones');

    // Hoja 4: Analisis de Descuentos
    const discountData = [
      ['ANALISIS DE DESCUENTOS'],
      [''],
      ['Total Descuentos:', reportData.discountMetrics.totalDescuentos],
      ['Monto Total:', `$${reportData.discountMetrics.montoTotalDescuentos.toLocaleString()}`],
      [''],
      ['CAUSALES DE DESCUENTOS'],
      ['Razon', 'Cantidad', 'Monto Total'],
      ...reportData.discountMetrics.causales.map(d => [
        d.razon,
        d.cantidad,
        `$${d.monto.toLocaleString()}`
      ]),
    ];
    const wsDiscount = XLSX.utils.aoa_to_sheet(discountData);
    XLSX.utils.book_append_sheet(wb, wsDiscount, 'Descuentos');

    // Hoja 5: Analisis de Ventas por Producto
    const salesData = [
      ['ANALISIS DE VENTAS POR PRODUCTO'],
      [''],
      ['Producto', 'Cantidad Vendida', 'Valor Total'],
      ...reportData.salesMetrics.volumenVenta.map(v => [
        v.producto,
        v.cantidad,
        `$${v.valor.toLocaleString()}`
      ]),
      [''],
      ['TOTAL GENERAL', reportData.salesMetrics.totalVentas, `$${reportData.salesMetrics.totalIngresos.toLocaleString()}`],
    ];
    const wsSales = XLSX.utils.aoa_to_sheet(salesData);
    XLSX.utils.book_append_sheet(wb, wsSales, 'Ventas por Producto');

    // Hoja 6: Metricas por Sede
    const sedeData = [
      ['METRICAS POR SEDE'],
      [''],
      ['Sede', 'Total Pedidos', 'Total Ingresos', 'Cancelados', 'Tasa Cancelacion'],
      ...reportData.sedesMetrics.map(s => [
        s.nombre,
        s.totalPedidos,
        `$${s.totalIngresos.toLocaleString()}`,
        s.cancelados,
        `${s.tasaCancelacion.toFixed(2)}%`
      ]),
    ];
    const wsSede = XLSX.utils.aoa_to_sheet(sedeData);
    XLSX.utils.book_append_sheet(wb, wsSede, 'Metricas por Sede');

    // Generar archivo Excel
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /**
   * Genera reporte en formato PDF con diseno profesional
   */
  async generatePDFReport(filters: MetricsFilters): Promise<Blob> {
    const reportData = await this.collectReportData(filters);

    // Crear documento PDF
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let yPosition = 20;

    // Colores corporativos
    const primaryColor: [number, number, number] = [59, 130, 246]; // blue-500
    const secondaryColor: [number, number, number] = [139, 92, 246]; // violet-500
    const successColor: [number, number, number] = [34, 197, 94]; // green-500
    const dangerColor: [number, number, number] = [239, 68, 68]; // red-500
    const warningColor: [number, number, number] = [249, 115, 22]; // orange-500

    // Funcion para agregar encabezado
    const addHeader = (title: string) => {
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${reportData.reportInfo.fechaInicio} - ${reportData.reportInfo.fechaFin}`, pageWidth / 2, 30, { align: 'center' });

      yPosition = 50;
    };

    // Funcion para agregar seccion
    const addSection = (title: string, color: [number, number, number] = primaryColor) => {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFillColor(...color);
      doc.rect(10, yPosition, pageWidth - 20, 10, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 15, yPosition + 7);

      yPosition += 15;
      doc.setTextColor(0, 0, 0);
    };

    // Funcion para agregar tarjeta de metrica
    const addMetricCard = (label: string, value: string, color: [number, number, number], x: number, width: number) => {
      doc.setFillColor(248, 250, 252); // bg-slate-50
      doc.roundedRect(x, yPosition, width, 20, 3, 3, 'F');

      doc.setDrawColor(...color);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, yPosition, width, 20, 3, 3, 'S');

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // text-slate-500
      doc.text(label, x + 5, yPosition + 7);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(value, x + 5, yPosition + 16);
      doc.setFont('helvetica', 'normal');
    };

    // PAGINA 1: RESUMEN EJECUTIVO
    addHeader('REPORTE DE METRICAS GLOBALES');

    // Tarjetas de metricas principales
    addSection('Resumen Ejecutivo', primaryColor);

    const cardWidth = (pageWidth - 40) / 3;
    addMetricCard(
      'Total Ventas',
      reportData.salesMetrics.totalVentas.toString(),
      successColor,
      10,
      cardWidth
    );
    addMetricCard(
      'Ingresos Totales',
      `$${reportData.salesMetrics.totalIngresos.toLocaleString('es-CO')}`,
      primaryColor,
      10 + cardWidth + 5,
      cardWidth
    );
    addMetricCard(
      'Tasa Cancelacion',
      `${reportData.cancellationMetrics.tasaCancelacion.toFixed(1)}%`,
      dangerColor,
      10 + (cardWidth + 5) * 2,
      cardWidth
    );

    yPosition += 25;

    // Segunda fila de metricas
    addMetricCard(
      'Pedidos Cancelados',
      reportData.cancellationMetrics.totalCancelados.toString(),
      dangerColor,
      10,
      cardWidth
    );
    addMetricCard(
      'Monto Perdido',
      `$${reportData.cancellationMetrics.montoPerdido.toLocaleString('es-CO')}`,
      warningColor,
      10 + cardWidth + 5,
      cardWidth
    );
    addMetricCard(
      'Monto Descuentos',
      `$${reportData.discountMetrics.montoTotalDescuentos.toLocaleString('es-CO')}`,
      warningColor,
      10 + (cardWidth + 5) * 2,
      cardWidth
    );

    yPosition += 30;

    // Analisis de Tiempos
    addSection('Analisis de Tiempos por Etapa', secondaryColor);

    autoTable(doc, {
      startY: yPosition,
      head: [['Etapa', 'Tiempo Promedio (min)']],
      body: [
        ['Recibo > Cocina', reportData.timeMetrics.avgReciboACocina.toFixed(2)],
        ['Cocina > Camino', reportData.timeMetrics.avgCocinaACamino.toFixed(2)],
        ['Camino > Entrega', reportData.timeMetrics.avgCaminoAEntrega.toFixed(2)],
        ['Total Promedio', reportData.timeMetrics.avgTotalPromedio.toFixed(2)],
      ],
      theme: 'striped',
      headStyles: { fillColor: secondaryColor },
      margin: { left: 10, right: 10 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // PAGINA 2: ANALISIS DETALLADO
    doc.addPage();
    yPosition = 20;

    addSection('Analisis de Cancelaciones', dangerColor);

    autoTable(doc, {
      startY: yPosition,
      head: [['Motivo', 'Cantidad', 'Porcentaje']],
      body: reportData.cancellationMetrics.causales.map(c => [
        c.motivo,
        c.cantidad.toString(),
        `${c.porcentaje.toFixed(1)}%`
      ]),
      theme: 'striped',
      headStyles: { fillColor: dangerColor },
      margin: { left: 10, right: 10 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    addSection('Analisis de Descuentos', warningColor);

    autoTable(doc, {
      startY: yPosition,
      head: [['Razon', 'Cantidad', 'Monto Total']],
      body: reportData.discountMetrics.causales.slice(0, 10).map(d => [
        d.razon,
        d.cantidad.toString(),
        `$${d.monto.toLocaleString()}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: warningColor },
      margin: { left: 10, right: 10 },
    });

    // PAGINA 3: VENTAS Y SEDES
    doc.addPage();
    yPosition = 20;

    addSection('Top 10 Productos Mas Vendidos', successColor);

    autoTable(doc, {
      startY: yPosition,
      head: [['Producto', 'Cantidad', 'Valor Total']],
      body: reportData.salesMetrics.volumenVenta.slice(0, 10).map(v => [
        v.producto,
        v.cantidad.toString(),
        `$${v.valor.toLocaleString()}`
      ]),
      theme: 'striped',
      headStyles: { fillColor: successColor },
      margin: { left: 10, right: 10 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;

    addSection('Comparativa por Sede', primaryColor);

    autoTable(doc, {
      startY: yPosition,
      head: [['Sede', 'Pedidos', 'Ingresos', 'Cancelados', '% Cancel.']],
      body: reportData.sedesMetrics.map(s => [
        s.nombre,
        s.totalPedidos.toString(),
        `$${s.totalIngresos.toLocaleString('es-CO')}`,
        s.cancelados.toString(),
        `${s.tasaCancelacion.toFixed(1)}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: primaryColor },
      margin: { left: 10, right: 10 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });

    // PAGINA 4: DESEMPENO DE REPARTIDORES
    doc.addPage();
    yPosition = 20;

    addSection('Desempeno de Repartidores', secondaryColor);

    const courierCardWidth = (pageWidth - 40) / 3;
    addMetricCard(
      'Total Repartidores',
      reportData.deliveryPerformance.resumen.totalRepartidores.toString(),
      primaryColor,
      10,
      courierCardWidth
    );
    addMetricCard(
      'Promedio Entregas',
      reportData.deliveryPerformance.resumen.promedioEntregas.toFixed(1),
      successColor,
      10 + courierCardWidth + 5,
      courierCardWidth
    );
    addMetricCard(
      'Promedio Exito',
      reportData.deliveryPerformance.resumen.promedioExito.toFixed(1) + '%',
      successColor,
      10 + (courierCardWidth + 5) * 2,
      courierCardWidth
    );

    yPosition += 25;

    addMetricCard(
      'Mejor Repartidor',
      reportData.deliveryPerformance.resumen.mejorRepartidor || 'N/D',
      secondaryColor,
      10,
      pageWidth - 20
    );

    yPosition += 30;

    addSection('Ranking por Desempeno', primaryColor);

    const topCouriers = reportData.deliveryPerformance.repartidores.slice(0, 10);
    if (topCouriers.length > 0) {
      autoTable(doc, {
        startY: yPosition,
        head: [['Repartidor', 'Asignados', 'Entregados', 'Cancelados', '% Exito', 'Tiempo Prom.', 'Dias', 'Monto']],
        body: topCouriers.map(r => [
          r.nombre,
          r.totalAsignados.toString(),
          r.totalEntregados.toString(),
          r.totalCancelados.toString(),
          r.porcentajeExito.toFixed(1) + '%',
          r.promedioTiempoEntrega > 0 ? r.promedioTiempoEntrega.toFixed(1) + ' min' : 'N/D',
          r.diasTrabajados.toString(),
          '$' + r.montoTotalEntregado.toLocaleString('es-CO')
        ]),
        theme: 'striped',
        headStyles: { fillColor: primaryColor },
        margin: { left: 10, right: 10 },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
        },
      });
      yPosition = (doc as any).lastAutoTable.finalY + 10;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('No hay datos de repartidores para el periodo seleccionado.', 12, yPosition + 5);
      doc.setTextColor(0, 0, 0);
      yPosition += 12;
    }

    // Pie de pagina con fecha de generacion
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Generado: ${reportData.reportInfo.fechaGeneracion} | Pagina ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Generar blob del PDF
    return doc.output('blob');
  }

  /**
   * Descarga el reporte Excel
   */
  async downloadExcelReport(filters: MetricsFilters, filename?: string): Promise<void> {
    const blob = await this.generateExcelReport(filters);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `reporte-metricas-${filters.fecha_inicio}-${filters.fecha_fin}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Descarga el reporte PDF
   */
  async downloadPDFReport(filters: MetricsFilters, filename?: string): Promise<void> {
    const blob = await this.generatePDFReport(filters);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `reporte-metricas-${filters.fecha_inicio}-${filters.fecha_fin}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const reportService = new ReportService();
