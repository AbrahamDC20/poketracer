const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, getAsync, runAsync, cleanWikiRarity } = require('../../database/db'); // Ajusta la ruta si 'common' o 'db' está en otro sitio

// --- ACTUALIZAR CUENTA ---
router.post('/account/update', (req, res) => {
    const { id_cuenta, tipo, prioridad } = req.body;
    db.run("UPDATE Cuentas SET tipo=?, prioridad=? WHERE id_cuenta=?", [tipo, prioridad, id_cuenta], (err) => res.json({ success: !err, msg: err ? err.message : null }));
});

// --- BORRAR CUENTA ---
router.post('/account/delete', (req, res) => {
    const id = req.body.id_cuenta;
    db.serialize(() => { 
        ["Inventario","Diario","Actividad","Transacciones","Cuentas"].forEach(t => {
            db.run(`DELETE FROM ${t} WHERE id_cuenta=?`, [id]);
        });
    });
    res.json({ success: true });
});

// --- ESTADÍSTICAS ---
router.get('/stats', async (req, res) => {
    try {
        const users = await getAsync("SELECT COUNT(*) as c FROM Cuentas", []);
        const cards = await getAsync("SELECT COUNT(*) as c FROM Cartas", []);
        const active = await getAsync("SELECT COUNT(*) as c FROM Cuentas WHERE ultima_conexion > datetime('now', '-1 day')", []);
        res.json({ totalUsers: users ? users.c : 0, totalCards: cards ? cards.c : 0, activeToday: active ? active.c : 0 });
    } catch (e) { res.json({ totalUsers: 0, totalCards: 0, activeToday: 0 }); }
});

// --- INYECTAR SOBRE (Admin) ---
router.post('/inject_pack', async (req, res) => { 
    try { 
        await runAsync("BEGIN"); 
        const sU = db.prepare("INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, fecha_obtencion) VALUES (?,?,?,1,1,datetime('now')) ON CONFLICT(id_carta, expansion, id_cuenta) DO UPDATE SET cantidad=cantidad+1, desbloqueada=1"); 
        for(const c of req.body.cards) {
            await runAsync(sU, [req.body.id_cuenta, c.id_carta, c.expansion]); 
        }
        sU.finalize(); 
        await runAsync("COMMIT"); 
        res.json({success:true}); 
    } catch(e) { 
        await runAsync("ROLLBACK"); 
        res.json({success:false}); 
    } 
});

// --- ARREGLAR RAREZAS ---
router.post('/fix-rarities', (req, res) => {
    db.all("SELECT * FROM Cartas", (e, r) => { 
        if(!e) db.serialize(() => { 
            db.run("BEGIN"); 
            const s = db.prepare("UPDATE Cartas SET rareza=? WHERE id_carta=? AND expansion=?"); 
            r.forEach(x => { 
                const nr = cleanWikiRarity(x.rareza); 
                if(nr !== x.rareza) s.run(nr, x.id_carta, x.expansion); 
            }); 
            s.finalize(); 
            db.run("COMMIT", () => res.json({success:true})); 
        }); 
    });
});

// --- SINCRONIZAR WIKI (Modificado para Cloud) ---
router.get('/sync_wiki', (req, res) => {
    // En Render/Cloud no podemos escribir archivos ni descargar imágenes al disco persistente.
    // Devolvemos un aviso.
    res.json({ 
        success: false, 
        msg: "⚠️ Función desactivada en la Nube. Usa 'Turso DB Shell' o SQL para añadir cartas." 
    });
});

// --- FORZAR RESET DIARIO ---
router.post('/force_reset', (req, res) => { 
    db.run("UPDATE Diario SET sobres_abiertos=0"); 
    res.json({success:true}); 
});

// --- EXPORTAR DB (Compatible con Cloud) ---
router.get('/export_db', async (req, res) => {
    try {
        const tablas = ['Cuentas', 'Inventario', 'Diario', 'Transacciones'];
        let fullData = {};

        // Recopilamos todos los datos en memoria
        for (const t of tablas) {
            // Usamos db.all para SQLite estándar (si usas Turso driver directo sería execute)
            const rows = await new Promise((resolve, reject) => {
                db.all(`SELECT * FROM ${t}`, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            fullData[t.toLowerCase()] = rows;
        }

        // Enviamos el JSON directamente al navegador
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=respaldo_turso_' + Date.now() + '.json');
        res.send(JSON.stringify(fullData, null, 2));

    } catch (e) {
        console.error(e);
        res.status(500).send("Error exportando DB: " + e.message);
    }
});

// --- IMPORTAR DB (JSON) ---
router.post('/import_db', (req, res) => {
    const d = req.body; 
    if(!d) return res.json({success:false, msg: "No data received"}); 
    
    db.serialize(() => { 
        db.run("BEGIN"); 
        
        // Limpiar tablas actuales
        ["Inventario","Diario","Transacciones","Cuentas"].forEach(t => db.run(`DELETE FROM ${t}`)); // No borramos Cartas para no perder estructura base
        
        // Importar Cuentas
        if(d.cuentas) {
            const sA = db.prepare("INSERT INTO Cuentas (id_cuenta, nombre, tipo, prioridad, password_hash, fichas_cambio, polvos_iris, relojes_arena, notas, tema, avatar_img, racha_dias, ultima_conexion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"); 
            d.cuentas.forEach(c => sA.run(c.id_cuenta,c.nombre,c.tipo,c.prioridad,c.password_hash,c.fichas_cambio,c.polvos_iris,c.relojes_arena,c.notas,c.tema,c.avatar_img,c.racha_dias,c.ultima_conexion)); 
            sA.finalize(); 
        }

        // Importar Inventario
        if(d.inventario) {
            const sI = db.prepare("INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, deseada, fecha_obtencion) VALUES (?,?,?,?,?,?,?)"); 
            d.inventario.forEach(i => sI.run(i.id_cuenta,i.id_carta,i.expansion,i.cantidad,i.desbloqueada,i.deseada,i.fecha_obtencion)); 
            sI.finalize(); 
        }
        
        db.run("COMMIT", (e) => res.json({success: !e, msg: e ? e.message : "Importación correcta"})); 
    }); 
});

// --- BÚSQUEDA INVERSA ---
router.get('/tools/reverse_search', (req, res) => {
    const q = `%${req.query.query}%`;
    db.all(`SELECT c.nombre as usuario, c.avatar_img, i.cantidad, i.desbloqueada, k.nombre as carta FROM Inventario i JOIN Cuentas c ON i.id_cuenta = c.id_cuenta JOIN Cartas k ON i.id_carta = k.id_carta AND i.expansion = k.expansion WHERE (k.nombre LIKE ? OR k.id_carta LIKE ?) AND i.cantidad > 0 ORDER BY i.cantidad DESC`, [q, q], (e,r) => res.json(r||[]));
});

// --- LIMPIEZA DB ---
router.post('/tools/clean_db', (req, res) => {
    db.serialize(() => {
        // Borrar duplicados exactos manteniendo el más antiguo
        db.run(`DELETE FROM Inventario WHERE rowid NOT IN (SELECT MIN(rowid) FROM Inventario GROUP BY id_cuenta, id_carta, expansion)`);
        // Borrar inventario de cartas que ya no existen en la tabla Cartas (ej: expansiones borradas)
        db.run("DELETE FROM Inventario WHERE expansion NOT IN (SELECT DISTINCT expansion FROM Cartas)");
        res.json({success: true, msg: "Base de datos saneada."});
    });
});

// --- RESET PASSWORD ---
router.post('/tools/reset_password', async (req, res) => {
    const hash = await bcrypt.hash("1234", 10);
    db.run("UPDATE Cuentas SET password_hash=? WHERE id_cuenta=?", [hash, req.body.id_cuenta], (e) => res.json({success:!e}));
});

module.exports = router;