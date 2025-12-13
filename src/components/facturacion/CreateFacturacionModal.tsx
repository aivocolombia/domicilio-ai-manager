import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Cliente, ClienteFacturacion } from '@/services/clienteService';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';

interface CreateFacturacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente;
  onFacturacionCreated: (facturacion: ClienteFacturacion) => void;
}

// Mapeo de códigos de identificación
const IDENTIFICATION_TYPES = [
  { value: '11', label: 'CC - Cédula de Ciudadanía' },
  { value: '31', label: 'NIT - Número de Identificación Tributaria' },
  { value: '12', label: 'CE - Cédula de Extranjería' },
  { value: '13', label: 'TI - Tarjeta de Identidad' },
  { value: '21', label: 'TE - Tarjeta de Extranjería' },
  { value: '22', label: 'NIT Extranjero' },
  { value: '41', label: 'Pasaporte' },
  { value: '42', label: 'Doc. Extranjero' },
  { value: '47', label: 'NIT sin DV' },
  { value: '48', label: 'Otro' },
  { value: '50', label: 'NIT Extranjero sin DV' },
  { value: '91', label: 'NUIP' }
];

const REGIME_CODES = [
  { value: 'O-13', label: 'O-13 - Gran contribuyente' },
  { value: 'O-15', label: 'O-15 - Autorretenedor' },
  { value: 'O-23', label: 'O-23 - Régimen simple de tributación' },
  { value: 'O-47', label: 'O-47 - Régimen común' },
  { value: 'O-48', label: 'O-48 - Régimen simplificado' },
  { value: 'O-49', label: 'O-49 - Régimen especial de tributación' },
  { value: 'R-99-PN', label: 'R-99-PN - Régimen simplificado para persona natural' }
];

export const CreateFacturacionModal: React.FC<CreateFacturacionModalProps> = ({
  isOpen,
  onClose,
  cliente,
  onFacturacionCreated
}) => {
  const [tipoFacturacion, setTipoFacturacion] = useState<'persona_natural' | 'persona_juridica'>('persona_natural');
  const [identificationType, setIdentificationType] = useState('11');
  const [identificationNumber, setIdentificationNumber] = useState('');
  const [dv, setDv] = useState('');
  const [nombreRazonSocial, setNombreRazonSocial] = useState(cliente.nombre || '');
  const [regimeCode, setRegimeCode] = useState('R-99-PN');
  const [esDefault, setEsDefault] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organizationType = tipoFacturacion === 'persona_juridica' ? 1 : 2;
  const requiresDV = identificationType === '31'; // Solo NIT requiere DV

  const handleCreate = async () => {
    setError(null);

    // Validaciones
    if (!nombreRazonSocial.trim()) {
      setError('El nombre o razón social es requerido');
      return;
    }

    if (!identificationNumber.trim()) {
      setError('El número de identificación es requerido');
      return;
    }

    if (requiresDV && !dv.trim()) {
      setError('El dígito verificador (DV) es requerido para NIT');
      return;
    }

    if (!regimeCode) {
      setError('El código de régimen es requerido');
      return;
    }

    setIsCreating(true);

    try {
      const facturacionData: any = {
        cliente_id: cliente.id,
        tipo_facturacion: tipoFacturacion,
        identification_type: identificationType,
        identification_number: identificationNumber,
        nombre_razon_social: nombreRazonSocial.trim(),
        organization_type: organizationType,
        regime_code: regimeCode,
        es_default: esDefault,
        es_activo: true
      };

      // Solo agregar DV si es NIT
      if (requiresDV && dv.trim()) {
        facturacionData.dv = dv.trim();
      }

      const { data, error: insertError } = await supabase
        .from('clientes_facturacion')
        .insert(facturacionData)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      toast({
        title: "Facturación creada",
        description: "El registro de facturación se ha creado exitosamente",
      });

      onFacturacionCreated(data as ClienteFacturacion);
      onClose();
      
      // Reset form
      setTipoFacturacion('persona_natural');
      setIdentificationType('11');
      setIdentificationNumber('');
      setDv('');
      setNombreRazonSocial(cliente.nombre || '');
      setRegimeCode('R-99-PN');
      setEsDefault(true);
    } catch (err) {
      console.error('Error al crear facturación:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al crear registro de facturación';
      setError(errorMessage);
      toast({
        title: "Error al crear facturación",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Registro de Facturación</DialogTitle>
          <DialogDescription>
            Crear un nuevo registro de facturación para {cliente.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Tipo de Facturación */}
          <div>
            <Label>Tipo de Facturación</Label>
            <Select
              value={tipoFacturacion}
              onValueChange={(value: 'persona_natural' | 'persona_juridica') => {
                setTipoFacturacion(value);
                // Ajustar régimen por defecto según el tipo
                if (value === 'persona_natural') {
                  setRegimeCode('R-99-PN');
                } else {
                  setRegimeCode('O-47');
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="persona_natural">Persona Natural</SelectItem>
                <SelectItem value="persona_juridica">Persona Jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Nombre o Razón Social */}
          <div>
            <Label>Nombre o Razón Social *</Label>
            <Input
              value={nombreRazonSocial}
              onChange={(e) => setNombreRazonSocial(e.target.value)}
              placeholder={tipoFacturacion === 'persona_natural' ? 'Nombre completo' : 'Razón social'}
            />
          </div>

          {/* Tipo de Identificación */}
          <div>
            <Label>Tipo de Identificación *</Label>
            <Select value={identificationType} onValueChange={setIdentificationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IDENTIFICATION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Número de Identificación */}
          <div>
            <Label>Número de Identificación *</Label>
            <Input
              value={identificationNumber}
              onChange={(e) => setIdentificationNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="Número de identificación"
            />
          </div>

          {/* Dígito Verificador (solo para NIT) */}
          {requiresDV && (
            <div>
              <Label>Dígito Verificador (DV) *</Label>
              <Input
                value={dv}
                onChange={(e) => setDv(e.target.value.replace(/\D/g, ''))}
                placeholder="Dígito verificador"
                maxLength={1}
              />
            </div>
          )}

          {/* Código de Régimen */}
          <div>
            <Label>Código de Régimen *</Label>
            <Select value={regimeCode} onValueChange={setRegimeCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIME_CODES.map((regime) => (
                  <SelectItem key={regime.value} value={regime.value}>
                    {regime.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checkbox para default */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="esDefault"
              checked={esDefault}
              onChange={(e) => setEsDefault(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="esDefault" className="text-sm">
              Marcar como registro por defecto
            </Label>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isCreating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Facturación'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

