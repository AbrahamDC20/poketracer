/* ==========================================================================
   MÓDULO: INVENTARIO
   Gestión de cartas, colecciones, recursos y datos del usuario
   ========================================================================== */

export const inventoryModule = {

    // --- CARGA DE DATOS ---
    
    // Carga el inventario filtrado actual
    async loadInventory() {
        if (!this.currentUser) return;
        this.saveStatus = 'Cargando...';
        try {
            var url = `/api/inventario?id_cuenta=${this.currentUser.id_cuenta}&expansion=${this.currentExp}&seccion=${this.section}`;
            const res = await fetch(url);
            if (res.ok) { 
                const rawData = await res.json(); 
                
                // Fusión de duplicados visuales en el cliente
                const uniqueMap = new Map();
                rawData.forEach(card => {
                    const key = card.id_carta;
                    if (uniqueMap.has(key)) {
                        const existing = uniqueMap.get(key);
                        existing.cantidad += card.cantidad;
                        if (card.desbloqueada) existing.desbloqueada = 1;
                        if (card.deseada) existing.deseada = 1;
                    } else {
                        uniqueMap.set(key, {...card});
                    }
                });
                
                this.cards = Array.from(uniqueMap.values());
                this.saveStatus = 'Listo'; 
            } else { 
                this.saveStatus = 'Error'; 
            }
        } catch (e) { this.saveStatus = 'Error'; }
    },

    // Carga la lista maestra de todas las cartas (para búsquedas globales y stats)
    async loadMasterList() {
        if (!this.currentUser) return;
        try {
            const res = await fetch(`/api/inventario?id_cuenta=${this.currentUser.id_cuenta}&expansion=TODAS&seccion=TODAS`);
            if (res.ok) this.masterCardList = await res.json();
        } catch(e) { console.error("Error Master List", e); }
    },

    // Carga estadísticas y wishlist
    async loadInfo() {
        if (!this.currentUser) return;
        var self = this;
        try {
            const resStats = await fetch(`/api/stats/progress?id_cuenta=${this.currentUser.id_cuenta}&expansion=${this.currentExp}`);
            if (resStats.ok) this.rawStats = await resStats.json();
        } catch (e) {}
        try {
            const resWish = await fetch(`/api/inventario/wishlist?id_cuenta=${this.currentUser.id_cuenta}`);
            if (resWish.ok) this.wishlist = await resWish.json();
        } catch (e) {}
        await this.loadLeaderboard();
        this.$nextTick(() => self.renderChart());
    },

    // Carga el ranking de usuarios (Cerebro)
    async loadLeaderboard() {
        try {
            const res = await fetch('/api/cerebro/data?expansion=TODAS');
            if (res.ok) {
                const allData = await res.json();
                const scores = {};
                allData.forEach(r => {
                    if (r.cantidad > 0) {
                        if (!scores[r.id_cuenta]) scores[r.id_cuenta] = new Set();
                        scores[r.id_cuenta].add(r.id_carta);
                    }
                });
                this.leaderboard = this.accounts.map(a => ({
                    id_cuenta: a.id_cuenta, 
                    nombre: a.nombre, 
                    avatar_img: a.avatar_img,
                    score: scores[a.id_cuenta] ? scores[a.id_cuenta].size : 0
                })).sort((a,b) => b.score - a.score);
            }
        } catch (e) {}
    },

    // --- EDICIÓN DE CARTAS ---

    updateQty(card, delta) {
        if (!card) return;
        var current = parseInt(card.cantidad, 10);
        if (isNaN(current)) current = 0;
        var newQty = Math.max(0, current + delta);
        
        if (newQty === current) return;
        
        card.cantidad = newQty;
        if (card.cantidad > 0) card.desbloqueada = 1;
        
        card.justUpdated = true;
        setTimeout(() => { card.justUpdated = false; }, 500);
        this.triggerAutoSave();
    },

    toggleHeart(card) {
        if (!card) return;
        card.deseada = !card.deseada;
        this.triggerAutoSave();
    },

    triggerAutoSave() {
        this.saveStatus = 'Guardando...';
        if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
        var self = this;
        this.autoSaveTimeout = setTimeout(() => { self.saveGrid(); }, 1000);
    },

    // Guardado en lote al servidor
    async saveGrid() {
        var self = this;
        try {
            var updates = this.cards.map(c => ({
                id_carta: c.id_carta, expansion: c.expansion,
                cantidad: c.cantidad, desbloqueada: c.desbloqueada ? 1 : 0,
                deseada: c.deseada ? 1 : 0, rareza: c.rareza, nombre: c.nombre
            }));
            const res = await fetch('/api/inventario/update_batch', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id_cuenta: this.currentUser.id_cuenta, updates: updates })
            });
            if (res.ok) { 
                this.saveStatus = 'Guardado'; 
                setTimeout(() => self.saveStatus = 'Listo', 2000); 
            } else { 
                this.saveStatus = 'Error Sync'; 
            }
        } catch (e) { this.saveStatus = 'Error Red'; }
    },

    // Guardado de recursos (Polvos, Fichas, Notas)
    async saveResourcesOnly() {
        try {
            await fetch('/api/cuentas/update_resources', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_cuenta: this.currentUser.id_cuenta,
                    fichas: Math.max(0, this.currentUser.fichas_cambio),
                    polvos: Math.max(0, this.currentUser.polvos_iris),
                    relojes: Math.max(0, this.currentUser.relojes_arena),
                    notas: this.currentUser.notas, avatar: this.currentUser.avatar_img
                })
            });
            this.showToast("Recursos guardados", "success");
        } catch (e) { this.showToast("Error guardando recursos", "error"); }
    },

    // --- HERRAMIENTAS DE USUARIO (CSV & WISHLIST) ---

    // Manejar selección de archivo CSV
    handleCSVSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.csvFileContent = ev.target.result;
            this.showToast("Archivo cargado. Pulsa Procesar.", "info");
        };
        reader.readAsText(file);
    },

    // Procesar y enviar CSV al servidor
    async processCSVUpload() {
        if (!this.csvFileContent) return this.showToast("Selecciona un archivo CSV", "warning");
        
        try {
            const r = await fetch('/api/user/tools/import_text', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id_cuenta: this.currentUser.id_cuenta, 
                    text: this.csvFileContent
                })
            });
            const d = await r.json();
            if (d.success) {
                this.showToast(`¡Éxito! ${d.count} líneas procesadas`, "success");
                this.csvFileContent = null; 
                // Limpiar input file visualmente
                const fileInput = document.querySelector('input[type="file"]');
                if(fileInput) fileInput.value = '';
                this.loadInventory();
            } else {
                this.showToast("Error al procesar", "error");
            }
        } catch(e) {
            this.showToast("Error de conexión", "error");
        }
    },

    // Exportar colección a CSV
    exportCollection() {
        let csv = "ID,Nombre,Expansion,Rareza,Cantidad\n";
        this.cards.forEach(c => {
            if(c.cantidad > 0) csv += `${c.id_carta},"${c.nombre}","${c.expansion}","${c.rareza}",${c.cantidad}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `coleccion_${this.currentUser.nombre}.csv`;
        a.click();
    },

    // Auto-Wishlist (Marcar faltantes)
    async runAutoWishlist() {
        if(!confirm("¿Marcar todas las faltantes como deseadas?")) return;
        await fetch('/api/user/tools/auto_wishlist', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({id_cuenta:this.currentUser.id_cuenta})
        });
        this.showToast("Wishlist actualizada", "success");
        this.loadInventory();
    }
};