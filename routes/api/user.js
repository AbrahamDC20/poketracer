/* routes/api/user.js - CORREGIDO PARA TURSO / LOCAL */
const express = require('express');
const router = express.Router();
// Añadimos runAsync a los imports
const { db, runAsync } = require('./common');

router.post('/tools/auto_wishlist', async (req, res) => {
    try {
        await runAsync("UPDATE Inventario SET deseada=1 WHERE id_cuenta=? AND cantidad=0", [req.body.id_cuenta]);
        res.json({success: true});
    } catch (e) {
        res.json({success: false, msg: e.message});
    }
});

router.post('/tools/import_text', async (req, res) => {
    try {
        const { id_cuenta, text } = req.body;
        const lines = text.split('\n');
        let count = 0;
        
        const batchOps = [];
        
        lines.forEach(l => {
            const p = l.split(',');
            if (p.length >= 3) { 
                batchOps.push({
                    sql: "UPDATE Inventario SET cantidad=? WHERE id_cuenta=? AND id_carta=(SELECT id_carta FROM Cartas WHERE nombre=? AND expansion=?)",
                    args: [parseInt(p[2].trim()), id_cuenta, p[0].trim(), p[1].trim()]
                });
                count++; 
            }
        });
        
        if (batchOps.length > 0) {
            await db.batch(batchOps);
        }
        
        res.json({success: true, count: count});
    } catch (e) {
        res.json({success: false, msg: e.message});
    }
});

module.exports = router;