import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Download,
  FileSpreadsheet,
  FileText,
  File,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { useExport, ExportFormat } from '@/hooks/useExport';
import { TableColumn, PDFSection, ExportOptions } from '@/utils/exportUtils';

interface ExportButtonProps {
  // Datos para exportar
  data?: any[];
  columns?: TableColumn[];

  // Para reportes PDF
  pdfSections?: PDFSection[];
  chartElement?: HTMLElement;

  // Configuración
  formats?: ExportFormat[];
  filename?: string;
  title?: string;
  subtitle?: string;
  sheetName?: string;

  // Estilo
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;

  // Callbacks
  onExportStart?: () => void;
  onExportComplete?: (format: ExportFormat) => void;
  onExportError?: (error: Error) => void;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  data = [],
  columns = [],
  pdfSections = [],
  chartElement,
  formats = ['excel', 'csv', 'pdf'],
  filename = 'reporte',
  title,
  subtitle,
  sheetName,
  variant = 'outline',
  size = 'sm',
  className = '',
  onExportStart,
  onExportComplete,
  onExportError
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const {
    isExporting,
    exportFormat,
    exportTableToExcel,
    exportTableToCSV,
    exportReportToPDF
  } = useExport({
    defaultFilename: filename,
    onExportStart,
    onExportComplete,
    onExportError
  });

  const handleExport = async (format: ExportFormat) => {
    setIsDropdownOpen(false);

    const options: Partial<ExportOptions> = {
      title,
      subtitle,
      sheetName
    };

    try {
      switch (format) {
        case 'excel':
          if (!data.length || !columns.length) {
            throw new Error('Datos y columnas requeridos para exportar a Excel');
          }
          await exportTableToExcel(data, columns, options);
          break;

        case 'csv':
          if (!data.length || !columns.length) {
            throw new Error('Datos y columnas requeridos para exportar a CSV');
          }
          await exportTableToCSV(data, columns, options);
          break;

        case 'pdf':
          await exportReportToPDF(pdfSections, options, chartElement);
          break;

        default:
          throw new Error(`Formato no soportado: ${format}`);
      }
    } catch (error) {
      console.error('Error en exportación:', error);
    }
  };

  // Validar si hay datos disponibles para cada formato
  const isFormatAvailable = (format: ExportFormat) => {
    switch (format) {
      case 'excel':
      case 'csv':
        return data.length > 0 && columns.length > 0;
      case 'pdf':
        return pdfSections.length > 0 || chartElement;
      default:
        return false;
    }
  };

  // Obtener icono para cada formato
  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'excel':
        return <FileSpreadsheet className="h-4 w-4" />;
      case 'csv':
        return <File className="h-4 w-4" />;
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      default:
        return <Download className="h-4 w-4" />;
    }
  };

  // Obtener nombre de formato para mostrar
  const getFormatName = (format: ExportFormat) => {
    switch (format) {
      case 'excel':
        return 'Excel (.xlsx)';
      case 'csv':
        return 'CSV (.csv)';
      case 'pdf':
        return 'PDF (.pdf)';
      default:
        return format;
    }
  };

  // Obtener descripción del formato
  const getFormatDescription = (format: ExportFormat) => {
    switch (format) {
      case 'excel':
        return 'Tabla editable con formato';
      case 'csv':
        return 'Datos separados por comas';
      case 'pdf':
        return 'Reporte ejecutivo con gráficos';
      default:
        return '';
    }
  };

  // Filtrar formatos disponibles
  const availableFormats = formats.filter(isFormatAvailable);

  if (availableFormats.length === 0) {
    return null; // No mostrar botón si no hay datos
  }

  // Si solo hay un formato disponible, mostrar botón directo
  if (availableFormats.length === 1) {
    const format = availableFormats[0];
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => handleExport(format)}
        disabled={isExporting}
      >
        {isExporting && exportFormat === format ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <span className="mr-2">{getFormatIcon(format)}</span>
        )}
        {isExporting && exportFormat === format ? 'Exportando...' : `Exportar ${getFormatName(format)}`}
      </Button>
    );
  }

  // Mostrar dropdown con múltiples opciones
  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isExporting ? 'Exportando...' : 'Exportar'}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Seleccionar formato</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {availableFormats.map((format) => (
          <DropdownMenuItem
            key={format}
            onClick={() => handleExport(format)}
            disabled={isExporting}
            className="flex flex-col items-start space-y-1 py-3"
          >
            <div className="flex items-center space-x-2 w-full">
              {isExporting && exportFormat === format ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                getFormatIcon(format)
              )}
              <span className="font-medium">{getFormatName(format)}</span>
            </div>
            <span className="text-xs text-muted-foreground ml-6">
              {getFormatDescription(format)}
            </span>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-xs text-muted-foreground">
          {data.length > 0 && `${data.length} registros disponibles`}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};