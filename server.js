require('dotenv').config(); // Cargar variables de entorno al inicio
const express = require('express');
const path = require('path');
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

app.listen(PORT, () => {
    console.log('===========================================================');
    console.log(`🚀 PokéTracker Pro (NUBE) corriendo en: http://localhost:${PORT}`);
    console.log('-----------------------------------------------------------');
    console.log('   ✅ Modo: Híbrido (Local + Turso Cloud)');
    console.log('   ✅ Base de Datos: Conectando vía database.js');
    console.log('   ✅ Estáticos: carpeta /public');
    console.log('===========================================================');
});