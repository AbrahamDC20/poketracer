/* ==========================================================================
   MÓDULO: HELPERS & UI
   Funciones de utilidad, manejo de interfaz, toasts y configuración
   ========================================================================== */

export const helpersModule = {
    
    // --- NAVEGACIÓN Y SCROLL ---
    handleScroll() { this.showScrollTop = window.scrollY > 300; },
    scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); },

    // --- HELPERS DE FECHA ---
    isNew(d) { 
        if(!d) return false; 
        return (Math.abs(new Date() - new Date(d)) / (1000*60*60*24)) < 1; 
    },
    
    getTimeString(d) {
        if(!d) return '?';
        const diff = (new Date() - new Date(d)) / 1000 / 60;
        if(diff < 60) return `Hace ${Math.floor(diff)} min`;
        if(diff < 1440) return `Hace ${Math.floor(diff/60)} h`;
        return 'Hace días';
    },

    isActiveRecently(d) {
        if(!d) return false;
        const diff = (new Date() - new Date(d)) / 1000 / 60 / 60; 
        return diff < 24; 
    },

    // --- MODALES Y MENÚS ---
    openModal(card) { this.modalCard = card; },
    closeModal() { this.modalCard = null; },
    
    openContextMenu(e, card) {
        e.preventDefault();
        this.contextMenu = { visible: true, x: e.clientX, y: e.clientY, card: card };
        if (window.innerWidth - e.clientX < 260) this.contextMenu.x = e.clientX - 260;
    },
    closeContextMenu() { this.contextMenu.visible = false; },

    // --- TOASTS ---
    showToast(msg, type = 'info') {
        var id = Date.now();
        this.toasts.push({id, msg, type});
        setTimeout(() => { 
            this.toasts = this.toasts.filter(t => t.id !== id); 
        }, 3000);
    },

    // --- HISTORIAL ---
    async loadHistory() {
        if (!this.currentUser) return;
        try {
            const r = await fetch('/api/transacciones?id_cuenta='+this.currentUser.id_cuenta);
            if(r.ok) this.history = await r.json();
        } catch(e) {}
    },
    
    getHistoryClass(h) {
        if(h.cantidad_nueva > h.cantidad_anterior) return 'gain';
        if(h.cantidad_nueva < h.cantidad_anterior) return 'loss';
        return 'trade';
    },

    // --- GRÁFICOS ---
    renderChart() {
        var ctx = document.getElementById('rarityChart');
        if (!ctx || !this.rawStats.breakdown) return;
        
        // Destruir si existe (simple check) o crear nuevo
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: this.rawStats.breakdown.map(b => b.rareza),
                datasets: [{
                    data: this.rawStats.breakdown.map(b => b.owned),
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'], 
                    borderWidth: 0
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                cutout: '70%' 
            }
        });
    },

    // --- UTILIDADES VISUALES ---
    getBiomeClass(t) {
        if(!t) return 'biome-dark';
        const x = t.toLowerCase();
        if(x.includes('fuego')) return 'biome-fire';
        if(x.includes('agua')) return 'biome-water';
        if(x.includes('planta')) return 'biome-grass';
        if(x.includes('electrico')) return 'biome-electric';
        if(x.includes('psiquico')) return 'biome-psychic';
        return 'biome-dark';
    },

    getAuraClass(r) {
        if(r.includes('Corona')) return 'aura-corona';
        if(r.includes('Shiny')) return 'aura-shiny';
        if(r.includes('Estrella')) return 'aura-estrella';
        return 'aura-rombo';
    },

    isSetCompleter(c) {
        return c.cantidad === 0 && (c.rareza.includes('Estrella') || c.rareza.includes('Corona'));
    },
    
    getAvatar(uid) {
        var u = this.accounts.find(a => a.id_cuenta == uid);
        return u ? u.avatar_img : null;
    },

    // --- VOZ ---
    toggleVoice() {
        var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return this.showToast("No soportado", "error");
        
        if (this.isListening) { 
            this.isListening = false; 
            return; 
        }
        
        var self = this;
        var recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.onstart = function() { 
            self.isListening = true; 
            self.showToast("Escuchando...", "info"); 
        };
        recognition.onend = function() { 
            self.isListening = false; 
        };
        recognition.onresult = function(e) {
            var t = e.results[0][0].transcript;
            self.filters.search = t;
            self.showToast("Buscado: " + t, "success");
            self.loadInventory();
        };
        recognition.start();
    },

    // --- SETTINGS ---
    openSettings() { 
        this.showSettings = true; 
        this.settingsForm = { avatar: this.currentUser?.avatar_img, passOld:'', passNew: '' }; 
    },
    
    handleAvatarUpload(e) {
        var f = e.target.files[0]; if(!f) return;
        var r = new FileReader(); var self = this;
        r.onload = function(ev) { self.settingsForm.avatar = ev.target.result; };
        r.readAsDataURL(f);
    },
    
    async saveSettingsProfile() {
        if(this.currentUser) {
            this.currentUser.avatar_img = this.settingsForm.avatar;
            this.currentUser.tema = this.currentTheme;
            await fetch('/api/cuentas/update_theme', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({id_cuenta: this.currentUser.id_cuenta, tema: this.currentTheme})
            });
            this.showToast("Perfil actualizado", "success");
            this.showSettings = false;
        }
    },
    
    async changePassword() { 
        if(!this.settingsForm.passOld || !this.settingsForm.passNew) return this.showToast("Rellena todo", "warning"); 
        
        const r = await fetch('/api/auth/change_password', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({id_cuenta:this.currentUser.id_cuenta, oldPass:this.settingsForm.passOld, newPass:this.settingsForm.passNew})
        }); 
        
        const d = await r.json(); 
        if(d.success){ 
            this.showToast("Contraseña cambiada", "success"); 
            this.settingsForm.passOld = ''; 
            this.settingsForm.passNew = ''; 
        } else {
            this.showToast(d.msg, "error"); 
        }
    },

    toggleCompact() {
        this.compactMode = !this.compactMode;
        localStorage.setItem('compactMode', this.compactMode);
    },
    
    toggleLowPower() {
        this.lowPowerMode = !this.lowPowerMode;
        localStorage.setItem('lowPowerMode', this.lowPowerMode);
        if(this.lowPowerMode) this.showToast("3D OFF", "info");
    }
};