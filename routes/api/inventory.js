/* routes/api/inventory.js - VERSIÓN TURSO CLOUD */
const express = require('express');
const router = express.Router();
// Importamos la conexión real (db) y los helpers que creamos en common.js
const { db, getAsync, allAsync } = require('./common');

// ==========================================================================
// OBTENER INVENTARIO (GRID)
// ==========================================================================
router.get('/', async (req, res) => {
    const { id_cuenta, expansion, seccion } = req.query;
    
    // NOTA: Usamos MAX() para evitar duplicados si la base de datos estuviera sucia,
    // y COALESCE para que si no tienes la carta devuelva 0 en vez de null.
    let sql = `
        SELECT c.id_carta, c.nombre, c.rareza, c.expansion, c.tipo, 
               MAX(COALESCE(i.cantidad, 0)) as cantidad, 
               MAX(COALESCE(i.desbloqueada, 0)) as desbloqueada, 
               MAX(COALESCE(i.deseada, 0)) as deseada, 
               MAX(i.fecha_obtencion) as fecha_obtencion 
        FROM Cartas c 
        LEFT JOIN Inventario i ON c.id_carta = i.id_carta AND i.id_cuenta = ? 
        WHERE 1=1 
    `;
    
    let params = [id_cuenta];

    if (expansion && expansion !== 'TODAS') {
        sql += " AND LOWER(c.expansion) = LOWER(?)"; 
        params.push(expansion);
    }
    
    if (seccion === 'Normal') sql += " AND c.seccion='Normal'";
    else if (seccion === 'Especial') sql += " AND c.seccion='Especial'";

    sql += " GROUP BY c.id_carta ORDER BY c.id_carta";

    try {
        const rows = await allAsync(sql, params);
        res.json(rows || []);
    } catch (err) {
        console.error("Error al cargar inventario:", err);
        res.json([]);
    }
});

// ==========================================================================
// ESTADÍSTICAS (GRÁFICAS Y BARRAS)
// ==========================================================================
router.get('/progress', async (req, res) => {
    const { id_cuenta, expansion } = req.query;
    
    let whereClause = "";
    let params = [id_cuenta];

    if (expansion && expansion !== "TODAS") {
        whereClause = " AND LOWER(c.expansion) = LOWER(?)";
        params.push(expansion);
    }

    const sql = `
        SELECT c.rareza, 
               COUNT(DISTINCT c.id_carta) as total, 
               COUNT(DISTINCT CASE WHEN i.cantidad > 0 THEN i.id_carta END) as owned 
        FROM Cartas c 
        LEFT JOIN Inventario i ON c.id_carta = i.id_carta AND i.id_cuenta = ? 
        WHERE 1=1 ${whereClause} 
        GROUP BY c.rareza
    `;

    try {
        const rows = await allAsync(sql, params);
        
        if (!rows || rows.length === 0) {
            return res.json({ total: 0, owned: 0, breakdown: [] });
        }
        
        let t = 0, o = 0;
        const breakdown = rows.map(x => { 
            t += x.total; 
            o += x.owned; 
            return { rareza: x.rareza, total: x.total, owned: x.owned }; 
        });
        
        res.json({ total: t, owned: o, breakdown: breakdown });

    } catch (e) {
        console.error("Error stats:", e);
        res.json({ total: 0, owned: 0, breakdown: [] });
    }
});

router.get('/wishlist', async (req, res) => {
    try {
        const rows = await allAsync("SELECT c.nombre, c.rareza, c.expansion, c.id_carta FROM Inventario i JOIN Cartas c ON i.id_carta=c.id_carta WHERE i.id_cuenta=? AND i.deseada=1 ORDER BY c.expansion, c.nombre", [req.query.id_cuenta]);
        res.json(rows || []);
    } catch (e) {
        res.json([]);
    }
});

// ==========================================================================
// UPDATE BATCH (TRANSACCIÓN COMPLEJA)
// ==========================================================================
router.post('/update_batch', async (req, res) => {
    const { id_cuenta, updates } = req.body;
    
    if (!updates || updates.length === 0) return res.json({ success: true });

    // En Turso, enviamos un array de operaciones (batch) para que sea atómico y rápido
    const batchOps = [];

    try {
        // 1. Primero necesitamos saber las cantidades actuales para registrar el historial
        // Hacemos una consulta masiva para no ir una por una
        for (const u of updates) {
            
            // Paso A: Leer cantidad actual (esto es una lectura extra, pero necesaria para el historial)
            const row = await getAsync("SELECT cantidad FROM Inventario WHERE id_cuenta=? AND id_carta=? AND expansion=?", [id_cuenta, u.id_carta, u.expansion]);
            const prevQty = row ? row.cantidad : 0;

            // Paso B: Si cambia la cantidad, añadimos operación de log al batch
            if (prevQty !== u.cantidad) {
                batchOps.push({
                    sql: "INSERT INTO Transacciones (id_cuenta, id_carta, expansion, cantidad_anterior, cantidad_nueva, motivo, fecha) VALUES (?,?,?,?,?,?, datetime('now'))",
                    args: [id_cuenta, u.id_carta, u.expansion, prevQty, u.cantidad, 'Manual']
                });
            }

            // Paso C: La operación principal de Upsert (Insertar o Actualizar)
            // Turso usa sintaxis estándar de SQLite, así que ON CONFLICT funciona perfecto.
            // Nota: Para la fecha_obtencion, si ya existe mantenemos la que tenía (usando una subconsulta es complejo en batch), 
            // así que simplificamos: Si es nuevo insert ponemos NOW, si es update no la tocamos.
            batchOps.push({
                sql: `INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, deseada, fecha_obtencion) 
                      VALUES (?,?,?,?,?,?, datetime('now')) 
                      ON CONFLICT(id_carta, expansion, id_cuenta) 
                      DO UPDATE SET cantidad=excluded.cantidad, desbloqueada=excluded.desbloqueada, deseada=excluded.deseada`,
                args: [id_cuenta, u.id_carta, u.expansion, u.cantidad, u.desbloqueada, u.deseada]
            });
        }

        // 2. Ejecutar todo el paquete de golpe en la nube
        if (batchOps.length > 0) {
            await db.batch(batchOps);
        }
        
        res.json({ success: true });

    } catch (e) { 
        console.error("Error en update_batch:", e);
        res.json({ success: false, msg: e.message }); 
    }
});

module.exports = router;