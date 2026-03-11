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

// ==========================================================================
// REGISTRO (CONVERSIÓN DE BIGINT SOLUCIONADA)
// ==========================================================================
router.post('/register', async (req, res) => {
    const userName = req.body.user || req.body.username;
    const userPass = req.body.pass || req.body.password;

    if (!userName || userName.trim() === "") {
        return res.json({ success: false, msg: "Nombre de usuario inválido o vacío." });
    }

    try {
        // 1. Comprobar si el nombre de usuario ya existe
        const checkUser = await db.execute({
            sql: "SELECT id_cuenta FROM Cuentas WHERE nombre = ?",
            args: [userName]
        });

        if (checkUser.rows.length > 0) {
            return res.json({ success: false, msg: "Ese nombre de usuario ya está en uso." });
        }

        // 2. Si el nombre está libre, encriptamos el PIN y creamos la cuenta
        const hash = await bcrypt.hash(userPass, 10);

        const result = await db.execute({
            sql: "INSERT INTO Cuentas (nombre, tipo, prioridad, password_hash) VALUES (?, 'Secundaria', 100, ?)",
            args: [userName, hash]
        });

        // FIX CRÍTICO: Convertir el BigInt a un Número normal de Javascript
        const newId = Number(result.lastInsertRowid);

        // 3. Crear su entrada en el Diario
        await db.execute({
            sql: "INSERT INTO Diario (id_cuenta, ultima_actualizacion) VALUES (?, datetime('now'))",
            args: [newId]
        });

        res.json({ success: true, newId: newId });

    } catch (error) {
        console.error("❌ Error en Registro:", error);
        res.json({ success: false, msg: "Error al crear usuario en la Base de Datos." });
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