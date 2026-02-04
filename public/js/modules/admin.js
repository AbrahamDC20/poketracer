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
            // Cargamos TODAS las cartas, el filtrado lo haremos en cliente
            const res = await fetch('/api/inventario?id_cuenta=' + userId + '&expansion=TODAS');
            const data = await res.json();
            
            // Filtramos solo las que tiene (> 0)
            const ownedItems = data.filter(c => c.cantidad > 0);

            if (side === 'A') {
                this.adminUserAInventory = ownedItems;
                this.adminUserAInventoryFiltered = ownedItems;
                // Reseteamos selección al cambiar usuario
                this.adminTrade.cardA = null;
                this.adminTrade.searchA = '';
            } else {
                this.adminUserBInventory = ownedItems;
                this.adminUserBInventoryFiltered = ownedItems;
                this.adminTrade.cardB = null;
                this.adminTrade.searchB = '';
            }
            
            // Aplicamos filtros si ya había alguno seleccionado en los desplegables
            this.filterAdminInventory(side);

        } catch(e) { console.error("Error cargando inventario admin:", e); }
    },

    // Función de filtrado mejorada (Texto + Rareza + Expansión)
    filterAdminInventory(side) {
        const search = (side === 'A' ? this.adminTrade.searchA : this.adminTrade.searchB).toLowerCase();
        const source = side === 'A' ? this.adminUserAInventory : this.adminUserBInventory;
        
        // Obtenemos los valores de los filtros visuales (si existen en el DOM)
        const rarityFilter = document.getElementById('admin-filter-rarity') ? document.getElementById('admin-filter-rarity').value : 'ALL';
        const expFilter = document.getElementById('admin-filter-exp') ? document.getElementById('admin-filter-exp').value : 'ALL';

        const filtered = source.filter(c => {
            // 1. Filtro por Texto (Nombre o ID)
            const matchesText = c.nombre.toLowerCase().includes(search) || c.id_carta.toLowerCase().includes(search);
            
            // 2. Filtro por Rareza
            let matchesRarity = true;
            if (rarityFilter !== 'ALL') {
                matchesRarity = c.rareza.includes(rarityFilter);
            }

            // 3. Filtro por Expansión
            let matchesExp = true;
            if (expFilter !== 'ALL') {
                // Buscamos si el string de la expansión incluye el código (ej: "A1" en "Genetica Apex (A1)")
                matchesExp = c.expansion.toLowerCase().includes(expFilter.toLowerCase());
            }

            return matchesText && matchesRarity && matchesExp;
        });
        
        if (side === 'A') this.adminUserAInventoryFiltered = filtered;
        else this.adminUserBInventoryFiltered = filtered;
    },

    selectAdminCard(card, side) {
        if (side === 'A') this.adminTrade.cardA = card;
        else this.adminTrade.cardB = card;
        // Opcional: Limpiar búsqueda tras seleccionar
        // if(side === 'A') this.adminTrade.searchA = '';
        // else this.adminTrade.searchB = '';
    },

    getTradeCost(rarity) {
        if (!rarity) return 0;
        return this.TRADE_COSTS[rarity] !== undefined ? this.TRADE_COSTS[rarity] : 0;
    },

    async executeAdminTrade() {
        if (!this.adminTrade.cardA || !this.adminTrade.cardB) return this.showToast("Faltan cartas para el intercambio", "warning");
        if (this.getTradeCost(this.adminTrade.cardA.rareza) === null) return this.showToast("Esta rareza no se puede intercambiar", "error");
        
        // Validación de rarezas iguales (regla del juego)
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
                this.showToast("✅ Intercambio Forzado con Éxito", "success");
                // Recargar inventarios para reflejar cambios
                this.loadAdminUserInventory(this.adminTrade.userA, 'A');
                this.loadAdminUserInventory(this.adminTrade.userB, 'B');
                this.adminTrade.cardA = null;
                this.adminTrade.cardB = null;
            } else {
                this.showToast(d.msg, "error");
            }
        } catch(e) { 
            console.error(e);
            this.showToast("Error de conexión al servidor", "error"); 
        }
    },
    
    async executeAdminGift() { 
        // Implementación futura o simple movimiento unilateral
        this.showToast("Función Gift en desarrollo (WIP)", "info"); 
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
        
        // Buscamos en la lista maestra (masterCardList) que se carga en init
        this.packSimulator.searchResults[index] = this.masterCardList.filter(c => 
            (c.nombre.toLowerCase().includes(q) || c.id_carta.toLowerCase().includes(q)) && 
            c.expansion === exp
        ).slice(0, 5); // Limitamos a 5 resultados
    },

    selectCardForSlot(i, c) {
        this.packSimulator.slots[i] = {...c}; // Copia del objeto carta
        this.packSimulator.queries[i] = c.nombre;
        this.packSimulator.searchResults[i] = []; // Limpiar resultados
    },
    
    clearSlot(i) { 
        this.packSimulator.slots[i] = null; 
        this.packSimulator.queries[i] = ''; 
    },

    async executePackOpening() {
        if(!this.adminPack.targetUser) return this.showToast("Selecciona un usuario destino", "error");
        
        // Filtrar slots vacíos
        const cards = this.packSimulator.slots.filter(s => s);
        if(cards.length < 4) return this.showToast("El sobre debe tener al menos 4 cartas", "warning");

        try {
            const res = await fetch('/api/admin/inject_pack', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    id_cuenta: this.adminPack.targetUser, 
                    cards: cards 
                })
            });
            const d = await res.json();
            if(d.success) this.showToast("⚡ Sobre abierto exitosamente!", "success");
            else this.showToast(d.msg, "error");
        } catch(e) { this.showToast("Error de conexión", "error"); }
    },

    // --- GESTIÓN DE USUARIOS ---

    openCreateUserModal() { 
        this.adminUserForm.visible = true; 
    },
    
    async adminCreateUser() {
        if(!this.adminUserForm.name) return this.showToast("Falta el nombre", "warning");
        
        // En tu código original solo mostrabas el toast.
        // Si tienes endpoint de registro admin, iría aquí.
        // Asumimos comportamiento visual por ahora o registro vía AuthModule pública.
        this.showToast("Usuario creado (Simulación)", "success");
        this.adminUserForm.visible = false;
        // Si quieres recargar la lista de usuarios:
        // const ra = await fetch('/api/cuentas'); this.accounts = await ra.json();
    },
    
    async adminDeleteUser(id) {
        if(!confirm("¿Estás seguro de eliminar este usuario? Se borrará todo su inventario.")) return;
        try {
            await fetch('/api/admin/account/delete', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({id_cuenta: id})
            });
            // Actualizar lista local
            this.accounts = this.accounts.filter(a => a.id_cuenta !== id);
            this.showToast("Usuario eliminado", "success");
        } catch(e) { this.showToast("Error al eliminar", "error"); }
    },
    
    async adminResetPass(userId) {
        if(!confirm("¿Resetear contraseña a '1234' para este usuario?")) return;
        try {
            await fetch('/api/admin/tools/reset_password', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({id_cuenta: userId})
            });
            this.showToast("Contraseña reseteada a '1234'", "success");
        } catch(e) { this.showToast("Error al resetear", "error"); }
    },

    // --- HERRAMIENTAS DE MANTENIMIENTO ---

    async adminFixRarities() {
        if(!confirm("¿Reparar nombres de rarezas en base de datos?")) return;
        try {
            const res = await fetch('/api/admin/fix-rarities', { method: 'POST' });
            const d = await res.json();
            alert(d.msg || "Proceso completado");
        } catch(e) { alert("Error de conexión"); }
    },

    async syncWiki() {
        // En versión CLOUD desactivamos la sincronización de archivos físicos
        const res = await fetch('/api/admin/sync_wiki'); // Usamos GET según tu route nueva
        const d = await res.json();
        
        if (!d.success) {
            this.showToast(d.msg, "info");
        } else {
            this.showToast("Sincronización completada", "success");
        }
    },
    
    async forceReset() {
        if(!confirm("¿Forzar Reset Diario? Esto reactivará sobres y regalos para todos.")) return;
        try {
            await fetch('/api/admin/force_reset', {method:'POST'});
            this.showToast("Reset Diario Ejecutado Correctamente", "success");
        } catch(e) { this.showToast("Error ejecutando reset", "error"); }
    },
    
    fullDbBackup() { 
        // Redirige a la ruta que configuramos para descargar JSON en Cloud
        window.open('/api/admin/export_db'); 
    },
    
    fullDbRestore(e) {
        const f = e.target.files[0]; 
        if(!f || !confirm("⚠ PELIGRO: ¿Restaurar Base de Datos?\nSe BORRARÁN los datos actuales y se reemplazarán por los del archivo.")) return;
        
        const r = new FileReader();
        r.onload = async (ev) => {
            try {
                const dataObj = JSON.parse(ev.target.result);
                
                // Enviar al endpoint de importación (que deberás tener en backend si quieres que funcione)
                // Si no lo tienes configurado para Turso JSON import, esto podría fallar.
                // Asumimos ruta existente: /api/admin/import_db (o similar)
                
                const res = await fetch('/api/admin/import_db', { // Asegúrate de tener esta ruta o cambiarla
                    method:'POST', 
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(dataObj)
                });
                
                const d = await res.json();
                if(d.success) {
                    alert("Restauración completada. La página se recargará."); 
                    location.reload();
                } else {
                    alert("Error en restauración: " + d.msg);
                }
            } catch(err) { 
                console.error(err);
                alert("Archivo JSON inválido o error de procesamiento."); 
            }
        };
        r.readAsText(f);
    },

    async adminReverseSearch() {
        if(!this.adminSearchQuery) return;
        const r = await fetch('/api/admin/tools/reverse_search?query='+this.adminSearchQuery);
        this.adminSearchResults = await r.json();
    },

    async adminCleanDB() {
        if(!confirm("¿Ejecutar limpieza profunda de DB?\nEsto fusionará cartas duplicadas y limpiará datos huérfanos.")) return;
        try {
            const r = await fetch('/api/admin/tools/clean_db', {method:'POST'}); // Asegúrate que esta ruta existe en backend
            if(r.ok) {
                const d = await r.json();
                this.showToast(d.msg || "Limpieza completada", "success");
            } else {
                this.showToast("Ruta de limpieza no configurada", "warning");
            }
        } catch(e) { this.showToast("Error de conexión", "error"); }
    },
    
    // Función auxiliar para actualizar usuario desde tabla
    async adminUpdateUser(user) {
        // Pequeño retardo para evitar flood si se cambia rápido
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
            console.error(e);
            this.showToast("Error actualizando usuario", "error");
        }
    }
};