import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, User, Phone, History, Loader2, AlertCircle } from 'lucide-react';
import { useDelivery } from '@/hooks/useDelivery';
import { toast } from '@/hooks/use-toast';
import { DeliveryPersonHistory } from './DeliveryPersonHistory';

interface DeliveryPersonnelProps {
  effectiveSedeId: string;
  currentSedeName: string;
}

export const DeliveryPersonnel: React.FC<DeliveryPersonnelProps> = ({
  effectiveSedeId,
  currentSedeName
}) => {
  const {
    repartidores,
    totalOrdenesAsignadas,
    loading,
    error,
    crearRepartidor,
    cambiarDisponibilidad,
    clearError
  } = useDelivery(effectiveSedeId);

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonPlacas, setNewPersonPlacas] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Debug logs
  console.log('🔍 DeliveryPersonnel Debug:', {
    repartidores: repartidores,
    loading: loading,
    error: error,
    repartidoresLength: repartidores.length
  });

  const filteredPersonnel = repartidores.filter(person =>
    person.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.telefono?.includes(searchTerm) ||
    person.placas?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activePersonnelCount = repartidores.filter(person => person.disponible).length;
  const totalDeliveries = repartidores.reduce((sum, person) => sum + (person.entregados || 0), 0);
  const totalDelivered = repartidores.reduce((sum, person) => sum + (person.total_entregado || 0), 0);

  console.log('📊 Estadísticas:', {
    filteredPersonnel: filteredPersonnel.length,
    activePersonnelCount,
    totalDeliveries,
    totalOrdenesAsignadas,
    totalDelivered
  });

  const handleAddPerson = async () => {
    console.log('🔄 Intentando crear repartidor...');
    console.log('📝 Datos del formulario:', {
      nombre: newPersonName,
      telefono: newPersonPhone,
      placas: newPersonPlacas
    });

    if (!newPersonName.trim() || !newPersonPhone.trim()) {
      console.log('❌ Validación fallida: campos vacíos');
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('✅ Validación exitosa, creando repartidor...');
      
      const nuevoRepartidor = await crearRepartidor({
        nombre: newPersonName.trim(),
        telefono: newPersonPhone.trim(),
        placas: newPersonPlacas.trim() || undefined,
        disponible: true
      });

      console.log('✅ Repartidor creado exitosamente:', nuevoRepartidor);

      // Limpiar formulario
      setNewPersonName('');
      setNewPersonPhone('');
      setNewPersonPlacas('');
      setIsAddModalOpen(false);

      console.log('✅ Formulario limpiado y modal cerrado');
    } catch (error) {
      console.error('❌ Error al crear repartidor:', error);
      // El error ya se maneja en el hook con toast
    }
  };

  const togglePersonActive = async (personId: number) => {
    try {
      const person = repartidores.find(p => p.id === personId);
      if (!person) return;

      await cambiarDisponibilidad(personId, !person.disponible);
    } catch (error) {
      // El error ya se maneja en el hook
      console.error('Error al cambiar disponibilidad:', error);
    }
  };



  const handlePersonClick = (person: any) => {
    setSelectedPerson(person);
    setIsHistoryModalOpen(true);
  };

  // Manejar error
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-5 w-5" />
          <span>Error: {error}</span>
        </div>
        <Button onClick={clearError}>Reintentar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Repartidores</h1>
          <p className="text-muted-foreground">
            {activePersonnelCount} activos • {repartidores.length} total
          </p>
        </div>
        
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Agregar Repartidor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Repartidor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder="Nombre del repartidor"
                />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={newPersonPhone}
                  onChange={(e) => setNewPersonPhone(e.target.value)}
                  placeholder="Número de teléfono"
                />
              </div>
              <div>
                <Label htmlFor="placas">Placas (opcional)</Label>
                <Input
                  id="placas"
                  value={newPersonPlacas}
                  onChange={(e) => setNewPersonPlacas(e.target.value)}
                  placeholder="Placas del vehículo"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    console.log('🖱️ Botón Agregar clickeado');
                    handleAddPerson();
                  }} 
                  className="flex-1"
                >
                  Agregar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-2xl font-bold text-green-600">{activePersonnelCount}</p>
              <p className="text-sm text-muted-foreground">Activos</p>
            </div>
            <User className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-2xl font-bold">{repartidores.length}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <User className="h-8 w-8 text-blue-600" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-2xl font-bold">{totalDeliveries}</p>
              <p className="text-sm text-muted-foreground">Entregas Totales</p>
            </div>
            <User className="h-8 w-8 text-purple-600" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-2xl font-bold">{totalOrdenesAsignadas}</p>
              <p className="text-sm text-muted-foreground">Total Asignados</p>
            </div>
            <User className="h-8 w-8 text-orange-600" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-2xl font-bold text-green-600">${totalDelivered.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Entregado (Hoy)</p>
              <div className="flex gap-4 mt-2">
                <div className="text-xs">
                  <span className="text-green-600 font-medium">Efectivo: ${repartidores.reduce((sum, person) => sum + (person.entregado_efectivo || 0), 0).toLocaleString()}</span>
                </div>
                <div className="text-xs">
                  <span className="text-blue-600 font-medium">Otros: ${repartidores.reduce((sum, person) => sum + (person.entregado_otros || 0), 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <User className="h-8 w-8 text-green-600" />
          </CardContent>
        </Card>
        

      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar repartidores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando repartidores...</span>
        </div>
      )}

      {/* Products Grid */}
      {!loading && (
        <>
          {filteredPersonnel.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No se encontraron repartidores</h3>
              <p className="text-muted-foreground">
                {searchTerm ? 'Intenta con otros términos de búsqueda.' : 'No hay repartidores registrados.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPersonnel.map((person) => (
          <Card 
            key={person.id} 
            className={`cursor-pointer transition-all hover:shadow-md ${!person.disponible ? 'opacity-60' : ''}`}
            onClick={() => handlePersonClick(person)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {person.nombre || 'Sin nombre'}
                    <History className="h-4 w-4 text-muted-foreground ml-auto" />
                  </CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Phone className="h-4 w-4" />
                    {person.telefono || 'Sin teléfono'}
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={person.disponible}
                    onCheckedChange={() => person.id !== 1 && togglePersonActive(person.id)}
                    disabled={person.id === 1}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant={person.disponible ? "default" : "secondary"}>
                  {person.disponible ? 'Disponible' : 'No Disponible'}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                {person.id !== 1 ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Pedidos activos:</span>
                      <span className="font-medium">{person.pedidos_activos || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Entregados:</span>
                      <span className="font-medium">{person.entregados || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total asignados:</span>
                      <span className="font-medium">{person.total_asignados || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total entregado (hoy):</span>
                      <span className="font-medium text-green-600">${(person.total_entregado || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Efectivo (hoy):</span>
                      <span className="font-medium text-green-600">${(person.entregado_efectivo || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Otros métodos (hoy):</span>
                      <span className="font-medium text-blue-600">${(person.entregado_otros || 0).toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Repartidor pedido por el usuario</div>
                )}
                {person.placas && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Placas:</span>
                    <span className="text-sm font-medium">{person.placas}</span>
                  </div>
                )}
                {person.id !== 1 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Desde:</span>
                    <span className="text-sm">{new Date(person.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
          )}
        </>
      )}

      <DeliveryPersonHistory
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        deliveryPerson={selectedPerson}
        orders={[]}
      />
    </div>
  );
};
