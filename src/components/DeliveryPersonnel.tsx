import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, User, Trash2, Phone, History } from 'lucide-react';
import { DeliveryPerson, Order } from '@/types/delivery';
import { toast } from '@/hooks/use-toast';
import { DeliveryPersonHistory } from './DeliveryPersonHistory';

interface DeliveryPersonnelProps {
  deliveryPersonnel: DeliveryPerson[];
  orders: Order[];
  onUpdateDeliveryPersonnel: (personnel: DeliveryPerson[]) => void;
}

export const DeliveryPersonnel: React.FC<DeliveryPersonnelProps> = ({
  deliveryPersonnel,
  orders,
  onUpdateDeliveryPersonnel
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<DeliveryPerson | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const filteredPersonnel = deliveryPersonnel.filter(person =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    person.phone.includes(searchTerm)
  );

  const activePersonnelCount = deliveryPersonnel.filter(person => person.isActive).length;
  const totalDeliveries = deliveryPersonnel.reduce((sum, person) => sum + person.totalDeliveries, 0);

  const handleAddPerson = () => {
    if (!newPersonName.trim() || !newPersonPhone.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos.",
        variant: "destructive"
      });
      return;
    }

    const newPerson: DeliveryPerson = {
      id: `delivery-${Date.now()}`,
      name: newPersonName.trim(),
      phone: newPersonPhone.trim(),
      isActive: true,
      createdAt: new Date(),
      totalDeliveries: 0,
      activeOrders: 0
    };

    onUpdateDeliveryPersonnel([...deliveryPersonnel, newPerson]);
    
    toast({
      title: "Repartidor agregado",
      description: `${newPersonName} ha sido agregado correctamente.`,
    });

    setNewPersonName('');
    setNewPersonPhone('');
    setIsAddModalOpen(false);
  };

  const togglePersonActive = (personId: string) => {
    const updatedPersonnel = deliveryPersonnel.map(person =>
      person.id === personId
        ? { ...person, isActive: !person.isActive }
        : person
    );
    onUpdateDeliveryPersonnel(updatedPersonnel);

    const person = deliveryPersonnel.find(p => p.id === personId);
    toast({
      title: "Estado actualizado",
      description: `${person?.name} ${person?.isActive ? 'desactivado' : 'activado'} correctamente.`,
    });
  };

  const deletePerson = (personId: string) => {
    const person = deliveryPersonnel.find(p => p.id === personId);
    if (person?.activeOrders && person.activeOrders > 0) {
      toast({
        title: "No se puede eliminar",
        description: "El repartidor tiene pedidos activos asignados.",
        variant: "destructive"
      });
      return;
    }

    const updatedPersonnel = deliveryPersonnel.filter(p => p.id !== personId);
    onUpdateDeliveryPersonnel(updatedPersonnel);

    toast({
      title: "Repartidor eliminado",
      description: `${person?.name} ha sido eliminado correctamente.`,
    });
  };

  const handlePersonClick = (person: DeliveryPerson) => {
    setSelectedPerson(person);
    setIsHistoryModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Repartidores</h1>
          <p className="text-muted-foreground">
            {activePersonnelCount} activos • {deliveryPersonnel.length} total
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
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleAddPerson} className="flex-1">
                  Agregar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <p className="text-2xl font-bold">{deliveryPersonnel.length}</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPersonnel.map((person) => (
          <Card 
            key={person.id} 
            className={`cursor-pointer transition-all hover:shadow-md ${!person.isActive ? 'opacity-60' : ''}`}
            onClick={() => handlePersonClick(person)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {person.name}
                    <History className="h-4 w-4 text-muted-foreground ml-auto" />
                  </CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <Phone className="h-4 w-4" />
                    {person.phone}
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={person.isActive}
                    onCheckedChange={() => togglePersonActive(person.id)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePerson(person.id);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant={person.isActive ? "default" : "secondary"}>
                  {person.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Entregas totales:</span>
                  <span className="font-medium">{person.totalDeliveries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pedidos activos:</span>
                  <span className="font-medium">{person.activeOrders}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Desde:</span>
                  <span className="text-sm">{person.createdAt.toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DeliveryPersonHistory
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        deliveryPerson={selectedPerson}
        orders={orders}
      />
    </div>
  );
};
