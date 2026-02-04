/* routes/api/core.js - VERSIÓN TURSO CLOUD */
const express = require('express');
const router = express.Router();
// 1. Conectamos con la base de datos de Turso
const db = require('../../database/db');
// 2. Importamos solo 'sanitize' de common (evitamos checkDailyReset por ahora)
const { sanitize } = require('./common');

// ==========================================================================
// CARGA DE DATOS BÁSICOS
// ==========================================================================

router.get('/cuentas', async (req, res) => {
    // NOTA: Hemos quitado checkDailyReset temporalmente para que no falle la migración.
    try {
        const result = await db.execute("SELECT id_cuenta, nombre, tipo, prioridad, fichas_cambio, carta_compartida_recibida, notas, polvos_iris, relojes_arena, total_donaciones, tema, avatar_img, racha_dias, ultima_conexion FROM Cuentas ORDER BY prioridad ASC, total_donaciones DESC");
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error cargando cuentas:", err);
        res.json([]);
    }
});

router.get('/expansiones', async (req, res) => {
    try {
        const result = await db.execute("SELECT DISTINCT expansion FROM Cartas");
        
        if (!result.rows || result.rows.length === 0) {
            return res.json(['genetica apex (a1)']);
        }

        // Lógica de limpieza de duplicados (Set)
        const exps = new Set();
        result.rows.forEach(r => { 
            if(r.expansion) exps.add(r.expansion.toLowerCase().trim()); 
        });
        
        res.json(Array.from(exps).sort());
    } catch (err) {
        console.error("Error expansiones:", err);
        res.json(['genetica apex (a1)']);
    }
});

router.get('/config', async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM Configuracion");
        const config = {};
        
        // Procesar JSONs guardados en la config
        if (result.rows) {
            result.rows.forEach(row => { 
                try { 
                    config[row.clave] = JSON.parse(row.valor); 
                } catch (e) { 
                    config[row.clave] = row.valor; 
                } 
            });
        }
        res.json(config);
    } catch (err) {
        console.error("Error config:", err);
        res.json({});
    }
});

// ==========================================================================
// RUTA DEL HISTORIAL
// ==========================================================================
router.get('/transacciones', async (req, res) => {
    const id = req.query.id_cuenta;
    if (!id) return res.json([]);
    
    const sql = `
        SELECT t.id_trans, t.id_cuenta, t.cantidad_anterior, t.cantidad_nueva, t.motivo, t.fecha,
               c.nombre as carta_nombre, c.rareza 
        FROM Transacciones t 
        LEFT JOIN Cartas c ON t.id_carta = c.id_carta AND t.expansion = c.expansion 
        WHERE t.id_cuenta = ? 
        ORDER BY t.fecha DESC LIMIT 50
    `;
    
    try {
        const result = await db.execute({
            sql: sql,
            args: [id]
        });
        res.json(result.rows);
    } catch (err) {
        console.error("Error historial:", err.message);
        res.json([]);
    }
});

// ==========================================================================
// ACTUALIZADORES
// ==========================================================================

router.post('/cuentas/update_theme', async (req, res) => {
    try {
        await db.execute({
            sql: "UPDATE Cuentas SET tema=? WHERE id_cuenta=?",
            args: [req.body.tema, req.body.id_cuenta]
        });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

router.post('/cuentas/update_resources', async (req, res) => {
    try {
        await db.execute({
            sql: "UPDATE Cuentas SET fichas_cambio=?, polvos_iris=?, relojes_arena=?, notas=?, avatar_img=? WHERE id_cuenta=?", 
            args: [
                req.body.fichas, 
                req.body.polvos, 
                req.body.relojes, 
                sanitize(req.body.notas), // Usamos la función sanitize importada
                req.body.avatar || '', 
                req.body.id_cuenta
            ]
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.json({ success: false });
    }
});

// ==========================================================================
// DIARIO / MISIONES
// ==========================================================================

router.get('/diario/:id', async (req, res) => {
    try {
        const result = await db.execute({
            sql: "SELECT * FROM Diario WHERE id_cuenta=?",
            args: [req.params.id]
        });
        res.json(result.rows[0] || {});
    } catch (e) {
        res.json({});
    }
});

router.post('/diario/toggle', async (req, res) => {
    // ATENCIÓN: Validar que req.body.campo sea seguro antes de concatenar (aunque sea admin)
    const validFields = ['mision_1', 'mision_2', 'batalla_diaria', 'sobre_gratis_1', 'sobre_gratis_2', 'gracias_diarias', 'eleccion_magica'];
    if (!validFields.includes(req.body.campo)) return res.json({ success: false });

    try {
        // En SQL dinámico, el nombre de la columna no puede ir en los args (?), 
        // pero como hemos validado arriba con la lista blanca, es seguro concatenar.
        await db.execute({
            sql: `UPDATE Diario SET ${req.body.campo}=?, ultima_actualizacion=datetime('now') WHERE id_cuenta=?`,
            args: [req.body.valor, req.body.id_cuenta]
        });
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.json({ success: false });
    }
});

module.exports = router;