/* ==========================================================================
   ROUTER PRINCIPAL (API GATEWAY) - VERSIÓN TURSO CLOUD
   Ubicación: routes/api.js
   Descripción: Recibe el tráfico y lo reparte a los módulos.
   ========================================================================== */
const express = require('express');
const router = express.Router();

// 1. IMPORTAR LA NUEVA BASE DE DATOS (TURSO)
// Asegúrate de que la ruta '../database/db' apunte al archivo que creamos en el paso 3.2
const db = require('../database/db'); 

// 2. Importar los submódulos
// NOTA: Estos archivos también deberán actualizarse para usar "db.execute()" en lugar de "db.run/all"
const authRoutes = require('./api/auth');
const coreRoutes = require('./api/core');
const inventoryRoutes = require('./api/inventory');
const socialRoutes = require('./api/social');
const adminRoutes = require('./api/admin');
const userRoutes = require('./api/user');

// 3. Inicialización de tablas nuevas (Versión Async para Turso)
(async () => {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS Notificaciones (
            id_notificacion INTEGER PRIMARY KEY AUTOINCREMENT, 
            id_cuenta INTEGER, 
            mensaje TEXT, 
            leida INTEGER DEFAULT 0, 
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        console.log("✅ Tabla Notificaciones verificada en Turso");
    } catch (err) {
        console.error("❌ Error inicializando tablas:", err);
    }
})();

// 4. Conectar las rutas (El tráfico se desvía aquí)
router.use('/auth', authRoutes);       // Login, registro
router.use('/', coreRoutes);           // Config, cuentas, diario
router.use('/inventario', inventoryRoutes); // Cargar cartas, editar cantidad
router.use('/stats', inventoryRoutes); // Gráficos
router.use('/social', socialRoutes);   // Tradeos, feed
router.use('/admin', adminRoutes);     // Herramientas de admin
router.use('/user', userRoutes);       // Herramientas de usuario

// 5. Rutas Huérfanas (ACTUALIZADAS A TURSO)
// Historial de transacciones
router.get('/transacciones', async (req, res) => {
    try {
        const result = await db.execute({
            sql: "SELECT t.*, c.nombre as carta_nombre, c.rareza FROM Transacciones t LEFT JOIN Cartas c ON t.id_carta=c.id_carta AND t.expansion=c.expansion WHERE t.id_cuenta=? ORDER BY t.fecha DESC LIMIT 50",
            args: [req.query.id_cuenta]
        });
        res.json(result.rows);
    } catch (e) {
        console.error("Error en transacciones:", e);
        res.status(500).json({ error: e.message });
    }
});

// Datos para el leaderboard (redirige a social)
router.use('/cerebro', socialRoutes); 

module.exports = router;