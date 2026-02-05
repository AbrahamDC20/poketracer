/* ==========================================================================
   MÓDULO: ADMINISTRACIÓN (FIXED SCOPE & CONTEXT)
   ========================================================================== */

function getApp() {
    const el = document.querySelector('[x-data]');
    return (el && el.__x) ? el.__x.$data : null;
}

function safeToast(msg, type) {
    const app = getApp();
    if (app && app.showToast) app.showToast(msg, type);
    else alert(msg);
}

export const adminModule = {
    
    async loadAdminData() { 
        const app = getApp();
        if(app) app.adminStats = { totalUsers: app.accounts.length }; 
    },

    // --- GESTOR DE INTERCAMBIOS ADMIN (FIXED) ---

    async loadAdminUserInventory(userId, side) {
        if (!userId) return;
        const app = getApp();
        if (!app) return;

        try {
            const res = await fetch('/api/inventario?id_cuenta=' + userId + '&expansion=TODAS');
            const data = await res.json();
            const ownedItems = data.filter(c => c.cantidad > 0);

            if (side === 'A') {
                app.adminUserAInventory = ownedItems;
                app.adminUserAInventoryFiltered = ownedItems;
                app.adminTrade.cardA = null; 
            } else {
                app.adminUserBInventory = ownedItems;
                app.adminUserBInventoryFiltered = ownedItems;
                app.adminTrade.cardB = null; 
            }
            
            // Forzamos el filtrado inicial
            adminModule.filterAdminInventory(side);

        } catch(e) { console.error(e); }
    },

    // ESTA FUNCIÓN PROVOCABA EL ERROR "searchA undefined". AHORA ESTÁ CORREGIDA.
    filterAdminInventory(side) {
        const app = getApp();
        if (!app) return;

        // Leemos valores del DOM directamente para evitar desincronización
        const rarityVal = document.getElementById(`filter-rarity-${side}`)?.value || 'ALL';
        const expVal = document.getElementById(`filter-exp-${side}`)?.value || 'ALL';
        
        // Accedemos a las variables de búsqueda a través de 'app', no 'this'
        const searchVal = (side === 'A' ? app.adminTrade.searchA : app.adminTrade.searchB || '').toLowerCase();
        
        const source = side === 'A' ? app.adminUserAInventory : app.adminUserBInventory;
        if (!source) return;

        const filtered = source.filter(c => {
            const matchText = c.nombre.toLowerCase().includes(searchVal) || c.id_carta.toLowerCase().includes(searchVal);
            const matchRarity = rarityVal === 'ALL' || c.rareza === rarityVal;
            const matchExp = expVal === 'ALL' || c.expansion === expVal;
            const isTradeable = !['Corona', '3 Estrellas'].includes(c.rareza);

            return matchText && matchRarity && matchExp && isTradeable;
        });
        
        // Escribimos el resultado en la app
        if (side === 'A') app.adminUserAInventoryFiltered = filtered;
        else app.adminUserBInventoryFiltered = filtered;
    },

    selectAdminCard(card, side) {
        const app = getApp();
        if (side === 'A') app.adminTrade.cardA = card;
        else app.adminTrade.cardB = card;
    },

    getTradeCost(rarity) {
        const app = getApp();
        if (!rarity || !app) return 0;
        return app.TRADE_COSTS[rarity] !== undefined ? app.TRADE_COSTS[rarity] : null;
    },

    async executeAdminTrade() {
        const app = getApp();
        if (!app.adminTrade.cardA || !app.adminTrade.cardB) return safeToast("Faltan cartas", "warning");
        
        const cost = adminModule.getTradeCost(app.adminTrade.cardA.rareza);
        if (cost === null) return safeToast("Rareza Prohibida", "error");
        
        if (app.adminTrade.cardA.rareza !== app.adminTrade.cardB.rareza) return safeToast("Rarezas distintas", "error");

        try {
            const res = await fetch('/api/social/execute_trade', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id_origen: app.adminTrade.userA, id_destino: app.adminTrade.userB,
                    give_id: app.adminTrade.cardA.id_carta, get_id: app.adminTrade.cardB.id_carta,
                    exp_give: app.adminTrade.cardA.expansion, exp_get: app.adminTrade.cardB.expansion,
                    rarity: app.adminTrade.cardA.rareza
                })
            });
            const d = await res.json();
            if(d.success) {
                safeToast("✅ Intercambio Admin OK", "success");
                adminModule.loadAdminUserInventory(app.adminTrade.userA, 'A');
                adminModule.loadAdminUserInventory(app.adminTrade.userB, 'B');
                app.adminTrade.cardA = null; 
                app.adminTrade.cardB = null;
            } else safeToast(d.msg, "error");
        } catch(e) { safeToast("Error de Red", "error"); }
    },
    
    async executeAdminGift() { safeToast("Función Gift (WIP)", "info"); },

    // --- INYECTOR DE SOBRES ---

    updatePackConfig() {
        const app = getApp();
        const isDeluxe = app.packSimulator.expansion.toLowerCase().includes('deluxe');
        app.packSimulator.slots = [null,null,null,null,null,null];
        app.packSimulator.queries = ['','','','','',''];
        app.packSimulator.searchResults = [[],[],[],[],[],[]];
        app.packSimulator.activeCount = isDeluxe ? 4 : 5;
    },
    
    addSixthCardSlot() { 
        const app = getApp();
        if(app.packSimulator.activeCount < 6) app.packSimulator.activeCount = 6; 
    },

    searchCardForPack(index) {
        const app = getApp();
        const q = app.packSimulator.queries[index].toLowerCase();
        if(q.length < 1) { app.packSimulator.searchResults[index] = []; return; }
        const exp = app.packSimulator.expansion;
        app.packSimulator.searchResults[index] = app.masterCardList.filter(c => 
            (c.nombre.toLowerCase().includes(q) || c.id_carta.toLowerCase().includes(q)) && c.expansion === exp
        ).slice(0, 5);
    },

    selectCardForSlot(i, c) {
        const app = getApp();
        app.packSimulator.slots[i] = {...c}; 
        app.packSimulator.queries[i] = c.nombre;
        app.packSimulator.searchResults[i] = []; 
    },
    
    clearSlot(i) { 
        const app = getApp();
        app.packSimulator.slots[i] = null; 
        app.packSimulator.queries[i] = ''; 
    },

    async executePackOpening() {
        const app = getApp();
        if(!app.adminPack.targetUser) return safeToast("Elige usuario", "error");
        const cards = app.packSimulator.slots.filter(s => s);
        if(cards.length < 4) return safeToast("Mínimo 4 cartas", "warning");

        try {
            const res = await fetch('/api/admin/inject_pack', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id_cuenta: app.adminPack.targetUser, cards: cards })
            });
            const d = await res.json();
            if(d.success) safeToast("⚡ Sobre abierto!", "success");
            else safeToast(d.msg, "error");
        } catch(e) { safeToast("Error Red", "error"); }
    },

    // --- USERS ---

    openCreateUserModal() { 
        const app = getApp();
        app.adminUserForm.visible = true; 
    },
    
    async adminCreateUser() {
        const app = getApp();
        if(!app.adminUserForm.name) return;
        safeToast("Usuario Simulado OK", "success");
        app.adminUserForm.visible = false;
    },
    
    async adminDeleteUser(id) {
        if(!confirm("¿Eliminar usuario?")) return;
        const app = getApp();
        try {
            await fetch('/api/admin/account/delete', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({id_cuenta: id})
            });
            app.accounts = app.accounts.filter(a => a.id_cuenta !== id);
            safeToast("Eliminado", "success");
        } catch(e) { safeToast("Error", "error"); }
    },
    
    async adminResetPass(userId) {
        if(!confirm("¿Reset a '1234'?")) return;
        try {
            await fetch('/api/admin/tools/reset_password', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({id_cuenta: userId})
            });
            safeToast("Reset OK", "success");
        } catch(e) { safeToast("Error", "error"); }
    },

    async adminUpdateUser(user) {
        try {
            await fetch('/api/admin/account/update', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id_cuenta: user.id_cuenta,
                    tipo: user.tipo,
                    prioridad: user.prioridad
                })
            });
            safeToast("Usuario actualizado", "success");
        } catch (e) { safeToast("Error", "error"); }
    },

    // --- MANTENIMIENTO (FIXED DOWNLOAD) ---

    async adminFixRarities() {
        if(!confirm("¿Reparar rarezas?")) return;
        try {
            const res = await fetch('/api/admin/fix-rarities', { method: 'POST' });
            const d = await res.json();
            alert(d.msg);
        } catch(e) { alert("Error"); }
    },

    async syncWiki() {
        safeToast("⏳ Sincronizando...", "info");
        try {
            const res = await fetch('/api/admin/sync_wiki');
            const d = await res.json();
            safeToast(d.msg || "Sincronizado", d.success ? "success" : "info");
        } catch(e) { safeToast("Error conexión", "error"); }
    },
    
    async forceReset() {
        if(!confirm("¿Forzar Reset?")) return;
        await fetch('/api/admin/force_reset', {method:'POST'});
        safeToast("Reset Ejecutado", "success");
    },
    
    // FIX PANTALLA BLANCA AL EXPORTAR: Usamos descarga por link directo
    async fullDbBackup() { 
        safeToast("⏳ Iniciando descarga...", "info");
        try {
            const link = document.createElement('a');
            link.href = '/api/admin/export_db';
            link.setAttribute('download', `backup_poketrader_${Date.now()}.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            safeToast("✅ Descarga iniciada", "success");
        } catch (e) {
            console.error(e);
            safeToast("❌ Error al descargar", "error");
        }
    },
    
    fullDbRestore(e) {
        const f = e.target.files[0]; 
        if(!f || !confirm("¿Sobrescribir DB?")) return;
        
        const r = new FileReader();
        r.onload = async (ev) => {
            try {
                const d = JSON.parse(ev.target.result);
                await fetch('/api/admin/import_db', {
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(d)
                });
                alert("Restaurado. Recargando..."); 
                location.reload();
            } catch(err) { alert("JSON inválido"); }
        };
        r.readAsText(f);
    },

    async adminCleanDB() {
        if(!confirm("¿Limpiar DB?")) return;
        const r = await fetch('/api/admin/tools/clean_db', {method:'POST'});
        const d = await r.json();
        safeToast(d.msg, "success");
    },

    async adminReverseSearch() {
        const app = getApp();
        if(!app.adminSearchQuery) return;
        const r = await fetch('/api/admin/tools/reverse_search?query='+app.adminSearchQuery);
        app.adminSearchResults = await r.json();
    }
};