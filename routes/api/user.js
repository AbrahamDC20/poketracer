const express = require('express');
const router = express.Router();
const { db } = require('./common');

router.post('/tools/auto_wishlist', (req, res) => {
    db.run("UPDATE Inventario SET deseada=1 WHERE id_cuenta=? AND cantidad=0", [req.body.id_cuenta], (e) => res.json({success:!e}));
});

router.post('/tools/import_text', (req, res) => {
    const { id_cuenta, text } = req.body;
    const lines = text.split('\n');
    let count = 0;
    db.serialize(() => {
        db.run("BEGIN");
        const stmt = db.prepare("UPDATE Inventario SET cantidad=? WHERE id_cuenta=? AND id_carta=(SELECT id_carta FROM Cartas WHERE nombre=? AND expansion=?)");
        lines.forEach(l => {
            const p = l.split(',');
            if(p.length >= 3) { stmt.run(parseInt(p[2].trim()), id_cuenta, p[0].trim(), p[1].trim()); count++; }
        });
        stmt.finalize();
        db.run("COMMIT");
    });
    res.json({success: true, count: count});
});

module.exports = router;