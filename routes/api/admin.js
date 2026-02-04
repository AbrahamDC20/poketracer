const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db, getAsync, runAsync, cleanWikiRarity } = require('./common');

router.post('/account/update', (req, res) => {
    const { id_cuenta, tipo, prioridad } = req.body;
    db.run("UPDATE Cuentas SET tipo=?, prioridad=? WHERE id_cuenta=?", [tipo, prioridad, id_cuenta], (err) => res.json({ success: !err, msg: err ? err.message : null }));
});

router.post('/account/delete', (req, res) => {
    const id = req.body.id_cuenta;
    db.serialize(() => { ["Inventario","Diario","Actividad","Transacciones","Cuentas"].forEach(t=>db.run(`DELETE FROM ${t} WHERE id_cuenta=?`,[id])); });
    res.json({ success: true });
});

router.get('/stats', async (req, res) => {
    try {
        const users = await getAsync("SELECT COUNT(*) as c FROM Cuentas", []);
        const cards = await getAsync("SELECT COUNT(*) as c FROM Cartas", []);
        const active = await getAsync("SELECT COUNT(*) as c FROM Cuentas WHERE ultima_conexion > datetime('now', '-1 day')", []);
        res.json({ totalUsers: users ? users.c : 0, totalCards: cards ? cards.c : 0, activeToday: active ? active.c : 0 });
    } catch (e) { res.json({ totalUsers: 0, totalCards: 0, activeToday: 0 }); }
});

router.post('/inject_pack', async (req, res) => { try{ await runAsync("BEGIN"); const sU=db.prepare("INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, fecha_obtencion) VALUES (?,?,?,1,1,datetime('now')) ON CONFLICT(id_carta, expansion, id_cuenta) DO UPDATE SET cantidad=cantidad+1, desbloqueada=1"); for(const c of req.body.cards) await runAsync(sU,[req.body.id_cuenta,c.id_carta,c.expansion]); sU.finalize(); await runAsync("COMMIT"); res.json({success:true}); }catch(e){ await runAsync("ROLLBACK"); res.json({success:false}); } });
router.post('/fix-rarities', (req, res) => db.all("SELECT * FROM Cartas", (e,r)=>{ if(!e) db.serialize(()=>{ db.run("BEGIN"); const s=db.prepare("UPDATE Cartas SET rareza=? WHERE id_carta=? AND expansion=?"); r.forEach(x=>{ const nr=cleanWikiRarity(x.rareza); if(nr!==x.rareza) s.run(nr,x.id_carta,x.expansion); }); s.finalize(); db.run("COMMIT", ()=>res.json({success:true})); }); }));
router.post('/sync-wiki', (req, res) => { const wd=path.join(__dirname,'..','..','Listas_Wiki'); if(!fs.existsSync(wd)) return res.json({success:false}); const ci=[]; try{ fs.readdirSync(wd).filter(f=>f.endsWith('.txt')).forEach(f=>{ const en=f.replace('.txt','').replace(/_/g,' '); const l=fs.readFileSync(path.join(wd,f),'utf-8').split('\n'); l.forEach(li=>{ const p=li.split('||').map(z=>z.trim()); if(p.length>4) ci.push({id:p[0],n:p[1],r:cleanWikiRarity(p[3]),e:en,s:(p[3].includes("Estrella")||p[3].includes("Corona"))?"Especial":"Normal",b:p[4],t:p[2],o:p[5]?p[5].trim():null}); }); }); db.serialize(()=>{ db.run("BEGIN"); const s=db.prepare("INSERT OR REPLACE INTO Cartas (id_carta, nombre, rareza, expansion, seccion, sobre, tipo, id_carta_origen) VALUES (?,?,?,?,?,?,?,?)"); ci.forEach(c=>s.run(c.id,c.n,c.r,c.e,c.s,c.b,c.t,c.o)); s.finalize(); db.run("INSERT OR IGNORE INTO Inventario (id_carta, expansion, id_cuenta) SELECT c.id_carta, c.expansion, cu.id_cuenta FROM Cartas c CROSS JOIN Cuentas cu"); db.run("COMMIT",(e)=>res.json({success:!e})); }); }catch(e){ res.json({success:false}); } });
router.post('/force_reset', (req, res) => { db.run("UPDATE Diario SET sobres_abiertos=0"); res.json({success:true}); });
router.get('/backup/export', (req, res) => { const b={}; db.serialize(()=>{ ["Cuentas","Cartas","Inventario","Diario","Transacciones"].forEach(t=>db.all(`SELECT * FROM ${t}`,(e,r)=>b[t.toLowerCase()]=r)); setTimeout(()=>{res.setHeader('Content-disposition','attachment; filename=bk.json'); res.send(JSON.stringify(b,null,2));},500); }); });
router.post('/backup/import', (req, res) => { const d=req.body; if(!d) return res.json({success:false}); db.serialize(()=>{ db.run("BEGIN"); ["Cuentas","Cartas","Inventario","Diario","Transacciones"].forEach(t=>db.run(`DELETE FROM ${t}`)); const sA=db.prepare("INSERT INTO Cuentas (id_cuenta, nombre, tipo, prioridad, password_hash, fichas_cambio, polvos_iris, relojes_arena, notas, tema, avatar_img, racha_dias, ultima_conexion) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"); if(d.cuentas) d.cuentas.forEach(c=>sA.run(c.id_cuenta,c.nombre,c.tipo,c.prioridad,c.password_hash,c.fichas_cambio,c.polvos_iris,c.relojes_arena,c.notas,c.tema,c.avatar_img,c.racha_dias,c.ultima_conexion)); sA.finalize(); const sI=db.prepare("INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, deseada, fecha_obtencion) VALUES (?,?,?,?,?,?,?)"); if(d.inventario) d.inventario.forEach(i=>sI.run(i.id_cuenta,i.id_carta,i.expansion,i.cantidad,i.desbloqueada,i.deseada,i.fecha_obtencion)); sI.finalize(); db.run("COMMIT",(e)=>res.json({success:!e})); }); });

router.get('/tools/reverse_search', (req, res) => {
    const q = `%${req.query.query}%`;
    db.all(`SELECT c.nombre as usuario, c.avatar_img, i.cantidad, i.desbloqueada, k.nombre as carta FROM Inventario i JOIN Cuentas c ON i.id_cuenta = c.id_cuenta JOIN Cartas k ON i.id_carta = k.id_carta AND i.expansion = k.expansion WHERE (k.nombre LIKE ? OR k.id_carta LIKE ?) AND i.cantidad > 0 ORDER BY i.cantidad DESC`, [q, q], (e,r) => res.json(r||[]));
});
router.post('/tools/clean_db', (req, res) => {
    db.serialize(() => {
        db.run(`DELETE FROM Inventario WHERE rowid NOT IN (SELECT MIN(rowid) FROM Inventario GROUP BY id_cuenta, id_carta, expansion)`);
        db.run("DELETE FROM Inventario WHERE expansion NOT IN (SELECT DISTINCT expansion FROM Cartas)");
        res.json({success: true, msg: "Base de datos saneada."});
    });
});
router.post('/tools/reset_password', async (req, res) => {
    const hash = await bcrypt.hash("1234", 10);
    db.run("UPDATE Cuentas SET password_hash=? WHERE id_cuenta=?", [hash, req.body.id_cuenta], (e) => res.json({success:!e}));
});

module.exports = router;