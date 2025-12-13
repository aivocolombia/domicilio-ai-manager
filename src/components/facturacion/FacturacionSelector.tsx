import React from 'react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Building2, User, Plus } from 'lucide-react';
import { ClienteFacturacion } from '@/services/clienteService';
import { cn } from '@/lib/utils';

interface FacturacionSelectorProps {
  facturaciones: ClienteFacturacion[];
  seleccionada: ClienteFacturacion | null;
  onSeleccionar: (facturacion: ClienteFacturacion) => void;
  onCreateNew?: () => void;
  className?: string;
}

// Mapeo de códigos de identificación
const IDENTIFICATION_TYPES: Record<string, string> = {
  '11': 'CC',
  '31': 'NIT',
  '12': 'CE',
  '13': 'TI',
  '21': 'TE',
  '22': 'NIT Extranjero',
  '41': 'Pasaporte',
  '42': 'Doc. Extranjero',
  '47': 'NIT sin DV',
  '48': 'Otro',
  '50': 'NIT Extranjero sin DV',
  '91': 'NUIP'
};

export const FacturacionSelector: React.FC<FacturacionSelectorProps> = ({
  facturaciones,
  seleccionada,
  onSeleccionar,
  onCreateNew,
  className
}) => {
  if (facturaciones.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <Label>Seleccionar Facturación</Label>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4 space-y-3">
            <p className="text-center text-sm text-yellow-700">
              El cliente seleccionado no tiene registros de facturación activos
            </p>
            {onCreateNew && (
              <Button
                variant="outline"
                className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                onClick={onCreateNew}
              >
                <Plus className="h-4 w-4 mr-2" />
                Crear Registro de Facturación
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const getIdentificationLabel = (type: string, number: string, dv?: string) => {
    const label = IDENTIFICATION_TYPES[type] || type;
    if (type === '31' && dv) {
      return `${label}: ${number}-${dv}`;
    }
    return `${label}: ${number}`;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Seleccionar Facturación</Label>
      <div className="space-y-2">
        {facturaciones.map((fact) => (
          <Card
            key={fact.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              seleccionada?.id === fact.id
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-green-300"
            )}
            onClick={() => onSeleccionar(fact)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {fact.tipo_facturacion === 'persona_juridica' ? (
                      <Building2 className="h-4 w-4 text-blue-600" />
                    ) : (
                      <User className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="font-medium text-gray-900">
                      {fact.nombre_razon_social}
                    </span>
                    {fact.es_default && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>
                      {getIdentificationLabel(
                        fact.identification_type,
                        fact.identification_number,
                        fact.dv
                      )}
                    </div>
                    <div>
                      <span className="font-medium">Tipo:</span>{' '}
                      {fact.tipo_facturacion === 'persona_natural' ? 'Persona Natural' : 'Persona Jurídica'}
                    </div>
                    <div>
                      <span className="font-medium">Régimen:</span> {fact.regime_code}
                    </div>
                  </div>
                </div>

                {seleccionada?.id === fact.id && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

