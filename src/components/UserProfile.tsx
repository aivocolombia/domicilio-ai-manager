
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, MapPin, Phone, Calendar } from 'lucide-react';
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
    <Card className="w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5" />
          Perfil de Usuario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-semibold text-lg">{user.name}</p>
          <Badge className={getRoleColor(user.role)}>
            {getRoleText(user.role)}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>Sede: {user.sede}</span>
        </div>
        
        {user.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{user.phone}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Desde: {user.createdAt.toLocaleDateString('es-CO')}</span>
        </div>
      </CardContent>
    </Card>
  );
};
