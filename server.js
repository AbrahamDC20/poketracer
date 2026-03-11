require('dotenv').config(); // Cargar variables de entorno al inicio
const express = require('express');
const path = require('path');
const os = require('os'); // Añadido para detectar tu IP del WiFi
const apiRoutes = require('./routes/api');

// Inicializar la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================================================
// 1. MIDDLEWARES (Configuración del servidor)
// ==========================================================================

// Configuración de límites de carga (50MB para backups y avatares)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================================
// 2. RUTAS
// ==========================================================================

// Conectar las rutas de la API
app.use('/api', apiRoutes);

// Ruta "Catch-All" (Para SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================================================
// 3. INICIO DEL SERVIDOR
// ==========================================================================

// Función para obtener la IP de tu red local
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// 0.0.0.0 es clave para que dispositivos de la misma red WiFi puedan acceder
app.listen(PORT, '0.0.0.0', () => {
    const ip = getLocalIP();
    console.log('===========================================================');
    console.log(`🚀 PokéTracker Pro (LOCAL) corriendo en tu red`);
    console.log(`💻 Para entrar desde este PC: http://localhost:${PORT}`);
    console.log(`📱 Para entrar desde tu móvil: http://${ip}:${PORT}`);
    console.log('-----------------------------------------------------------');
    console.log('   ✅ Modo: 100% Local (Red WiFi)');
    console.log('   ✅ Base de Datos: Archivo local (.db)');
    console.log('===========================================================');
});