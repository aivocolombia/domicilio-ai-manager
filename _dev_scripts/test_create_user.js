// Script para probar la creación de usuarios en el AdminPanel
const testUserCreation = () => {
  console.log('🧪 Probando creación de usuario en AdminPanel...');
  
  // Datos de ejemplo para crear un usuario
  const testUser = {
    name: 'Juan Pérez Test',
    email: 'juan.test@ajiaco.com',
    password: 'test123456',
    role: 'agent',
    sede_id: 'sede-niza',
    is_active: true
  };
  
  console.log('📋 Datos del usuario de prueba:');
  console.log(JSON.stringify(testUser, null, 2));
  
  console.log('\n✅ Para probar la funcionalidad:');
  console.log('1. Abre la aplicación en el navegador');
  console.log('2. Inicia sesión como administrador');
  console.log('3. Ve al Admin Panel (botón en la esquina superior derecha)');
  console.log('4. Haz clic en "Crear Usuario"');
  console.log('5. Llena el formulario con los datos de arriba');
  console.log('6. Verifica que se crea correctamente');
  
  console.log('\n🔍 Posibles problemas a verificar:');
  console.log('- ¿Las sedes están cargando correctamente en el dropdown?');
  console.log('- ¿El usuario actual tiene permisos de admin?');
  console.log('- ¿La función RPC create_user_profile_only existe en la BD?');
  console.log('- ¿Hay errores en la consola del navegador?');
};

testUserCreation();