
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { User, MapPin, Phone, Calendar, UserRound } from 'lucide-react';
import { User as UserType } from '@/types/delivery';

interface UserProfileProps {
  user: UserType;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'callcenter': return 'bg-blue-100 text-blue-800';
      case 'sede': return 'bg-green-100 text-green-800';
      case 'repartidor': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'callcenter': return 'Call Center';
      case 'sede': return 'Sede Local';
      case 'repartidor': return 'Repartidor';
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
          <span className="hidden md:inline">{user.name}</span>
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
              <p className="font-semibold text-lg text-gray-900">{user.name}</p>
              <Badge className={getRoleColor(user.role)}>
                {getRoleText(user.role)}
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-brand-primary" />
                <span>Sede: <span className="font-medium text-gray-700">{user.sede}</span></span>
              </div>
              
              {user.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 text-brand-primary" />
                  <span className="font-medium text-gray-700">{user.phone}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 text-brand-primary" />
                <span>Desde: <span className="font-medium text-gray-700">{user.createdAt.toLocaleDateString('es-CO')}</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
