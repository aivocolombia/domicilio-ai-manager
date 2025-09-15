import { supabase } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  nickname: string;
  display_name: string;
  role: 'agent' | 'admin_punto' | 'admin_global';
  sede_id: string;
  sede_name?: string;
  is_active: boolean;
}

export interface LoginResult {
  user?: AuthUser;
  error?: string;
}

export class CustomAuthService {
  private currentUser: AuthUser | null = null;
  private sessionToken: string | null = null;

  // Autenticar usuario con nickname y password
  async signIn(nickname: string, password: string): Promise<LoginResult> {
    try {
      // Limpiar espacios en blanco
      const cleanNickname = nickname.trim();
      const cleanPassword = password.trim();
      
      console.log('🔐 Intentando autenticar usuario:', cleanNickname);

      // Buscar usuario por nickname y verificar contraseña usando PostgreSQL crypt
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nickname,
          display_name,
          role,
          sede_id,
          password_hash,
          is_active,
          sedes!inner(name)
        `)
        .eq('nickname', cleanNickname)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('❌ Error buscando usuario:', error);
        return { error: 'Nickname o contraseña incorrectos' };
      }

      if (!data) {
        console.log('❌ Usuario no encontrado:', cleanNickname);
        return { error: 'Nickname o contraseña incorrectos' };
      }

      // Verificar contraseña usando la función crypt de PostgreSQL
      const { data: passwordCheck, error: passwordError } = await supabase.rpc('verify_password', {
        password: cleanPassword,
        hash: data.password_hash
      });

      // Si no existe la función verify_password, crear verificación alternativa
      if (passwordError && passwordError.message.includes('Could not find the function')) {
        console.log('ℹ️ Función verify_password no existe, usando verificación directa');
        // Crear una verificación temporal usando una query que devuelva el usuario solo si la password coincide
        const { data: verifyData, error: verifyError } = await supabase
          .from('profiles') 
          .select('id')
          .eq('nickname', cleanNickname)
          .eq('is_active', true)
          .filter('password_hash', 'eq', `crypt('${cleanPassword}', password_hash)`)
          .single();
          
        if (verifyError || !verifyData) {
          console.log('❌ Contraseña incorrecta para:', cleanNickname);
          return { error: 'Nickname o contraseña incorrectos' };
        }
      } else if (passwordError) {
        console.error('❌ Error verificando contraseña:', passwordError);
        return { error: 'Error de autenticación: ' + passwordError.message };
      } else if (!passwordCheck) {
        console.log('❌ Contraseña incorrecta para:', cleanNickname);
        return { error: 'Nickname o contraseña incorrectos' };
      }

      // Usuario autenticado exitosamente
      const user: AuthUser = {
        id: data.id,
        nickname: data.nickname,
        display_name: data.display_name,
        role: data.role,
        sede_id: data.sede_id,
        sede_name: data.sedes?.name || 'Sede Desconocida',
        is_active: data.is_active ?? true
      };

      // Simular un token de sesión (puedes usar JWT real si lo prefieres)
      this.sessionToken = btoa(JSON.stringify({
        user_id: user.id,
        nickname: user.nickname,
        role: user.role,
        sede_id: user.sede_id,
        expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
      }));

      this.currentUser = user;
      
      // Guardar en localStorage
      localStorage.setItem('custom_auth_token', this.sessionToken);
      localStorage.setItem('custom_auth_user', JSON.stringify(user));

      console.log('✅ Autenticación exitosa:', user.nickname, '-', user.role);
      return { user };

    } catch (err) {
      console.error('❌ Error inesperado en signIn:', err);
      return { error: 'Error inesperado durante la autenticación' };
    }
  }

  // Cerrar sesión
  async signOut(): Promise<void> {
    this.currentUser = null;
    this.sessionToken = null;
    localStorage.removeItem('custom_auth_token');
    localStorage.removeItem('custom_auth_user');
    console.log('✅ Sesión cerrada');
  }

  // Obtener usuario actual
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  // Verificar si el usuario está autenticado
  isAuthenticated(): boolean {
    return this.currentUser !== null && this.sessionToken !== null;
  }

  // Restaurar sesión desde localStorage
  async restoreSession(): Promise<AuthUser | null> {
    try {
      const token = localStorage.getItem('custom_auth_token');
      const userStr = localStorage.getItem('custom_auth_user');

      if (!token || !userStr) {
        return null;
      }

      // Verificar si el token ha expirado
      const tokenData = JSON.parse(atob(token));
      if (Date.now() > tokenData.expires_at) {
        console.log('⚠️ Token expirado, limpiando sesión');
        await this.signOut();
        return null;
      }

      // Restaurar usuario
      const user: AuthUser = JSON.parse(userStr);
      this.currentUser = user;
      this.sessionToken = token;

      console.log('✅ Sesión restaurada:', user.nickname);
      return user;

    } catch (err) {
      console.error('❌ Error restaurando sesión:', err);
      await this.signOut();
      return null;
    }
  }

  // Crear nuevo usuario (solo para admins)
  async createUser(userData: {
    nickname: string;
    password: string;
    display_name: string;
    role: 'agent' | 'admin_punto' | 'admin_global';
    sede_id: string;
  }): Promise<{success?: boolean; error?: string}> {
    try {
      if (!this.isAuthenticated()) {
        return { error: 'No autenticado' };
      }

      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        return { error: 'Usuario no encontrado' };
      }

      console.log('👥 Creando usuario:', userData.nickname, 'por:', currentUser.nickname);

      // Llamar función de creación de usuario
      const { data, error } = await supabase.rpc('create_user_with_nickname', {
        p_nickname: userData.nickname,
        p_password: userData.password,
        p_display_name: userData.display_name,
        p_role: userData.role,
        p_sede_id: userData.sede_id,
        p_caller_id: currentUser.id
      });

      if (error) {
        console.error('❌ Error creando usuario:', error);
        return { error: error.message };
      }

      console.log('✅ Usuario creado exitosamente:', data);
      return { success: true };

    } catch (err) {
      console.error('❌ Error inesperado creando usuario:', err);
      return { error: 'Error inesperado al crear usuario' };
    }
  }

  // Verificar permisos según rol
  canManageUsers(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin_global' || user?.role === 'admin_punto';
  }

  canManageAllSedes(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin_global';
  }

  canAccessAdminPanel(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin_global' || user?.role === 'admin_punto';
  }

  // Obtener sede del usuario
  getUserSedeId(): string | null {
    const user = this.getCurrentUser();
    return user?.sede_id || null;
  }
}

// Instancia singleton
export const customAuthService = new CustomAuthService();