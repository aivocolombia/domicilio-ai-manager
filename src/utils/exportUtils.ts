// Imports dinámicos para reducir bundle inicial (~900KB)
// Las librerías se cargan solo cuando se necesitan exportar
const loadXLSX = () => import('xlsx');
const loadJsPDF = () => import('jspdf');
const loadHtml2Canvas = () => import('html2canvas');
const loadFileSaver = () => import('file-saver');

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  title?: string;
  subtitle?: string;
}

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  format?: (value: any) => string;
}

export interface PDFSection {
  title: string;
  content?: string | string[];
  type?: 'text' | 'table' | 'chart' | 'summary';
  columns?: TableColumn[];
  calculate?: (data: any[]) => Record<string, any>;
}

// Exportar tabla a Excel (con import dinámico)
export const exportToExcel = async (data: any[], columns: TableColumn[], options: ExportOptions) => {
  try {
    // Cargar librerías bajo demanda
    const [XLSX, { saveAs }] = await Promise.all([
      loadXLSX(),
      loadFileSaver()
    ]);

    // Crear encabezados
    const headers = columns.map(col => col.header);

    // Mapear datos según las columnas especificadas
    const formattedData = data.map(row =>
      columns.map(col => {
        const value = row[col.key];
        return col.format ? col.format(value) : value || '';
      })
    );

    // Crear worksheet
    const wsData = [headers, ...formattedData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Aplicar anchos de columna si están especificados
    if (columns.some(col => col.width)) {
      const colWidths = columns.map(col => ({
        wch: col.width || 15
      }));
      ws['!cols'] = colWidths;
    }

    // Aplicar estilo a los encabezados
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;

      ws[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'E3F2FD' } },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    }

    // Crear workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, options.sheetName || 'Datos');

    // Agregar metadatos
    wb.Props = {
      Title: options.title || options.filename,
      Subject: 'Reporte generado automáticamente',
      Author: 'Sistema Domicilio AI Manager',
      CreatedDate: new Date()
    };

    // Generar archivo
    const excelBuffer = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'array',
      compression: true
    });

    // Descargar archivo
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const filename = options.filename.endsWith('.xlsx')
      ? options.filename
      : `${options.filename}.xlsx`;

    saveAs(blob, filename);

    return true;
  } catch (error) {
    console.error('❌ Error exportando a Excel:', error);
    throw new Error('Error al generar archivo Excel');
  }
};

// Exportar tabla a CSV (con import dinámico)
export const exportToCSV = async (data: any[], columns: TableColumn[], options: ExportOptions) => {
  try {
    // Cargar file-saver bajo demanda
    const { saveAs } = await loadFileSaver();

    // Crear encabezados
    const headers = columns.map(col => col.header);

    // Mapear datos
    const csvData = [
      headers,
      ...data.map(row =>
        columns.map(col => {
          const value = row[col.key];
          const formatted = col.format ? col.format(value) : value || '';
          // Escapar comillas y comas
          return typeof formatted === 'string' && (formatted.includes(',') || formatted.includes('"'))
            ? `"${formatted.replace(/"/g, '""')}"`
            : formatted;
        })
      )
    ];

    // Convertir a CSV
    const csvContent = csvData.map(row => row.join(',')).join('\n');

    // Crear blob con BOM para soporte de caracteres especiales
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], {
      type: 'text/csv;charset=utf-8;'
    });

    const filename = options.filename.endsWith('.csv')
      ? options.filename
      : `${options.filename}.csv`;

    saveAs(blob, filename);

    return true;
  } catch (error) {
    console.error('❌ Error exportando a CSV:', error);
    throw new Error('Error al generar archivo CSV');
  }
};

// Generar PDF con texto y tablas (con import dinámico)
export const exportToPDF = async (
  sections: PDFSection[],
  options: ExportOptions,
  chartElement?: HTMLElement,
  data: any[] = []
) => {
  try {
    // Cargar librerías bajo demanda
    const [jsPDFModule, html2canvasModule] = await Promise.all([
      loadJsPDF(),
      loadHtml2Canvas()
    ]);
    const jsPDF = jsPDFModule.default;
    const html2canvas = html2canvasModule.default;

    const pdf = new jsPDF();
    let yPosition = 20;
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 20;

    // Título principal
    if (options.title) {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(options.title, margin, yPosition);
      yPosition += 15;
    }

    // Subtítulo
    if (options.subtitle) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100);
      pdf.text(options.subtitle, margin, yPosition);
      yPosition += 10;
    }

    // Fecha de generación
    pdf.setFontSize(10);
    pdf.setTextColor(150);
    pdf.text(`Generado el: ${new Date().toLocaleString('es-CO')}`, margin, yPosition);
    yPosition += 20;

    // Restablecer color
    pdf.setTextColor(0);

    // Agregar gráfico si existe
    if (chartElement) {
      try {
        const canvas = await html2canvas(chartElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Verificar si necesitamos nueva página
        if (yPosition + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 20;
      } catch (error) {
        console.warn('⚠️ No se pudo capturar el gráfico:', error);
      }
    }

    // Agregar secciones
    for (const section of sections) {
      // Verificar si necesitamos nueva página
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = margin;
      }

      // Título de sección
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(section.title, margin, yPosition);
      yPosition += 10;

      // Contenido según el tipo
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      if (section.type === 'summary' && section.calculate) {
        // Calcular datos para resumen
        const summaryData = section.calculate(data);
        Object.entries(summaryData).forEach(([key, value]) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${key}:`, margin + 5, yPosition);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`${value}`, margin + 80, yPosition);
          yPosition += 8;
        });
      } else if (section.type === 'table' && section.columns) {
        // Renderizar tabla simple
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = margin;
        }
        pdf.text('Ver datos detallados en exportación Excel/CSV', margin + 5, yPosition);
        yPosition += 15;
      } else if (section.content) {
        if (Array.isArray(section.content)) {
          // Contenido como lista
          section.content.forEach(item => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(`• ${item}`, margin + 5, yPosition);
            yPosition += 8;
          });
        } else {
          // Contenido como texto
          const lines = pdf.splitTextToSize(section.content, pageWidth - (margin * 2));
          lines.forEach((line: string) => {
            if (yPosition > pageHeight - 20) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin, yPosition);
            yPosition += 6;
          });
        }
      }

      yPosition += 10;
    }

    // Pie de página
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `Página ${i} de ${totalPages} - Domicilio AI Manager`,
        pageWidth - margin - 60,
        pageHeight - 10
      );
    }

    // Guardar archivo
    const filename = options.filename.endsWith('.pdf')
      ? options.filename
      : `${options.filename}.pdf`;

    pdf.save(filename);

    console.log('✅ PDF generado exitosamente:', filename);
    return true;
  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    throw new Error('Error al generar archivo PDF');
  }
};

// Utilidad para formatear valores comunes
export const formatters = {
  currency: (value: number) =>
    value ? new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value) : '$0',

  date: (value: string | Date) =>
    value ? new Date(value).toLocaleDateString('es-CO') : '-',

  datetime: (value: string | Date) =>
    value ? new Date(value).toLocaleString('es-CO') : '-',

  number: (value: number) =>
    value ? new Intl.NumberFormat('es-CO').format(value) : '0',

  percentage: (value: number) =>
    value ? `${Math.round(value)}%` : '0%',

  minutes: (value: number) => {
    if (!value || isNaN(value)) return '-';
    if (value < 1) return `${Math.round(value * 60)}s`;
    if (value >= 60) {
      const hours = Math.floor(value / 60);
      const minutes = Math.round(value % 60);
      return `${hours}h ${minutes}m`;
    }
    return `${Math.round(value * 10) / 10}m`;
  },

  status: (value: string) => value || 'Sin estado'
};

// Utilidad para obtener columnas comunes para diferentes tipos de datos
export const getCommonColumns = () => ({
  order: [
    { key: 'id', header: 'ID Orden', width: 10 },
    { key: 'status', header: 'Estado', width: 15, format: formatters.status },
    { key: 'sede_nombre', header: 'Sede', width: 20 },
    { key: 'created_at', header: 'Fecha Creación', width: 20, format: formatters.datetime },
    { key: 'payment_method', header: 'Método Pago', width: 15 },
    { key: 'total', header: 'Total', width: 15, format: formatters.currency }
  ] as TableColumn[],

  discount: [
    { key: 'orderId', header: 'ID Orden', width: 10 },
    { key: 'discountAmount', header: 'Descuento', width: 15, format: formatters.currency },
    { key: 'discountComment', header: 'Motivo', width: 30 },
    { key: 'appliedBy', header: 'Aplicado Por', width: 20 },
    { key: 'appliedDate', header: 'Fecha', width: 20, format: formatters.datetime }
  ] as TableColumn[],

  metrics: [
    { key: 'metric', header: 'Métrica', width: 25 },
    { key: 'value', header: 'Valor', width: 15 },
    { key: 'period', header: 'Período', width: 20 },
    { key: 'sede', header: 'Sede', width: 20 }
  ] as TableColumn[]
});