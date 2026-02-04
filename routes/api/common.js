/* routes/api/common.js - VERSIÓN TURSO CLOUD */
const path = require('path');

// 1. Cargar la DB (El cliente de Turso que creamos al principio)
// Nota: Ahora db es un CLIENTE DE TURSO, no de SQLite3
const db = require('../../database/db');

console.log('🔌 Common.js conectado a Turso Cloud');

// --- CONSTANTES DE NEGOCIO ---
const TRADE_COSTS = {
    "1 Rombo": 0, "2 Rombos": 0, "3 Rombos": 1200, "4 Rombos": 5000,
    "1 Estrella": 4000, "2 Estrellas": 25000, "Shiny 1 Estrella": 10000,
    "Shiny 2 Estrellas": 30000, "3 Estrellas": null, "Corona": null
};

const TRADE_COMPATIBILITY = {
    "1 Rombo": ["1 Rombo"], "2 Rombos": ["2 Rombos"], "3 Rombos": ["3 Rombos"], "4 Rombos": ["4 Rombos"],
    "1 Estrella": ["1 Estrella"], "2 Estrellas": ["2 Estrellas"], 
    "Shiny 1 Estrella": ["Shiny 1 Estrella"], "Shiny 2 Estrellas": ["Shiny 2 Estrellas"], 
    "3 Estrellas": [], "Corona": []
};

// --- HELPERS ---

function getCost(rarity) {
    return (TRADE_COSTS[rarity] !== undefined) ? TRADE_COSTS[rarity] : null;
}

function getTradableStock(userType, rarity, quantity) {
    if (quantity <= 0) return 0;
    
    // Cartas muy raras: No se bloquean, se pueden tradear todas
    const EXCEPTIONS = ["2 Estrellas", "Shiny 1 Estrella", "Shiny 2 Estrellas"];
    if (EXCEPTIONS.includes(rarity)) return quantity;

    // Cuentas secundarias: Tradean todo
    if (userType === 'Secundaria') return quantity; 
    
    // Cuentas principales: Se guardan 1 copia
    return Math.max(0, quantity - 1); 
}

function sanitize(str) {
    return str ? str.toString().replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}

// --- ADAPTADORES DE BASE DE DATOS (EL TRUCO PARA TURSO) ---
// Estas funciones traducen el estilo antiguo al estilo nuevo de la nube

const getAsync = async (sql, params = []) => {
    try {
        const result = await db.execute({ sql, args: params });
        return result.rows[0]; // Devuelve el primer resultado
    } catch (e) {
        console.error("❌ Error en getAsync:", e.message);
        throw e;
    }
};

const allAsync = async (sql, params = []) => {
    try {
        const result = await db.execute({ sql, args: params });
        return result.rows; // Devuelve todos los resultados (array)
    } catch (e) {
        console.error("❌ Error en allAsync:", e.message);
        throw e;
    }
};

const runAsync = async (sql, params = []) => {
    try {
        const result = await db.execute({ sql, args: params });
        // Mapeamos para que se parezca a lo que devolvía sqlite3 antiguo
        return { 
            lastID: result.lastInsertRowid, // Para obtener IDs de nuevos inserts
            changes: result.rowsAffected    // Para saber cuántas filas cambiaron
        };
    } catch (e) {
        console.error("❌ Error en runAsync:", e.message);
        throw e;
    }
};

// --- RESET DIARIO (Actualizado para Turso) ---
// Comprueba si ha pasado un día y resetea las misiones
async function checkDailyReset(id_cuenta, callback) {
    if (!id_cuenta) {
        if(callback) callback();
        return;
    }

    try {
        // 1. Obtener fecha del diario
        const row = await getAsync("SELECT ultima_actualizacion FROM Diario WHERE id_cuenta=?", [id_cuenta]);
        
        if (!row) {
            if(callback) callback();
            return;
        }

        const lastDate = new Date(row.ultima_actualizacion);
        const now = new Date();
        
        // Reset a las 06:00 AM (hora típica de juegos gacha) o medianoche
        // Simplificado: Si el día del mes es diferente, reseteamos.
        if (lastDate.getDate() !== now.getDate() || lastDate.getMonth() !== now.getMonth()) {
            console.log(`🔄 Reset diario detectado para cuenta ${id_cuenta}`);
            await runAsync(`UPDATE Diario SET 
                mision_1=0, mision_2=0, 
                batalla_diaria=0, 
                sobre_gratis_1=0, sobre_gratis_2=0, 
                gracias_diarias=0, 
                eleccion_magica=0, 
                ultima_actualizacion=datetime('now') 
                WHERE id_cuenta=?`, [id_cuenta]);
        }
        
        if(callback) callback();

    } catch (e) {
        console.error("Error en checkDailyReset:", e);
        // Ejecutamos el callback igual para no bloquear la app
        if(callback) callback(); 
    }
}

module.exports = {
    db, sanitize, getCost, getTradableStock,
    getAsync, allAsync, runAsync, checkDailyReset,
    TRADE_COSTS, TRADE_COMPATIBILITY
};