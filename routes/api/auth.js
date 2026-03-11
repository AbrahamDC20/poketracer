/* routes/api/auth.js - VERSIÓN LOCAL LAN */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../database/db');

router.post('/login', async (req, res) => {
    const { user, pass } = req.body;
    console.log(`🔑 Intento de login para: ${user}`);

    try {
        const result = await db.execute({
            sql: "SELECT * FROM Cuentas WHERE nombre=?",
            args: [user]
        });
        
        const acc = result.rows[0];

        if (!acc) {
            console.warn('⚠️ Usuario no encontrado');
            return res.json({ success: false, msg: "Usuario no encontrado" });
        }

        let isAdmin = (acc.nombre === 'Dinama20' || acc.id_cuenta === 1);
        let isValid = false;

        if (acc.password_hash) {
            try {
                isValid = await bcrypt.compare(pass, acc.password_hash);
            } catch (e) {
                isValid = (pass === '1234' || pass === '0000');
            }
        } else {
            isValid = (pass === '1234' || pass === '0000');
        }

        if (isValid) {
            console.log('✅ Acceso concedido.');
            await db.execute({
                sql: "UPDATE Cuentas SET ultima_conexion=datetime('now') WHERE id_cuenta=?",
                args: [acc.id_cuenta]
            });

            const userSafe = { ...acc };
            delete userSafe.password_hash;
            
            res.json({ success: true, isAdmin, user: userSafe });
        } else {
            console.warn('⛔ Contraseña incorrecta.');
            res.json({ success: false, msg: "PIN Incorrecto" });
        }

    } catch (error) {
        console.error("❌ Error CRÍTICO en Login:", error);
        res.status(500).json({ success: false, msg: "Error de Servidor" });
    }
});

router.post('/register', async (req, res) => {
    // FIX: Leemos user y pass en lugar de username
    const { user, pass } = req.body;
    if (!user || user.trim() === "") return res.json({ success: false, msg: "Nombre inválido" });

    try {
        // FIX: Usamos la contraseña real que introduce el usuario
        const hash = await bcrypt.hash(pass, 10);

        const result = await db.execute({
            sql: "INSERT INTO Cuentas (nombre, tipo, prioridad, password_hash) VALUES (?, 'Secundaria', 100, ?)",
            args: [user, hash]
        });

        const newId = result.lastInsertRowid;

        await db.execute({
            sql: "INSERT INTO Diario (id_cuenta, ultima_actualizacion) VALUES (?, datetime('now'))",
            args: [newId]
        });

        res.json({ success: true, newId: newId });

    } catch (error) {
        console.error("❌ Error en Registro:", error);
        res.json({ success: false, msg: "Error al crear usuario" });
    }
});

router.post('/change_password', async (req, res) => {
    const { id_cuenta, oldPass, newPass } = req.body;

    try {
        const result = await db.execute({
            sql: "SELECT password_hash FROM Cuentas WHERE id_cuenta=?",
            args: [id_cuenta]
        });
        const acc = result.rows[0];

        if (!acc) return res.json({ success: false, msg: "Cuenta no encontrada" });

        let isValid = false;
        if (acc.password_hash) isValid = await bcrypt.compare(oldPass, acc.password_hash);
        else if (oldPass === '1234') isValid = true;

        if (!isValid) return res.json({ success: false, msg: "Contraseña actual incorrecta" });

        const hash = await bcrypt.hash(newPass, 10);
        await db.execute({
            sql: "UPDATE Cuentas SET password_hash=? WHERE id_cuenta=?",
            args: [hash, id_cuenta]
        });

        res.json({ success: true });

    } catch (error) {
        console.error("❌ Error al cambiar password:", error);
        res.json({ success: false });
    }
});

module.exports = router;