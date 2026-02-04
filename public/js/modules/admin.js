/* ==========================================================================
   MÓDULO: ADMINISTRACIÓN
   Herramientas avanzadas, gestión de usuarios y mantenimiento de DB
   ========================================================================== */

export const adminModule = {
    
    // Carga de datos generales del panel admin
    async loadAdminData() { 
        this.adminStats = { totalUsers: this.accounts.length }; 
    },

    // --- GESTOR DE INTERCAMBIOS ADMIN ---

    async loadAdminUserInventory(userId, side) {
        if (!userId) return;
        try {
            const res = await fetch('/api/inventario?id_cuenta=' + userId + '&expansion=TODAS');
            const data = await res.json();
            if (side === 'A') {
                this.adminUserAInventory = data.filter(c => c.cantidad > 0);
                this.adminUserAInventoryFiltered = this.adminUserAInventory;
            } else {
                this.adminUserBInventory = data.filter(c => c.cantidad > 0);
                this.adminUserBInventoryFiltered = this.adminUserBInventory;
            }
        } catch(e) { console.error(e); }
    },

    filterAdminInventory(side) {
        const search = (side === 'A' ? this.adminTrade.searchA : this.adminTrade.searchB).toLowerCase();
        const source = side === 'A' ? this.adminUserAInventory : this.adminUserBInventory;
        const filtered = source.filter(c => c.nombre.toLowerCase().includes(search) || c.id_carta.toLowerCase().includes(search));
        
        if (side === 'A') this.adminUserAInventoryFiltered = filtered;
        else this.adminUserBInventoryFiltered = filtered;
    },

    selectAdminCard(card, side) {
        if (side === 'A') this.adminTrade.cardA = card;
        else this.adminTrade.cardB = card;
    },

    getTradeCost(rarity) {
        if (!rarity) return 0;
        return this.TRADE_COSTS[rarity] !== undefined ? this.TRADE_COSTS[rarity] : 0;
    },

    async executeAdminTrade() {
        if (!this.adminTrade.cardA || !this.adminTrade.cardB) return this.showToast("Faltan cartas", "warning");
        if (this.getTradeCost(this.adminTrade.cardA.rareza) === null) return this.showToast("Rareza Prohibida", "error");
        if (this.adminTrade.cardA.rareza !== this.adminTrade.cardB.rareza) return this.showToast("Rarezas no coinciden", "error");

        try {
            const res = await fetch('/api/social/execute_trade', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id_origen: this.adminTrade.userA, id_destino: this.adminTrade.userB,
                    give_id: this.adminTrade.cardA.id_carta, get_id: this.adminTrade.cardB.id_carta,
                    exp_give: this.adminTrade.cardA.expansion, exp_get: this.adminTrade.cardB.expansion,
                    rarity: this.adminTrade.cardA.rareza
                })
            });
            const d = await res.json();
            if(d.success) {
                this.showToast("Intercambio Éxito", "success");
                this.loadAdminUserInventory(this.adminTrade.userA, 'A');
                this.loadAdminUserInventory(this.adminTrade.userB, 'B');
            } else this.showToast(d.msg, "error");
        } catch(e) { this.showToast("Error Red", "error"); }
    },
    
    async executeAdminGift() { this.showToast("Función Gift (WIP)", "info"); },

    // --- INYECTOR DE SOBRES ---

    updatePackConfig() {
        const isDeluxe = this.packSimulator.expansion.toLowerCase().includes('deluxe');
        this.packSimulator.slots = [null,null,null,null,null,null];
        this.packSimulator.queries = ['','','','','',''];
        this.packSimulator.searchResults = [[],[],[],[],[],[]];
        this.packSimulator.activeCount = isDeluxe ? 4 : 5;
    },
    
    addSixthCardSlot() { if(this.packSimulator.activeCount < 6) this.packSimulator.activeCount = 6; },

    searchCardForPack(index) {
        const q = this.packSimulator.queries[index].toLowerCase();
        if(q.length < 1) { this.packSimulator.searchResults[index] = []; return; }
        const exp = this.packSimulator.expansion;
        this.packSimulator.searchResults[index] = this.masterCardList.filter(c => 
            (c.nombre.toLowerCase().includes(q) || c.id_carta.toLowerCase().includes(q)) && c.expansion === exp
        ).slice(0, 5);
    },

    selectCardForSlot(i, c) {
        this.packSimulator.slots[i] = {...c};
        this.packSimulator.queries[i] = c.nombre;
        this.packSimulator.searchResults[i] = [];
    },
    
    clearSlot(i) { this.packSimulator.slots[i] = null; this.packSimulator.queries[i] = ''; },

    async executePackOpening() {
        if(!this.adminPack.targetUser) return this.showToast("Elige usuario", "error");
        const cards = this.packSimulator.slots.filter(s => s);
        if(cards.length < 4) return this.showToast("Mínimo 4 cartas", "warning");

        try {
            const res = await fetch('/api/admin/inject_pack', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id_cuenta: this.adminPack.targetUser, cards: cards })
            });
            const d = await res.json();
            if(d.success) this.showToast("Sobre abierto!", "success");
            else this.showToast(d.msg, "error");
        } catch(e) { this.showToast("Error Red", "error"); }
    },

    // --- GESTIÓN DE USUARIOS ---

    openCreateUserModal() { this.adminUserForm.visible = true; },
    
    async adminCreateUser() {
        if(!this.adminUserForm.name) return;
        this.showToast("Usuario creado", "success");
        this.adminUserForm.visible = false;
        // Aquí faltaría la llamada real a /api/auth/register, pero en tu código original
        // esto solo mostraba el toast, se asume que usas el registro público o añades la llamada fetch aquí.
    },
    
    async adminDeleteUser(id) {
        if(!confirm("¿Eliminar usuario? Esta acción es irreversible.")) return;
        try {
            await fetch('/api/admin/account/delete', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({id_cuenta: id})
            });
            this.accounts = this.accounts.filter(a => a.id_cuenta !== id);
            this.showToast("Eliminado", "success");
        } catch(e) { this.showToast("Error", "error"); }
    },
    
    async adminResetPass(userId) {
        if(!confirm("¿Resetear contraseña a '1234'?")) return;
        await fetch('/api/admin/tools/reset_password', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({id_cuenta: userId})
        });
        this.showToast("Contraseña reseteada", "success");
    },

    // --- HERRAMIENTAS DE MANTENIMIENTO ---

    async adminFixRarities() {
        if(!confirm("¿Reparar nombres de rarezas?")) return;
        try {
            const res = await fetch('/api/admin/fix-rarities', { method: 'POST' });
            const d = await res.json();
            alert(d.msg || "Completado");
        } catch(e) { alert("Error de conexión"); }
    },

    async syncWiki() {
        if(!confirm("¿Sincronizar con Listas Wiki?")) return;
        try {
            const res = await fetch('/api/admin/sync-wiki', {method:'POST'});
            const d = await res.json();
            this.showToast(d.msg || "Sincronización completada", d.success ? "success":"error");
        } catch(e) { this.showToast("Error de sincronización", "error"); }
    },
    
    async forceReset() {
        if(!confirm("¿Forzar Reset Diario? Esto reactivará sobres y regalos.")) return;
        await fetch('/api/admin/force_reset', {method:'POST'});
        this.showToast("Reset Diario Ejecutado", "success");
    },
    
    fullDbBackup() { window.open('/api/admin/backup/export'); },
    
    fullDbRestore(e) {
        const f = e.target.files[0]; 
        if(!f || !confirm("¿Restaurar Base de Datos? Se perderán los datos actuales.")) return;
        
        const r = new FileReader();
        r.onload = async (ev) => {
            try {
                const d = JSON.parse(ev.target.result);
                await fetch('/api/admin/backup/import', {
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(d)
                });
                alert("Restauración completada. Recargando..."); 
                location.reload();
            } catch(err) { alert("Archivo JSON inválido"); }
        };
        r.readAsText(f);
    },

    async adminReverseSearch() {
        const r = await fetch('/api/admin/tools/reverse_search?query='+this.adminSearchQuery);
        this.adminSearchResults = await r.json();
    },

    async adminCleanDB() {
        if(!confirm("¿Ejecutar limpieza profunda de DB (fusionar duplicados)?")) return;
        const r = await fetch('/api/admin/tools/clean_db', {method:'POST'});
        const d = await r.json();
        this.showToast(d.msg, "success");
    }
};