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
            // Cargamos el inventario completo del usuario
            const res = await fetch('/api/inventario?id_cuenta=' + userId + '&expansion=TODAS');
            const data = await res.json();
            
            // Filtramos solo las que tiene (> 0)
            const ownedItems = data.filter(c => c.cantidad > 0);

            if (side === 'A') {
                this.adminUserAInventory = ownedItems;
                this.adminUserAInventoryFiltered = ownedItems;
                this.adminTrade.cardA = null; // Resetear selección
                this.adminTrade.searchA = '';
            } else {
                this.adminUserBInventory = ownedItems;
                this.adminUserBInventoryFiltered = ownedItems;
                this.adminTrade.cardB = null; // Resetear selección
                this.adminTrade.searchB = '';
            }
            
            // Aplicar filtros inmediatamente después de cargar
            this.filterAdminInventory(side);

        } catch(e) { console.error("Error cargando inventario admin:", e); }
    },

    // Función de filtrado Corregida (Doble Filtro A/B)
    filterAdminInventory(side) {
        // Obtenemos los valores de los selectores específicos de cada lado
        // Usamos el operador ?. por si el DOM aún no está listo, aunque debería estarlo
        const rarityVal = document.getElementById(`filter-rarity-${side}`)?.value || 'ALL';
        const expVal = document.getElementById(`filter-exp-${side}`)?.value || 'ALL';
        
        // Buscamos en el texto (buscador input)
        const search = (side === 'A' ? this.adminTrade.searchA : this.adminTrade.searchB).toLowerCase();
        
        // Fuente de datos original
        const source = side === 'A' ? this.adminUserAInventory : this.adminUserBInventory;
        
        const filtered = source.filter(c => {
            // 1. Coincidencia de Texto
            const matchesText = c.nombre.toLowerCase().includes(search) || c.id_carta.toLowerCase().includes(search);
            
            // 2. Coincidencia de Rareza
            let matchesRarity = true;
            if (rarityVal !== 'ALL') {
                matchesRarity = c.rareza === rarityVal;
            }

            // 3. Coincidencia de Expansión
            let matchesExp = true;
            if (expVal !== 'ALL') {
                // Comparamos strings exactos o parciales
                matchesExp = c.expansion === expVal;
            }

            return matchesText && matchesRarity && matchesExp;
        });
        
        // Asignamos al array filtrado correspondiente
        if (side === 'A') this.adminUserAInventoryFiltered = filtered;
        else this.adminUserBInventoryFiltered = filtered;
    },

    selectAdminCard(card, side) {
        if (side === 'A') this.adminTrade.cardA = card;
        else this.adminTrade.cardB = card;
    },

    getTradeCost(rarity) {
        if (!rarity) return 0;
        return this.TRADE_COSTS[rarity] !== undefined ? this.TRADE_COSTS[rarity] : null;
    },

    async executeAdminTrade() {
        // Validaciones
        if (!this.adminTrade.cardA || !this.adminTrade.cardB) return this.showToast("Faltan cartas", "warning");
        
        const cost = this.getTradeCost(this.adminTrade.cardA.rareza);
        if (cost === null) return this.showToast("Rareza NO intercambiable (Corona/3★)", "error");
        
        if (this.adminTrade.cardA.rareza !== this.adminTrade.cardB.rareza) return this.showToast("Las rarezas no coinciden", "error");

        try {
            const res = await fetch('/api/social/execute_trade', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id_origen: this.adminTrade.userA, 
                    id_destino: this.adminTrade.userB,
                    give_id: this.adminTrade.cardA.id_carta, 
                    get_id: this.adminTrade.cardB.id_carta,
                    exp_give: this.adminTrade.cardA.expansion, 
                    exp_get: this.adminTrade.cardB.expansion,
                    rarity: this.adminTrade.cardA.rareza
                })
            });
            const d = await res.json();
            
            if(d.success) {
                this.showToast("✅ Intercambio realizado", "success");
                // Recargar ambos inventarios para ver cambios
                this.loadAdminUserInventory(this.adminTrade.userA, 'A');
                this.loadAdminUserInventory(this.adminTrade.userB, 'B');
            } else {
                this.showToast(d.msg, "error");
            }
        } catch(e) { 
            this.showToast("Error de conexión", "error"); 
        }
    },
    
    async executeAdminGift() { 
        this.showToast("Función Gift en desarrollo", "info"); 
    },

    // --- INYECTOR DE SOBRES ---

    updatePackConfig() {
        const isDeluxe = this.packSimulator.expansion.toLowerCase().includes('deluxe');
        this.packSimulator.slots = [null,null,null,null,null,null];
        this.packSimulator.queries = ['','','','','',''];
        this.packSimulator.searchResults = [[],[],[],[],[],[]];
        this.packSimulator.activeCount = isDeluxe ? 4 : 5;
    },
    
    addSixthCardSlot() { 
        if(this.packSimulator.activeCount < 6) this.packSimulator.activeCount = 6; 
    },

    searchCardForPack(index) {
        const q = this.packSimulator.queries[index].toLowerCase();
        if(q.length < 1) { 
            this.packSimulator.searchResults[index] = []; 
            return; 
        }
        const exp = this.packSimulator.expansion;
        
        this.packSimulator.searchResults[index] = this.masterCardList.filter(c => 
            (c.nombre.toLowerCase().includes(q) || c.id_carta.toLowerCase().includes(q)) && 
            c.expansion === exp
        ).slice(0, 5);
    },

    selectCardForSlot(i, c) {
        this.packSimulator.slots[i] = {...c}; 
        this.packSimulator.queries[i] = c.nombre;
        this.packSimulator.searchResults[i] = []; 
    },
    
    clearSlot(i) { 
        this.packSimulator.slots[i] = null; 
        this.packSimulator.queries[i] = ''; 
    },

    async executePackOpening() {
        if(!this.adminPack.targetUser) return this.showToast("Elige usuario destino", "error");
        
        const cards = this.packSimulator.slots.filter(s => s);
        if(cards.length < 4) return this.showToast("Mínimo 4 cartas", "warning");

        try {
            const res = await fetch('/api/admin/inject_pack', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    id_cuenta: this.adminPack.targetUser, 
                    cards: cards 
                })
            });
            const d = await res.json();
            if(d.success) this.showToast("⚡ Sobre abierto correctamente", "success");
            else this.showToast(d.msg, "error");
        } catch(e) { this.showToast("Error Red", "error"); }
    },

    // --- GESTIÓN DE USUARIOS ---

    openCreateUserModal() { 
        this.adminUserForm.visible = true; 
    },
    
    async adminCreateUser() {
        if(!this.adminUserForm.name) return this.showToast("Falta nombre", "warning");
        this.showToast("Usuario creado (Simulación)", "success");
        this.adminUserForm.visible = false;
    },
    
    async adminDeleteUser(id) {
        if(!confirm("¿Borrar usuario permanentemente?")) return;
        try {
            await fetch('/api/admin/account/delete', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({id_cuenta: id})
            });
            this.accounts = this.accounts.filter(a => a.id_cuenta !== id);
            this.showToast("Usuario eliminado", "success");
        } catch(e) { this.showToast("Error", "error"); }
    },
    
    async adminResetPass(userId) {
        if(!confirm("¿Resetear clave a '1234'?")) return;
        try {
            await fetch('/api/admin/tools/reset_password', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({id_cuenta: userId})
            });
            this.showToast("Contraseña reseteada", "success");
        } catch(e) { this.showToast("Error", "error"); }
    },

    // --- HERRAMIENTAS DE MANTENIMIENTO ---

    async adminFixRarities() {
        if(!confirm("¿Reparar rarezas?")) return;
        try {
            const res = await fetch('/api/admin/fix-rarities', { method: 'POST' });
            const d = await res.json();
            alert(d.msg || "Hecho");
        } catch(e) { alert("Error"); }
    },

    async syncWiki() {
        // En Cloud solo mostramos el aviso
        const res = await fetch('/api/admin/sync_wiki');
        const d = await res.json();
        if(!d.success) this.showToast(d.msg, "info");
        else this.showToast("Sincronización OK", "success");
    },
    
    async forceReset() {
        if(!confirm("¿Forzar Reset Diario?")) return;
        await fetch('/api/admin/force_reset', {method:'POST'});
        this.showToast("Reset Completado", "success");
    },
    
    // FIX: Usamos Fetch + Blob para descargar el archivo en Cloud
    async fullDbBackup() { 
        this.showToast("⏳ Generando respaldo...", "info");
        try {
            const response = await fetch('/api/admin/export_db');
            if (!response.ok) throw new Error("Error en servidor");
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = "respaldo_poketracer_" + new Date().toISOString().slice(0,10) + ".json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            this.showToast("✅ Respaldo descargado", "success");
        } catch (e) {
            console.error(e);
            this.showToast("❌ Error al descargar DB", "error");
        }
    },
    
    fullDbRestore(e) {
        const f = e.target.files[0]; 
        if(!f || !confirm("⚠ PELIGRO: ¿Sobrescribir base de datos?")) return;
        
        const r = new FileReader();
        r.onload = async (ev) => {
            try {
                const dataObj = JSON.parse(ev.target.result);
                await fetch('/api/admin/import_db', { // Asegúrate de tener esta ruta configurada
                    method:'POST', 
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(dataObj)
                });
                alert("Restauración OK. Recargando..."); 
                location.reload();
            } catch(err) { alert("Archivo inválido"); }
        };
        r.readAsText(f);
    },

    async adminReverseSearch() {
        if(!this.adminSearchQuery) return;
        const r = await fetch('/api/admin/tools/reverse_search?query='+this.adminSearchQuery);
        this.adminSearchResults = await r.json();
    },

    async adminCleanDB() {
        if(!confirm("¿Limpiar duplicados en DB?")) return;
        const r = await fetch('/api/admin/tools/clean_db', {method:'POST'});
        const d = await r.json();
        this.showToast(d.msg, "success");
    },
    
    async adminUpdateUser(user) {
        try {
            await fetch('/api/admin/account/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id_cuenta: user.id_cuenta,
                    tipo: user.tipo,
                    prioridad: user.prioridad
                })
            });
            this.showToast("Usuario actualizado", "success");
        } catch (e) {
            this.showToast("Error actualizando", "error");
        }
    }
};