import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, User, Phone, MapPin, Loader2 } from 'lucide-react';
import { clienteService, Cliente } from '@/services/clienteService';
import { cn } from '@/lib/utils';

interface ClienteSelectorProps {
  cliente: Cliente | null;
  onClienteChange: (cliente: Cliente | null) => void;
  className?: string;
}

export const ClienteSelector: React.FC<ClienteSelectorProps> = ({
  cliente,
  onClienteChange,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Buscar clientes cuando cambia el query
  useEffect(() => {
    const searchClientes = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await clienteService.searchClientes(searchQuery);
        setSearchResults(results);
        setShowResults(true);
      } catch (error) {
        console.error('Error al buscar clientes:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchClientes, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelectCliente = (selectedCliente: Cliente) => {
    onClienteChange(selectedCliente);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleClearCliente = () => {
    onClienteChange(null);
    setSearchQuery('');
    setShowResults(false);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Seleccionar Cliente</Label>
      
      {!cliente ? (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
            )}
          </div>

          {/* Resultados de búsqueda */}
          {showResults && searchResults.length > 0 && (
            <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto">
              <CardContent className="p-2">
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCliente(c)}
                    className="w-full text-left p-2 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{c.nombre}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {c.telefono}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {showResults && searchResults.length === 0 && !isSearching && searchQuery.length >= 2 && (
            <Card className="absolute z-50 w-full mt-1">
              <CardContent className="p-4 text-center text-sm text-gray-500">
                No se encontraron clientes
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-900">{cliente.nombre}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Phone className="h-3 w-3" />
                  {cliente.telefono}
                </div>
                {cliente.direccion && (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <MapPin className="h-3 w-3" />
                    {cliente.direccion}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCliente}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Cambiar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

