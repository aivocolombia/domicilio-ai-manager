import { supabase } from '@/lib/supabase';

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role: string;
  sede_id?: string;
  is_active: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  sede_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSedeData {
  name: string;
  address: string;
  phone: string;
  is_active: boolean;
}

export interface UpdateSedeData {
  name?: string;
  address?: string;
  phone?: string;
  current_capacity?: number;
  is_active?: boolean;
}

export interface Sede {
  id: string;
  name: string;
  address: string;
  phone: string;
  current_capacity: number;
  max_capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export class AdminService {
  // Obtener todos los usuarios
  async getUsers(): Promise<User[]> {
    try {
      console.log('👥 Consultando usuarios...');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error al obtener usuarios:', error);
        throw new Error(`Error al obtener usuarios: ${error.message}`);
      }

      console.log('✅ Usuarios obtenidos:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Error en getUsers:', error);
      throw error;
    }
  }

  // Crear usuario con Auth y perfil
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      console.log('➕ Creando usuario completo:', userData.email);

      // Verificar que el usuario actual sea admin
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        throw new Error('Usuario no autenticado');
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.user.id)
        .single();

      if (!userProfile || userProfile.role !== 'admin') {
        throw new Error('Solo los administradores pueden crear usuarios');
      }

      // Verificar que el email no exista
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userData.email)
        .single();

      if (existingUser) {
        throw new Error('El email ya está registrado');
      }

      // Intentar usar función RPC primero (si existe)
      try {
        console.log('🔄 Intentando usar función RPC...');
        
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('create_user_profile_only', {
            p_email: userData.email,
            p_name: userData.name,
            p_role: userData.role,
            p_sede_id: userData.sede_id || null,
            p_is_active: userData.is_active
          });

        if (rpcError) {
          console.log('⚠️ Función RPC no disponible, usando método simplificado...');
          throw rpcError;
        }

        console.log('✅ Usuario creado con función RPC:', rpcData);
        return rpcData;
      } catch (rpcError) {
        console.log('📝 Usando método simplificado - solo perfil...');
        
        // Intentar crear usuario usando Supabase Auth con datos temporales
        try {
          console.log('🔐 Creando usuario usando signUp...');
          
          // Usar signUp para crear el usuario en Auth sin confirmación de email
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
              emailRedirectTo: undefined, // No redirección de email
              data: {
                name: userData.name,
                role: userData.role,
                sede_id: userData.sede_id
              }
            }
          });

          if (authError) {
            console.error('❌ Error creando usuario Auth:', authError);
            throw authError;
          }

          if (!authData.user) {
            throw new Error('No se pudo crear el usuario Auth');
          }

          console.log('✅ Usuario Auth creado:', authData.user.id);

          // Ahora crear el perfil con el ID del usuario Auth
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email: userData.email,
              name: userData.name,
              role: userData.role,
              sede_id: userData.sede_id || null,
              is_active: userData.is_active,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();

          if (profileError) {
            console.error('❌ Error creando perfil:', profileError);
            // Nota: En producción deberías limpiar el usuario Auth huérfano
            console.log('⚠️ Usuario Auth creado pero perfil falló. ID:', authData.user.id);
            throw profileError;
          }

          console.log('✅ Usuario y perfil creados exitosamente');
          return {
            id: authData.user.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            sede_id: userData.sede_id,
            is_active: userData.is_active,
            created_at: profileData.created_at,
            updated_at: profileData.updated_at
          };
          
        } catch (authError) {
          console.error('❌ Error en creación Auth:', authError);
          throw new Error('No se pudo crear el usuario. Se requiere configuración adicional del Admin API.');
        }
      }
    } catch (error) {
      console.error('❌ Error en createUser:', error);
      throw error;
    }
  }

  // Actualizar estado de usuario
  async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
    try {
      console.log('🔄 Actualizando estado de usuario:', { userId, isActive });

      const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId);

      if (error) {
        console.error('❌ Error al actualizar usuario:', error);
        throw new Error(`Error al actualizar usuario: ${error.message}`);
      }

      console.log('✅ Estado de usuario actualizado exitosamente');
    } catch (error) {
      console.error('❌ Error en updateUserStatus:', error);
      throw error;
    }
  }

  // Actualizar sede de usuario
  async updateUserSede(userId: string, sedeId: string): Promise<void> {
    try {
      console.log('🏢 Actualizando sede de usuario:', { userId, sedeId });

      // Verificar que el usuario actual sea admin
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        throw new Error('Usuario no autenticado');
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.user.id)
        .single();

      if (!userProfile || userProfile.role !== 'admin') {
        throw new Error('Solo los administradores pueden reasignar sedes');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ sede_id: sedeId })
        .eq('id', userId);

      if (error) {
        console.error('❌ Error al actualizar sede de usuario:', error);
        throw new Error(`Error al actualizar sede: ${error.message}`);
      }

      console.log('✅ Sede de usuario actualizada exitosamente');
    } catch (error) {
      console.error('❌ Error en updateUserSede:', error);
      throw error;
    }
  }

  // Eliminar usuario
  async deleteUser(userId: string): Promise<void> {
    try {
      console.log('🗑️ Eliminando usuario:', userId);

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('❌ Error al eliminar usuario:', error);
        throw new Error(`Error al eliminar usuario: ${error.message}`);
      }

      console.log('✅ Usuario eliminado exitosamente');
    } catch (error) {
      console.error('❌ Error en deleteUser:', error);
      throw error;
    }
  }

  // Obtener sedes disponibles (versión simple para dropdowns)
  async getSedes(): Promise<Array<{ id: string; name: string }>> {
    try {
      console.log('🏢 Consultando sedes...');

      const { data, error } = await supabase
        .from('sedes')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('❌ Error al obtener sedes:', error);
        throw new Error(`Error al obtener sedes: ${error.message}`);
      }

      console.log('✅ Sedes obtenidas:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Error en getSedes:', error);
      throw error;
    }
  }

  // Obtener todas las sedes con información completa
  async getSedesComplete(): Promise<Sede[]> {
    try {
      console.log('🏢 Consultando sedes completas...');

      const { data, error } = await supabase
        .from('sedes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error al obtener sedes completas:', error);
        throw new Error(`Error al obtener sedes: ${error.message}`);
      }

      console.log('✅ Sedes completas obtenidas:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('❌ Error en getSedesComplete:', error);
      throw error;
    }
  }

  // Crear nueva sede
  async createSede(sedeData: CreateSedeData): Promise<Sede> {
    try {
      console.log('➕ Creando nueva sede:', sedeData.name);

      // Verificar que el usuario actual sea admin
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        throw new Error('Usuario no autenticado');
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.user.id)
        .single();

      if (!userProfile || userProfile.role !== 'admin') {
        throw new Error('Solo los administradores pueden crear sedes');
      }

      // Verificar que el nombre no exista
      const { data: existingSede } = await supabase
        .from('sedes')
        .select('id')
        .eq('name', sedeData.name)
        .single();

      if (existingSede) {
        throw new Error('Ya existe una sede con este nombre');
      }

      // Crear la sede
      const { data, error } = await supabase
        .from('sedes')
        .insert({
          name: sedeData.name,
          address: sedeData.address,
          phone: sedeData.phone,
          current_capacity: 0, // Inicia en 0
          is_active: sedeData.is_active
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error al crear sede:', error);
        throw new Error(`Error al crear sede: ${error.message}`);
      }

      console.log('✅ Sede creada exitosamente:', data);
      
      // Inicializar productos para la nueva sede
      await this.initializeSedeProducts(data.id);
      
      return data;
    } catch (error) {
      console.error('❌ Error en createSede:', error);
      throw error;
    }
  }

  // Inicializar productos para nueva sede
  async initializeSedeProducts(sedeId: string): Promise<void> {
    try {
      console.log('🔄 Inicializando productos para sede:', sedeId);

      // Obtener todos los platos disponibles
      const { data: platos, error: platosError } = await supabase
        .from('platos')
        .select('id');

      if (platosError) {
        console.error('❌ Error obteniendo platos:', platosError);
        throw platosError;
      }

      // Obtener todas las bebidas disponibles
      const { data: bebidas, error: bebidasError } = await supabase
        .from('bebidas')
        .select('id');

      if (bebidasError) {
        console.error('❌ Error obteniendo bebidas:', bebidasError);
        throw bebidasError;
      }

      // Obtener todos los toppings disponibles
      const { data: toppings, error: toppingsError } = await supabase
        .from('toppings')
        .select('id');

      if (toppingsError) {
        console.error('❌ Error obteniendo toppings:', toppingsError);
        throw toppingsError;
      }

      // Insertar relaciones para platos
      if (platos && platos.length > 0) {
        const platosData = platos.map(plato => ({
          sede_id: sedeId,
          plato_id: plato.id,
          available: true,
          price_override: null,
          updated_at: new Date().toISOString()
        }));

        const { error: platosInsertError } = await supabase
          .from('sede_platos')
          .insert(platosData);

        if (platosInsertError) {
          console.error('❌ Error insertando sede_platos:', platosInsertError);
        } else {
          console.log('✅ Platos inicializados:', platos.length);
        }
      }

      // Insertar relaciones para bebidas
      if (bebidas && bebidas.length > 0) {
        const bebidasData = bebidas.map(bebida => ({
          sede_id: sedeId,
          bebida_id: bebida.id,
          available: true,
          price_override: null,
          updated_at: new Date().toISOString()
        }));

        const { error: bebidasInsertError } = await supabase
          .from('sede_bebidas')
          .insert(bebidasData);

        if (bebidasInsertError) {
          console.error('❌ Error insertando sede_bebidas:', bebidasInsertError);
        } else {
          console.log('✅ Bebidas inicializadas:', bebidas.length);
        }
      }

      // Insertar relaciones para toppings
      if (toppings && toppings.length > 0) {
        const toppingsData = toppings.map(topping => ({
          sede_id: sedeId,
          topping_id: topping.id,
          available: true,
          price_override: null,
          updated_at: new Date().toISOString()
        }));

        const { error: toppingsInsertError } = await supabase
          .from('sede_toppings')
          .insert(toppingsData);

        if (toppingsInsertError) {
          console.error('❌ Error insertando sede_toppings:', toppingsInsertError);
        } else {
          console.log('✅ Toppings inicializados:', toppings.length);
        }
      }

      console.log('✅ Productos inicializados para sede exitosamente');
    } catch (error) {
      console.error('❌ Error en initializeSedeProducts:', error);
      // No lanzar error para no fallar la creación de sede
    }
  }

  // Actualizar sede
  async updateSede(sedeId: string, updateData: UpdateSedeData): Promise<Sede> {
    try {
      console.log('🔄 Actualizando sede:', { sedeId, updateData });

      // Verificar que el usuario actual sea admin
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        throw new Error('Usuario no autenticado');
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.user.id)
        .single();

      if (!userProfile || userProfile.role !== 'admin') {
        throw new Error('Solo los administradores pueden actualizar sedes');
      }

      // Si se está cambiando el nombre, verificar que no exista
      if (updateData.name) {
        const { data: existingSede } = await supabase
          .from('sedes')
          .select('id')
          .eq('name', updateData.name)
          .neq('id', sedeId)
          .single();

        if (existingSede) {
          throw new Error('Ya existe una sede con este nombre');
        }
      }

      // Actualizar la sede
      const { data, error } = await supabase
        .from('sedes')
        .update(updateData)
        .eq('id', sedeId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error al actualizar sede:', error);
        throw new Error(`Error al actualizar sede: ${error.message}`);
      }

      console.log('✅ Sede actualizada exitosamente:', data);
      return data;
    } catch (error) {
      console.error('❌ Error en updateSede:', error);
      throw error;
    }
  }

  // Eliminar sede
  async deleteSede(sedeId: string): Promise<void> {
    try {
      console.log('🗑️ Eliminando sede:', sedeId);

      // Verificar que el usuario actual sea admin
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        throw new Error('Usuario no autenticado');
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.user.id)
        .single();

      if (!userProfile || userProfile.role !== 'admin') {
        throw new Error('Solo los administradores pueden eliminar sedes');
      }

      // Verificar si hay usuarios asignados a esta sede
      const { data: usersInSede, error: usersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('sede_id', sedeId)
        .limit(1);

      if (usersError) {
        console.error('❌ Error verificando usuarios en sede:', usersError);
        throw new Error('Error verificando usuarios en la sede');
      }

      if (usersInSede && usersInSede.length > 0) {
        throw new Error('No se puede eliminar la sede porque tiene usuarios asignados');
      }

      // Verificar si hay órdenes asignadas a esta sede
      const { data: ordersInSede, error: ordersError } = await supabase
        .from('ordenes')
        .select('id')
        .eq('sede_id', sedeId)
        .limit(1);

      if (ordersError) {
        console.error('❌ Error verificando órdenes en sede:', ordersError);
        throw new Error('Error verificando órdenes en la sede');
      }

      if (ordersInSede && ordersInSede.length > 0) {
        throw new Error('No se puede eliminar la sede porque tiene órdenes asociadas');
      }

      // Eliminar la sede
      const { error } = await supabase
        .from('sedes')
        .delete()
        .eq('id', sedeId);

      if (error) {
        console.error('❌ Error al eliminar sede:', error);
        throw new Error(`Error al eliminar sede: ${error.message}`);
      }

      console.log('✅ Sede eliminada exitosamente');
    } catch (error) {
      console.error('❌ Error en deleteSede:', error);
      throw error;
    }
  }

  // Función pública para inicializar productos en una sede existente
  async initializeExistingSedeProducts(sedeId: string): Promise<void> {
    try {
      console.log('🔄 Inicializando productos para sede existente:', sedeId);

      // Verificar que el usuario actual sea admin
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) {
        throw new Error('Usuario no autenticado');
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.user.id)
        .single();

      if (!userProfile || userProfile.role !== 'admin') {
        throw new Error('Solo los administradores pueden inicializar productos');
      }

      // Verificar que la sede existe
      const { data: sede, error: sedeError } = await supabase
        .from('sedes')
        .select('id, name')
        .eq('id', sedeId)
        .single();

      if (sedeError || !sede) {
        throw new Error('Sede no encontrada');
      }

      console.log('🏢 Sede encontrada:', sede.name);

      // Llamar a la función privada de inicialización
      await this.initializeSedeProducts(sedeId);

      console.log('✅ Productos inicializados para sede existente exitosamente');
    } catch (error) {
      console.error('❌ Error en initializeExistingSedeProducts:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService(); 