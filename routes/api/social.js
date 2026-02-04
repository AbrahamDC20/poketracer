/* routes/api/social.js - VERSIÓN TURSO CLOUD */
const express = require('express');
const router = express.Router();
// Importamos db (cliente Turso) y los wrappers que creamos en common.js
const { db, getAsync, allAsync, getCost, getTradableStock, TRADE_COMPATIBILITY } = require('./common');

// ==========================================================================
// EMPAREJAMIENTO INTELIGENTE (SMART MATCHES)
// ==========================================================================
router.get('/smart-matches', async (req, res) => {
    const { id_usuario } = req.query;

    try {
        // Usamos los wrappers async/await que definimos en common.js
        const meUser = await getAsync("SELECT * FROM Cuentas WHERE id_cuenta=?", [id_usuario]);
        
        // 1. Cargar el resto de usuarios
        const allUsersRaw = await allAsync(
            "SELECT id_cuenta, nombre, avatar_img, tipo, prioridad FROM Cuentas WHERE id_cuenta != ?", 
            [id_usuario]
        );
        
        // 2. Cargar mi Wishlist
        const myWishlistRaw = await allAsync("SELECT id_carta FROM Inventario WHERE id_cuenta=? AND deseada=1", [id_usuario]);
        const myWishlistSet = new Set(myWishlistRaw.map(r => String(r.id_carta)));

        // 3. Cargar todo el stock disponible del servidor
        const allStockRaw = await allAsync(`
            SELECT i.id_cuenta, i.id_carta, i.cantidad, i.deseada, c.nombre, c.rareza, c.expansion
            FROM Inventario i
            JOIN Cartas c ON i.id_carta = c.id_carta AND i.expansion = c.expansion
            WHERE i.cantidad > 0
        `);

        // 4. Procesar datos en memoria (Lógica JS igual que antes)
        const users = {};
        allUsersRaw.forEach(u => {
            users[u.id_cuenta] = {
                info: { id: u.id_cuenta, name: u.nombre, avatar: u.avatar_img, type: u.tipo, prio: u.prioridad },
                owned: new Set(), stock: []
            };
        });

        const myOwned = new Set();
        const myStock = [];

        allStockRaw.forEach(row => {
            const cardIdStr = String(row.id_carta);
            if (row.id_cuenta == id_usuario) {
                myOwned.add(cardIdStr);
                myStock.push(row);
            } else {
                if (users[row.id_cuenta]) {
                    users[row.id_cuenta].owned.add(cardIdStr);
                    users[row.id_cuenta].stock.push(row);
                }
            }
        });

        const shares = [];
        const trades = [];
        const ALLOWED_GIFT_RARITIES = ["1 Rombo", "2 Rombos", "3 Rombos", "4 Rombos"];

        // --- LÓGICA DE REGALOS (GIFTS) ---
        if (meUser && meUser.nombre !== 'Dinama20') {
            myStock.forEach(myCard => {
                if (!ALLOWED_GIFT_RARITIES.includes(myCard.rareza)) return;

                let stockToShare = 0;
                const qty = parseInt(myCard.cantidad, 10);
                
                if (meUser.tipo === 'Principal') stockToShare = Math.max(0, qty - 1);
                else stockToShare = qty;

                if (stockToShare > 0) {
                    const cardIdStr = String(myCard.id_carta);
                    const candidates = Object.values(users).filter(u => !u.owned.has(cardIdStr));

                    candidates.forEach(cand => {
                        shares.push({
                            card: myCard,
                            myQty: qty,
                            targetUser: cand.info
                        });
                    });
                }
            });
        }

        // --- LÓGICA DE INTERCAMBIOS (TRADES) ---
        Object.values(users).forEach(sourceUser => {
            sourceUser.stock.forEach(theirCard => {
                if (!myOwned.has(String(theirCard.id_carta))) {
                    const theirRealStock = getTradableStock(sourceUser.info.type, theirCard.rareza, theirCard.cantidad);
                    const cost = getCost(theirCard.rareza);

                    if (theirRealStock > 0 && cost !== null) {
                        const compatible = TRADE_COMPATIBILITY[theirCard.rareza] || [];
                        const myBestOffer = myStock
                            .filter(myC => 
                                compatible.includes(myC.rareza) && 
                                !sourceUser.owned.has(String(myC.id_carta)) && 
                                getTradableStock(meUser.tipo, myC.rareza, myC.cantidad) > 0
                            )
                            .sort((a,b) => b.cantidad - a.cantidad)[0];

                        if (myBestOffer) {
                            const isMyWish = myWishlistSet.has(String(theirCard.id_carta));
                            const cardWithMyWish = { ...theirCard, deseada: isMyWish ? 1 : 0 };

                            trades.push({
                                get: cardWithMyWish, 
                                give: myBestOffer,
                                partner: sourceUser.info,
                                cost: cost,
                                rarity: theirCard.rareza,
                                priorityScore: sourceUser.info.prio
                            });
                        }
                    }
                }
            });
        });

        // Filtrado final
        const uniqueTrades = new Map();
        trades.forEach(t => {
            const key = t.get.id_carta;
            const existing = uniqueTrades.get(key);
            
            if (t.partner.name === 'Dinama20') {
                 uniqueTrades.set(key, t);
            } else if (!existing) {
                 uniqueTrades.set(key, t);
            } else if (existing.partner.name !== 'Dinama20') {
                 if (t.priorityScore > existing.priorityScore) uniqueTrades.set(key, t);
            }
        });

        // Ordenamiento
        const sortGifts = (a, b) => {
            const userA = a.targetUser; const userB = b.targetUser;
            if (!userA || !userB) return 0;
            if (userA.name === 'Dinama20') return -1;
            if (userB.name === 'Dinama20') return 1;
            return (userA.prio || 999) - (userB.prio || 999);
        };

        const sortTrades = (a, b) => {
            const userA = a.partner; const userB = b.partner;
            if (!userA || !userB) return 0;
            if (userA.name === 'Dinama20') return -1;
            if (userB.name === 'Dinama20') return 1;
            return (userB.prio || 0) - (userA.prio || 0);
        };

        res.json({
            shares: shares.sort(sortGifts),
            trades: Array.from(uniqueTrades.values()).sort(sortTrades)
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// ==========================================================================
// EJECUCIÓN DE ACCIONES (CON BATCH TRANSACTION PARA TURSO)
// ==========================================================================

router.post('/execute_trade', async (req, res) => {
    const { id_origen, id_destino, give_id, get_id, exp_give, exp_get, rarity } = req.body;
    const cost = getCost(rarity); 
    if (cost === null) return res.json({ success: false });

    try { 
        // En Turso, usamos un batch (lote) para asegurar que todo se hace junto
        const batch = [];

        // 1. Cobrar costes (SQL dinámico para restar)
        batch.push({ sql: "UPDATE Cuentas SET fichas_cambio=fichas_cambio-1, polvos_iris=polvos_iris-? WHERE id_cuenta=?", args: [cost, id_origen] });
        batch.push({ sql: "UPDATE Cuentas SET fichas_cambio=fichas_cambio-1, polvos_iris=polvos_iris-? WHERE id_cuenta=?", args: [cost, id_destino] });
        
        // 2. Restar cartas (Quitar al dueño original)
        batch.push({ sql: "UPDATE Inventario SET cantidad=cantidad-1 WHERE id_cuenta=? AND id_carta=? AND expansion=?", args: [id_origen, give_id, exp_give] });
        batch.push({ sql: "UPDATE Inventario SET cantidad=cantidad-1 WHERE id_cuenta=? AND id_carta=? AND expansion=?", args: [id_destino, get_id, exp_get] });
        
        // 3. Sumar cartas (Dar al nuevo dueño) - Usamos UPSERT (ON CONFLICT)
        batch.push({ 
            sql: "INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, fecha_obtencion) VALUES (?,?,?,1,1,datetime('now')) ON CONFLICT(id_carta, expansion, id_cuenta) DO UPDATE SET cantidad=cantidad+1, desbloqueada=1", 
            args: [id_destino, give_id, exp_give] 
        });
        batch.push({ 
            sql: "INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, fecha_obtencion) VALUES (?,?,?,1,1,datetime('now')) ON CONFLICT(id_carta, expansion, id_cuenta) DO UPDATE SET cantidad=cantidad+1, desbloqueada=1", 
            args: [id_origen, get_id, exp_get] 
        });
        
        // 4. Historial y Notificación
        batch.push({ 
            sql: "INSERT INTO Transacciones (id_cuenta, id_carta, expansion, cantidad_anterior, cantidad_nueva, motivo, fecha) VALUES (?,?,?,0,0,?,datetime('now'))", 
            args: [id_origen, get_id, exp_get, `Trade con ID ${id_destino}`] 
        });
        
        batch.push({ 
            sql: "INSERT INTO Notificaciones (id_cuenta, mensaje) VALUES (?,?)", 
            args: [id_destino, `¡Intercambio completado con éxito con ${id_origen}! Has recibido tu carta.`] 
        });
        
        // EJECUTAR TODO DE GOLPE
        await db.batch(batch); 
        
        res.json({ success: true });
    } catch (e) { 
        console.error("Error en execute_trade:", e);
        res.json({ success: false, msg: e.message }); 
    }
});

router.post('/execute_gift', async (req, res) => {
    try { 
        const { id_origen, id_destino, id_carta, expansion } = req.body;
        const batch = [];

        // 1. Quitar al origen
        batch.push({ sql: "UPDATE Inventario SET cantidad=cantidad-1 WHERE id_cuenta=? AND id_carta=? AND expansion=?", args: [id_origen, id_carta, expansion] });
        
        // 2. Dar al destino
        batch.push({ 
            sql: "INSERT INTO Inventario (id_cuenta, id_carta, expansion, cantidad, desbloqueada, fecha_obtencion) VALUES (?,?,?,1,1,datetime('now')) ON CONFLICT(id_carta, expansion, id_cuenta) DO UPDATE SET cantidad=cantidad+1, desbloqueada=1", 
            args: [id_destino, id_carta, expansion] 
        });
        
        // 3. Actualizar misiones y stats
        batch.push({ sql: "UPDATE Diario SET carta_recibida=1, ultima_actualizacion=datetime('now') WHERE id_cuenta=?", args: [id_destino] });
        batch.push({ sql: "UPDATE Cuentas SET carta_compartida_recibida=1 WHERE id_cuenta=?", args: [id_destino] });
        
        // 4. Logs
        batch.push({ sql: "INSERT INTO Actividad (id_cuenta, mensaje, tipo, fecha) VALUES (?,?,?, datetime('now'))", args: [id_origen, `Regaló carta a ID ${id_destino}`, 'GIFT'] });
        batch.push({ sql: "INSERT INTO Notificaciones (id_cuenta, mensaje) VALUES (?,?)", args: [id_destino, `¡Has recibido un regalo del usuario ID ${id_origen}!` ] });
        
        await db.batch(batch);
        res.json({success:true});

    } catch(e) { 
        console.error("Error en execute_gift:", e);
        res.json({success:false}); 
    }
});

// ==========================================================================
// NOTIFICACIONES Y FEED (Adapados a Async)
// ==========================================================================

router.get('/notifications', async (req, res) => {
    try {
        const rows = await allAsync("SELECT * FROM Notificaciones WHERE id_cuenta=? ORDER BY fecha DESC LIMIT 20", [req.query.id_cuenta]);
        res.json(rows || []);
    } catch(e) { res.json([]); }
});

router.post('/notifications/read', async (req, res) => {
    try {
        await db.execute({
            sql: "UPDATE Notificaciones SET leida=1 WHERE id_cuenta=?",
            args: [req.body.id_cuenta]
        });
        res.json({success: true});
    } catch(e) { res.json({success:false}); }
});

router.get('/feed', async (req, res) => {
    try {
        const rows = await allAsync("SELECT a.mensaje, a.fecha, c.nombre as usuario, c.avatar_img FROM Actividad a JOIN Cuentas c ON a.id_cuenta=c.id_cuenta ORDER BY a.fecha DESC LIMIT 10");
        res.json(rows || []);
    } catch(e) { res.json([]); }
});

module.exports = router;