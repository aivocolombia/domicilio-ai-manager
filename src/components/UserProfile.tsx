
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { User, MapPin, Calendar, UserRound } from 'lucide-react';

interface UserProfileProps {
  // No longer need user prop as we'll get it from auth context
}

export const UserProfile: React.FC<UserProfileProps> = () => {
  // Usar datos mock para evitar problemas de autenticación
  const profile = {
    name: 'Carlos Admin',
    email: 'carlos@ajiaco.com',
    role: 'admin' as const,
    sede_id: 'sede-1',
    created_at: '2024-01-01T00:00:00Z'
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive/10 text-destructive';
      case 'agent': return 'bg-primary/10 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'agent': return 'Agente';
      default: return role;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-2 text-white hover:bg-white/10 transition-colors"
        >
          <UserRound className="h-5 w-5" />
          <span className="hidden md:inline">{profile.name}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 shadow-lg animate-in fade-in-0 zoom-in-95" 
        align="end"
        sideOffset={8}
      >
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3 bg-gradient-to-r from-brand-primary to-brand-primary/80 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" />
              Perfil de Usuario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-2">
              <p className="font-semibold text-lg text-foreground">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <Badge className={getRoleColor(profile.role)}>
                {getRoleText(profile.role)}
              </Badge>
            </div>
            
            <div className="space-y-3">
              {profile.sede_id && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Sede asignada</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Desde: <span className="font-medium text-foreground">{new Date(profile.created_at).toLocaleDateString('es-CO')}</span></span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full flex items-center gap-2"
                disabled
              >
                <UserRound className="h-4 w-4" />
                Sesión Activa
              </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
