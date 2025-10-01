import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  ExportOptions,
  TableColumn,
  PDFSection
} from '@/utils/exportUtils';

export type ExportFormat = 'excel' | 'csv' | 'pdf';

interface UseExportProps {
  defaultFilename?: string;
  onExportStart?: () => void;
  onExportComplete?: (format: ExportFormat) => void;
  onExportError?: (error: Error) => void;
}

export const useExport = (props: UseExportProps = {}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const { toast } = useToast();

  const {
    defaultFilename = 'reporte',
    onExportStart,
    onExportComplete,
    onExportError
  } = props;

  // Generar nombre de archivo con timestamp
  const generateFilename = (baseName: string, format: ExportFormat) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    const extension = format === 'excel' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
    return `${baseName}_${timestamp}.${extension}`;
  };

  // Exportar tabla a Excel
  const exportTableToExcel = async (
    data: any[],
    columns: TableColumn[],
    options: Partial<ExportOptions> = {}
  ) => {
    try {
      setIsExporting(true);
      setExportFormat('excel');
      onExportStart?.();

      const filename = options.filename || generateFilename(defaultFilename, 'excel');

      await exportToExcel(data, columns, {
        filename,
        sheetName: options.sheetName || 'Datos',
        title: options.title,
        subtitle: options.subtitle
      });

      toast({
        title: "Exportación exitosa",
        description: `Archivo Excel descargado: ${filename}`,
        variant: "default"
      });

      onExportComplete?.('excel');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error desconocido');
      console.error('❌ Error exportando a Excel:', err);

      toast({
        title: "Error en exportación",
        description: err.message,
        variant: "destructive"
      });

      onExportError?.(err);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  // Exportar tabla a CSV
  const exportTableToCSV = async (
    data: any[],
    columns: TableColumn[],
    options: Partial<ExportOptions> = {}
  ) => {
    try {
      setIsExporting(true);
      setExportFormat('csv');
      onExportStart?.();

      const filename = options.filename || generateFilename(defaultFilename, 'csv');

      await exportToCSV(data, columns, {
        filename,
        title: options.title,
        subtitle: options.subtitle
      });

      toast({
        title: "Exportación exitosa",
        description: `Archivo CSV descargado: ${filename}`,
        variant: "default"
      });

      onExportComplete?.('csv');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error desconocido');
      console.error('❌ Error exportando a CSV:', err);

      toast({
        title: "Error en exportación",
        description: err.message,
        variant: "destructive"
      });

      onExportError?.(err);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  // Exportar reporte a PDF
  const exportReportToPDF = async (
    sections: PDFSection[],
    options: Partial<ExportOptions> = {},
    chartElement?: HTMLElement
  ) => {
    try {
      setIsExporting(true);
      setExportFormat('pdf');
      onExportStart?.();

      const filename = options.filename || generateFilename(defaultFilename, 'pdf');

      await exportToPDF(sections, {
        filename,
        title: options.title,
        subtitle: options.subtitle
      }, chartElement);

      toast({
        title: "Exportación exitosa",
        description: `Archivo PDF descargado: ${filename}`,
        variant: "default"
      });

      onExportComplete?.('pdf');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Error desconocido');
      console.error('❌ Error exportando a PDF:', err);

      toast({
        title: "Error en exportación",
        description: err.message,
        variant: "destructive"
      });

      onExportError?.(err);
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  // Función conveniente para exportar según el formato
  const exportData = async (
    format: ExportFormat,
    data: any[] | PDFSection[],
    columns?: TableColumn[],
    options: Partial<ExportOptions> = {},
    chartElement?: HTMLElement
  ) => {
    switch (format) {
      case 'excel':
        if (!columns) throw new Error('Columnas requeridas para Excel');
        return exportTableToExcel(data as any[], columns, options);

      case 'csv':
        if (!columns) throw new Error('Columnas requeridas para CSV');
        return exportTableToCSV(data as any[], columns, options);

      case 'pdf':
        return exportReportToPDF(data as PDFSection[], options, chartElement);

      default:
        throw new Error(`Formato no soportado: ${format}`);
    }
  };

  return {
    // Estado
    isExporting,
    exportFormat,

    // Funciones específicas
    exportTableToExcel,
    exportTableToCSV,
    exportReportToPDF,

    // Función general
    exportData,

    // Utilidades
    generateFilename
  };
};