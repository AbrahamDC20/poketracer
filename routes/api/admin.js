/* routes/api/admin.js - CORREGIDO PARA TURSO / LOCAL */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// IMPORTANTE: Unificamos los imports para usar common.js como en el resto de tu app
const { db, getAsync, runAsync, allAsync } = require('./common');

// NOTA: Si 'cleanWikiRarity' estaba en otro archivo, deberás importarlo aquí.
// const { cleanWikiRarity } = require('../../utils/helpers'); // (Ejemplo)

// --- ACTUALIZAR CUENTA ---
router.post('/account/update', async (req, res) => {
    try {
        const { id_cuenta, tipo, prioridad } = req.body;
        await runAsync("UPDATE Cuentas SET tipo=?, prioridad=? WHERE id_cuenta=?", [tipo, prioridad, id_cuenta]);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, msg: e.message });
    }
});

// --- BORRAR CUENTA ---
router.post('/account/delete', async (req, res) => {
    try {
        const id = req.body.id_cuenta;
        const tablas = ["Inventario", "Diario", "Actividad", "Transacciones", "Cuentas"];
        
        // Creamos un array de operaciones para db.batch()
        const batchOps = tablas.map(t => ({
            sql: `DELETE FROM ${t} WHERE id_cuenta=?`,
            args: [id]
        }));
        
        await db.batch(batchOps);
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, msg: e.message });
    }
});

// --- ESTADÍSTICAS ---
router.get('/stats', async (req, res) => {
    try {
        const users = await getAsync("SELECT COUNT(*) as c FROM Cuentas", []);
        const cards = await getAsync("SELECT COUNT(*) as c FROM Cartas", []);
        const active = await getAsync("SELECT COUNT(*) as c FROM Cuentas WHERE ultima_conexion > datetime('now', '-1 day')", []);
        res.json({ totalUsers: users ? users.c : 0, totalCards: cards ? cards.c : 0, activeToday: active ? active.c : 0 });
    } catch (e) { 
        res.json({ totalUsers: 0, totalCards: 0, activeToday: 0 }); 
    }
});

// --- INYECTAR SOBRE (Admin) ---
router.post('/inject_pack', async (req, res) => { 
    try { 
        // Transformamos el bucle prepare en un db.batch
        const batchOps = req.body.cards.map(c => ({
            sql: "INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, fecha_obtencion) VALUES (?,?,?,1,1,datetime('now')) ON CONFLICT(id_carta, expansion, id_cuenta) DO UPDATE SET cantidad=cantidad+1, desbloqueada=1",
            args: [req.body.id_cuenta, c.id_carta, c.expansion]
        }));
        
        await db.batch(batchOps);
        res.json({success:true}); 
    } catch(e) { 
        res.json({success:false, msg: e.message}); 
    } 
});

// --- ARREGLAR RAREZAS ---
router.post('/fix-rarities', async (req, res) => {
    try {
        const cartas = await allAsync("SELECT * FROM Cartas");
        const batchOps = [];
        
        // Comprobación de seguridad por si cleanWikiRarity no está importado
        if (typeof cleanWikiRarity === 'function') {
            cartas.forEach(x => { 
                const nr = cleanWikiRarity(x.rareza); 
                if(nr !== x.rareza) {
                    batchOps.push({
                        sql: "UPDATE Cartas SET rareza=? WHERE id_carta=? AND expansion=?",
                        args: [nr, x.id_carta, x.expansion]
                    });
                }
            }); 
            if (batchOps.length > 0) await db.batch(batchOps);
        } else {
            console.warn("⚠️ cleanWikiRarity no está definida en admin.js");
        }
        res.json({success:true});
    } catch (e) {
        res.json({success:false, msg: e.message});
    }
});

// --- SINCRONIZAR WIKI ---
router.get('/sync_wiki', (req, res) => {
    res.json({ success: false, msg: "⚠️ Usa la base de datos local para añadir cartas." });
});

// --- FORZAR RESET DIARIO ---
router.post('/force_reset', async (req, res) => { 
    try {
        await runAsync("UPDATE Diario SET sobres_abiertos=0"); 
        res.json({success:true}); 
    } catch (e) {
        res.json({success:false, msg: e.message});
    }
});

// --- EXPORTAR DB ---
router.get('/export_db', async (req, res) => {
    try {
        const tablas = ['Cuentas', 'Inventario', 'Diario', 'Transacciones'];
        let fullData = {};

        for (const t of tablas) {
            fullData[t.toLowerCase()] = await allAsync(`SELECT * FROM ${t}`);
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=respaldo_' + Date.now() + '.json');
        res.send(JSON.stringify(fullData, null, 2));
    } catch (e) {
        console.error(e);
        res.status(500).send("Error exportando DB: " + e.message);
    }
});

// --- IMPORTAR DB (JSON) ---
router.post('/import_db', async (req, res) => {
    const d = req.body; 
    if(!d) return res.json({success:false, msg: "No data received"}); 
    
    try {
        const batchOps = [];
        
        // Limpiar tablas actuales
        ["Inventario","Diario","Transacciones","Cuentas"].forEach(t => {
            batchOps.push({ sql: `DELETE FROM ${t}`, args: [] });
        });
        
        // Importar Cuentas
        if(d.cuentas) {
            d.cuentas.forEach(c => {
                batchOps.push({
                    sql: "INSERT INTO Cuentas (id_cuenta, nombre, tipo, prioridad, password_hash, fichas_cambio, polvos_iris, relojes_arena, notas, tema, avatar_img, racha_dias, ultima_conexion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    args: [c.id_cuenta,c.nombre,c.tipo,c.prioridad,c.password_hash,c.fichas_cambio,c.polvos_iris,c.relojes_arena,c.notas,c.tema,c.avatar_img,c.racha_dias,c.ultima_conexion]
                });
            });
        }

        // Importar Inventario
        if(d.inventario) {
            d.inventario.forEach(i => {
                batchOps.push({
                    sql: "INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, deseada, fecha_obtencion) VALUES (?,?,?,?,?,?,?)",
                    args: [i.id_cuenta,i.id_carta,i.expansion,i.cantidad,i.desbloqueada,i.deseada,i.fecha_obtencion]
                });
            });
        }
        
        await db.batch(batchOps);
        res.json({success: true, msg: "Importación correcta"}); 
    } catch (e) {
        console.error("Error importando:", e);
        res.json({success: false, msg: e.message});
    }
});

// --- BÚSQUEDA INVERSA ---
router.get('/tools/reverse_search', async (req, res) => {
    try {
        const q = `%${req.query.query}%`;
        const r = await allAsync(`SELECT c.nombre as usuario, c.avatar_img, i.cantidad, i.desbloqueada, k.nombre as carta FROM Inventario i JOIN Cuentas c ON i.id_cuenta = c.id_cuenta JOIN Cartas k ON i.id_carta = k.id_carta AND i.expansion = k.expansion WHERE (k.nombre LIKE ? OR k.id_carta LIKE ?) AND i.cantidad > 0 ORDER BY i.cantidad DESC`, [q, q]);
        res.json(r || []);
    } catch(e) { 
        res.json([]); 
    }
});

// --- LIMPIEZA DB ---
router.post('/tools/clean_db', async (req, res) => {
    try {
        const batchOps = [
            { sql: "DELETE FROM Inventario WHERE rowid NOT IN (SELECT MIN(rowid) FROM Inventario GROUP BY id_cuenta, id_carta, expansion)", args: [] },
            { sql: "DELETE FROM Inventario WHERE expansion NOT IN (SELECT DISTINCT expansion FROM Cartas)", args: [] }
        ];
        await db.batch(batchOps);
        res.json({success: true, msg: "Base de datos saneada."});
    } catch(e) {
        res.json({success: false, msg: e.message});
    }
});

// --- RESET PASSWORD ---
router.post('/tools/reset_password', async (req, res) => {
    try {
        const hash = await bcrypt.hash("1234", 10);
        await runAsync("UPDATE Cuentas SET password_hash=? WHERE id_cuenta=?", [hash, req.body.id_cuenta]);
        res.json({success:true});
    } catch(e) {
        res.json({success:false});
    }
});

module.exports = router;