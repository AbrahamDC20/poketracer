/* routes/api/auth.js - VERSIÓN TURSO CLOUD */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
// IMPORTANTE: Conectamos con la base de datos de Turso que creamos antes
const db = require('../../database/db');

// ==========================================================================
// LOGIN
// ==========================================================================
router.post('/login', async (req, res) => {
    const { user, pass } = req.body;
    console.log(`🔑 Intento de login (Nube) para: ${user}`);

    try {
        // 1. Buscar usuario
        const result = await db.execute({
            sql: "SELECT * FROM Cuentas WHERE nombre=?",
            args: [user]
        });
        
        const acc = result.rows[0]; // Turso devuelve un array en .rows

        if (!acc) {
            console.warn('⚠️ Usuario no encontrado en Turso');
            return res.json({ success: false, msg: "Usuario no encontrado" });
        }

        // 2. Verificar Admin y Contraseña
        let isAdmin = (acc.nombre === 'Dinama20' || acc.id_cuenta === 1);
        let isValid = false;

        if (acc.password_hash) {
            try {
                isValid = await bcrypt.compare(pass, acc.password_hash);
            } catch (e) {
                // Fallback si el hash es antiguo o inválido
                isValid = (pass === '1234' || pass === '0000');
            }
        } else {
            isValid = (pass === '1234' || pass === '0000');
        }

        // 3. Resultado
        if (isValid) {
            console.log('✅ Acceso concedido.');
            
            // Actualizar última conexión (sin esperar respuesta para ir rápido)
            await db.execute({
                sql: "UPDATE Cuentas SET ultima_conexion=datetime('now') WHERE id_cuenta=?",
                args: [acc.id_cuenta]
            });

            // Preparar objeto usuario seguro (sin password)
            const userSafe = { ...acc };
            delete userSafe.password_hash;
            
            res.json({ success: true, isAdmin, user: userSafe });
        } else {
            console.warn('⛔ Contraseña incorrecta.');
            res.json({ success: false, msg: "PIN Incorrecto" });
        }

    } catch (error) {
        console.error("❌ Error CRÍTICO en Login:", error);
        res.status(500).json({ success: false, msg: "Error de Servidor (Turso)" });
    }
});

// ==========================================================================
// REGISTRO
// ==========================================================================
router.post('/register', async (req, res) => {
    const { username } = req.body;
    if (!username || username.trim() === "") return res.json({ success: false, msg: "Nombre inválido" });

    try {
        const hash = await bcrypt.hash("1234", 10);

        // 1. Insertar Cuenta
        const result = await db.execute({
            sql: "INSERT INTO Cuentas (nombre, tipo, prioridad, password_hash) VALUES (?, 'Secundaria', 100, ?)",
            args: [username, hash]
        });

        // 2. Obtener el ID generado (En Turso se llama lastInsertRowid)
        const newId = result.lastInsertRowid;

        // 3. Crear su entrada en el Diario
        await db.execute({
            sql: "INSERT INTO Diario (id_cuenta, ultima_actualizacion) VALUES (?, datetime('now'))",
            args: [newId]
        });

        res.json({ success: true });

    } catch (error) {
        console.error("❌ Error en Registro:", error);
        res.json({ success: false, msg: "Error al crear usuario" });
    }
});

// ==========================================================================
// CAMBIAR CONTRASEÑA
// ==========================================================================
router.post('/change_password', async (req, res) => {
    const { id_cuenta, oldPass, newPass } = req.body;

    try {
        // 1. Buscar usuario
        const result = await db.execute({
            sql: "SELECT password_hash FROM Cuentas WHERE id_cuenta=?",
            args: [id_cuenta]
        });
        const acc = result.rows[0];

        if (!acc) return res.json({ success: false, msg: "Cuenta no encontrada" });

        // 2. Verificar contraseña antigua
        let isValid = false;
        if (acc.password_hash) isValid = await bcrypt.compare(oldPass, acc.password_hash);
        else if (oldPass === '1234') isValid = true;

        if (!isValid) return res.json({ success: false, msg: "Contraseña actual incorrecta" });

        // 3. Guardar nueva contraseña
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