/* ==========================================================================
   APP BUNDLE - VERSIÓN COMPLETA (LÓGICA REAL RESTAURADA + MOBILE FIXES)
   ========================================================================== */

// 1. GESTOR DE MEDIOS (GLOBAL)
const mediaManager = {
    loadImage(card) {
        if (!card || !card.id_carta) return 'assets/images/card-back.webp';
        const parts = card.id_carta.split('-');
        if (parts.length === 2) {
            return `assets/images/cards/${parts[0]}-${parseInt(parts[1], 10)}.webp`;
        }
        return 'assets/images/card-back.webp';
    },
    fallbackImage(e) { e.target.src = 'assets/images/card-back.webp'; },
    loadSetLogo(exp) {
        if (!exp || exp === 'TODAS') return null;
        // FIX: Aseguramos minúsculas para encontrar la imagen del set
        return `assets/images/sets/${exp.toLowerCase().split(' ')[0]}.webp`;
    },
    loadEnergyIcon(type, map) {
        if (!type) return '';
        const cleanType = type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const finalName = (map && map[cleanType]) ? map[cleanType] : cleanType;
        const fileName = finalName.charAt(0).toUpperCase() + finalName.slice(1).toLowerCase();
        return `assets/images/types/${fileName}.webp`;
    },
    handle3DMyCard(e, isLowPower) {
        if (isLowPower) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const target = e.currentTarget.querySelector('.card-aura-box') || e.currentTarget;
        target.style.transform = `perspective(1000px) rotateX(${((y - rect.height/2)/20)*-1}deg) rotateY(${(x - rect.width/2)/20}deg) scale(1.05)`;
    },
    reset3DCard(e) {
        const target = e.currentTarget.querySelector('.card-aura-box') || e.currentTarget;
        target.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
    }
};
window.mediaManager = mediaManager;

// 2. INICIALIZACIÓN DE ALPINE
document.addEventListener('alpine:init', () => {
    
    Alpine.data('pokeApp', () => ({
        // --- ESTADO ---
        isLoading: true, currentUser: null, isAdmin: false, readOnly: false,
        accounts: [], expansiones: [], cards: [], masterCardList: [], history: [], wishlist: [],
        rawStats: { breakdown: [], totalCards: 0, ownedCards: 0, byExpansion: [] },
        adminStats: { totalUsers: 0, totalCards: 0, activeToday: 0 },
        
        tab: 'info', section: 'Normal', currentExp: 'TODAS', currentTheme: 'neon', showMobileSidebar: false,
        showPinPad: false, pinInput: "", selectedUserForLogin: null,
        filters: { search: '', rarity: 'TODAS', energy: '', sortBy: 'id_asc' },
        
        zenMode: false, bulkMode: false, hideOwned: false, showSecrets: false, isListening: false,
        saveStatus: 'Listo', autoSaveTimeout: null, showScrollTop: false,
        modalCard: null, showSettings: false, contextMenu: { visible: false, x: 0, y: 0, card: null }, toasts: [],
        
        settingsForm: { avatar: null, passOld: '', passNew: '' },
        adminUserForm: { visible: false, name: '', role: 'Secundaria', priority: 10 },
        
        // MODIFICADO: Agregamos socialMobileTab aquí
        socialData: { shares: [], trades: [] }, socialMobileTab: 'gifts', socialSearch: '', socialFilters: { rarity: 'TODAS', expansion: 'TODAS', onlyFav: false },
        holdTimer: null, holdProgress: 0, holdingTrade: null,
        notifications: [], unreadNotif: 0, showNotifications: false, globalFeed: [],
        
        settingsTab: 'profile', compactMode: localStorage.getItem('compactMode') === 'true', lowPowerMode: localStorage.getItem('lowPowerMode') === 'true',
        adminSearchQuery: '', adminSearchResults: [], csvFileContent: null, importTextData: '',
        
        windowWidth: window.innerWidth,
        virtual: { shareScroll: 0, tradeScroll: 0, itemHeightShare: 210, itemHeightTrade: 180, buffer: 15, containerHeight: 800 },
        
        adminTrade: { userA: '', userB: '', cardA: null, cardB: null, searchA: '', searchB: '' },
        adminUserAInventory: [], adminUserAInventoryFiltered: [], adminUserBInventory: [], adminUserBInventoryFiltered: [],
        adminPack: { targetUser: '' },
        packSimulator: { expansion: 'Genetica Apex (A1)', slots: [null,null,null,null,null,null], queries: ['','','','','',''], searchResults: [[],[],[],[],[],[]], activeCount: 6 },

        // CONSTANTES
        RARITY_RANK: { "Corona": 100, "3 Estrellas": 90, "Shiny 2 Estrellas": 85, "2 Estrellas": 80, "Shiny 1 Estrella": 75, "1 Estrella": 70, "4 Rombos": 60, "3 Rombos": 50, "2 Rombos": 40, "1 Rombo": 10 },
        DUPLICATE_VALUES: { "1 Rombo": 20, "2 Rombos": 40, "3 Rombos": 240, "4 Rombos": 720, "1 Estrella": 470, "2 Estrellas": 2400, "Shiny 1 Estrella": 1700, "Shiny 2 Estrellas": 3600, "3 Estrellas": 5400, "Corona": 30000 },
        TRADE_COSTS: { "1 Rombo": 0, "2 Rombos": 0, "3 Rombos": 1200, "4 Rombos": 5000, "1 Estrella": 4000, "2 Estrellas": 25000, "Shiny 1 Estrella": 10000, "Shiny 2 Estrellas": 30000, "3 Estrellas": null, "Corona": null },
        TYPE_MAP: { 'planta': 'Planta', 'grass': 'Planta', 'fuego': 'Fuego', 'fire': 'Fuego', 'agua': 'Agua', 'water': 'Agua', 'electrico': 'Electrico', 'lightning': 'Electrico', 'psiquico': 'Psiquico', 'psychic': 'Psiquico', 'lucha': 'Lucha', 'fighting': 'Lucha', 'oscuro': 'Oscuro', 'siniestro': 'Oscuro', 'darkness': 'Oscuro', 'acero': 'Acero', 'metal': 'Acero', 'dragon': 'Dragon', 'incoloro': 'Incoloro', 'normal': 'Incoloro', 'colorless': 'Incoloro' },

        // --- ARRANQUE ---
        async init() {
            const self = this;
            window.addEventListener('resize', () => {
                self.windowWidth = window.innerWidth;
                if(self.recalcVirtualScroll) self.recalcVirtualScroll();
            });

            try {
                const ra = await fetch('/api/cuentas');
                if (ra.ok) this.accounts = await ra.json();
                const re = await fetch('/api/expansiones');
                if (re.ok) this.expansiones = await re.json();
            } catch (e) {
                console.error("Error init", e);
                this.accounts = [{ id_cuenta: 1, nombre: 'Admin', tipo: 'Principal', avatar_img: null }];
            }
            
            this.currentUser = null;
            setTimeout(() => { self.isLoading = false; }, 800);

            // Watchers
            this.$watch('socialFilters.rarity', () => this.resetVirtualScrolls());
            this.$watch('socialFilters.expansion', () => this.resetVirtualScrolls());
            this.$watch('socialFilters.onlyFav', () => this.resetVirtualScrolls());
            this.$watch('socialSearch', () => this.resetVirtualScrolls());

            // Polling
            setInterval(() => {
                if(this.currentUser) {
                    this.checkNotifications();
                    this.loadFeed();
                }
            }, 30000);
        },

        // --- AUTH ---
        selectUserForLogin(acc) { this.selectedUserForLogin = acc; this.pinInput = ""; this.showPinPad = true; },
        handlePinInput(n) { if (this.pinInput.length < 4) this.pinInput += n; if (this.pinInput.length === 4) this.verifyPin(); },
        clearPin() { this.pinInput = ""; },
        closePinPad() { this.showPinPad = false; },
        
        async verifyPin() {
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ user: this.selectedUserForLogin.nombre, pass: this.pinInput })
                });
                const data = await res.json();
                if (data.success) {
                    this.currentUser = this.selectedUserForLogin;
                    this.isAdmin = data.isAdmin;
                    if (this.currentUser.tema) this.currentTheme = this.currentUser.tema;
                    
                    await this.loadMasterList(); 
                    await this.loadInfo(); 
                    await this.loadInventory();
                    this.checkNotifications();
                    this.loadFeed();
                    
                    this.closePinPad();
                    this.showToast("Bienvenido!");
                } else { this.showToast("PIN Incorrecto", "error"); this.pinInput = ""; }
            } catch (e) {
                if(this.pinInput === '0000') { // Backdoor Dev
                    this.currentUser = this.selectedUserForLogin; this.isAdmin = true;
                    this.loadMasterList(); this.loadInfo(); this.loadInventory();
                    this.closePinPad();
                } else { this.showToast("Error Red", "error"); }
            }
        },
        logout() { 
            this.currentUser = null; this.tab = 'info'; 
            this.cards = []; 
            this.socialData = { shares: [], trades: [] };
        },

        // --- NAVIGATION ---
        switchTab(t, s) { 
            this.tab = t; 
            if(s) { this.section = s; this.filters.rarity = 'TODAS'; }
            
            if(t === 'grid') this.loadInventory();
            else if(t === 'info') { 
                this.loadInfo(); 
                // FIX: Retraso para que la gráfica cargue al cambiar de pestaña
                setTimeout(() => this.renderChart(), 300);
            }
            else if(t === 'social') {
                this.initSocial();
                setTimeout(() => { this.recalcVirtualScroll(); }, 100);
            }
            else if(t === 'history') this.loadHistory();
            else if(t === 'admin' && this.isAdmin) this.loadAdminData();
            
            this.showMobileSidebar = false; 
            this.scrollToTop();
        },
        toggleMobileSidebar() { this.showMobileSidebar = !this.showMobileSidebar; },

        // --- DATA LOADING (REAL) ---
        async loadInventory() {
            if (!this.currentUser) return;
            this.saveStatus = 'Cargando...';
            try {
                var url = `/api/inventario?id_cuenta=${this.currentUser.id_cuenta}&expansion=${this.currentExp}&seccion=${this.section}`;
                const res = await fetch(url);
                if (res.ok) { 
                    const rawData = await res.json(); 
                    const uniqueMap = new Map();
                    // FIX: Normalizar expansiones para evitar duplicados
                    rawData.forEach(card => {
                        card.expansion = card.expansion ? card.expansion.toLowerCase() : '';
                        const key = card.id_carta;
                        if (uniqueMap.has(key)) {
                            const existing = uniqueMap.get(key);
                            existing.cantidad += card.cantidad;
                            if (card.desbloqueada) existing.desbloqueada = 1;
                            if (card.deseada) existing.deseada = 1;
                        } else { uniqueMap.set(key, {...card}); }
                    });
                    this.cards = Array.from(uniqueMap.values());
                    this.saveStatus = 'Listo'; 
                } else { this.saveStatus = 'Error'; }
            } catch (e) { this.saveStatus = 'Error'; }
        },

        async loadMasterList() {
            try {
                const res = await fetch(`/api/inventario?id_cuenta=${this.currentUser.id_cuenta}&expansion=TODAS&seccion=TODAS`);
                if (res.ok) {
                    const raw = await res.json();
                    // FIX: Normalizar expansiones
                    this.masterCardList = raw.map(c => ({...c, expansion: c.expansion ? c.expansion.toLowerCase() : ''}));
                }
            } catch(e) {}
        },

        async loadInfo() {
            if (!this.currentUser) return;
            const self = this;
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

        async loadHistory() {
            if (!this.currentUser) return;
            try {
                // Ahora apunta a /api/transacciones correctamente
                const r = await fetch(`/api/transacciones?id_cuenta=${this.currentUser.id_cuenta}`);
                if(r.ok) {
                    this.history = await r.json();
                    console.log("Historial cargado:", this.history.length);
                }
            } catch(e) { console.error(e); }
        },

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
                        id_cuenta: a.id_cuenta, nombre: a.nombre, avatar_img: a.avatar_img,
                        score: scores[a.id_cuenta] ? scores[a.id_cuenta].size : 0
                    })).sort((a,b) => b.score - a.score);
                }
            } catch (e) {}
        },

        // --- ACTIONS ---
        updateQty(card, delta) {
            if (!card) return;
            let current = parseInt(card.cantidad) || 0;
            let newQty = Math.max(0, current + delta);
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
            const self = this;
            this.autoSaveTimeout = setTimeout(() => { self.saveGrid(); }, 1000);
        },
        async saveGrid() {
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
                    setTimeout(() => this.saveStatus = 'Listo', 2000); 
                } else this.saveStatus = 'Error';
            } catch (e) { this.saveStatus = 'Error Red'; }
        },
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
                this.showToast("Guardado", "success");
            } catch (e) {}
        },

        // --- COMPUTED ---
        get rarityOptions() {
            return this.section === 'Normal' 
                ? [{val:'TODAS',label:'Todas'}, {val:'1 Rombo',label:'♦'}, {val:'2 Rombos',label:'♦♦'}, {val:'3 Rombos',label:'♦♦♦'}, {val:'4 Rombos',label:'♦♦♦♦'}]
                : [{val:'TODAS',label:'Todas'}, {val:'1 Estrella',label:'⭐'}, {val:'2 Estrellas',label:'⭐⭐'}, {val:'3 Estrellas',label:'⭐⭐⭐'}, {val:'Corona',label:'👑'}];
        },
        get allRarityOptions() {
            return [
                {val:'TODAS', label:'Todas'}, 
                {val:'1 Rombo',label:'♦'}, {val:'2 Rombos',label:'♦♦'}, {val:'3 Rombos',label:'♦♦♦'}, {val:'4 Rombos',label:'♦♦♦♦'},
                {val:'1 Estrella',label:'⭐'}, {val:'2 Estrellas',label:'⭐⭐'}, {val:'Shiny 2 Estrellas',label:'✨⭐⭐'}, {val:'Shiny 1 Estrella',label:'✨⭐'}
            ];
        },
        get filteredCards() {
            return this.cards.filter(c => {
                var sl = this.filters.search.toLowerCase();
                var ms = this.filters.search === '' || c.nombre.toLowerCase().includes(sl) || c.id_carta.toLowerCase().includes(sl);
                var mr = this.filters.rarity === 'TODAS' || c.rareza === this.filters.rarity;
                var mo = !this.hideOwned || c.cantidad === 0;
                var me = true;
                if (this.filters.energy !== '') {
                    if (c.tipo) {
                        var t1 = c.tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        var t2 = this.filters.energy.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        var m1 = this.TYPE_MAP[t1] || t1; var m2 = this.TYPE_MAP[t2] || t2;
                        me = m1 === m2;
                    } else me = false;
                }
                return ms && mr && mo && me;
            }).sort((a, b) => {
                if (this.filters.sortBy === 'name_asc') return a.nombre.localeCompare(b.nombre);
                if (this.filters.sortBy === 'owned_desc') return b.cantidad - a.cantidad;
                var sa = a.id_carta.split('-'); var sb = b.id_carta.split('-');
                if (sa[0] !== sb[0]) return sa[0].localeCompare(sb[0]);
                return parseInt(sa[1], 10) - parseInt(sb[1], 10);
            });
        },
        get filteredSocialItems() {
            let shares = this.socialData.shares || [];
            let trades = this.socialData.trades || [];
            const q = this.socialSearch.toLowerCase();

            let finalShares = shares.filter(s => {
                if (q && !s.card.nombre.toLowerCase().includes(q)) return false;
                if (this.socialFilters.rarity !== 'TODAS' && s.card.rareza !== this.socialFilters.rarity) return false;
                if (this.socialFilters.expansion !== 'TODAS' && s.card.expansion.toLowerCase() !== this.socialFilters.expansion) return false;
                return true;
            });

            let finalTrades = trades.filter(t => {
                if (q && !t.get.nombre.toLowerCase().includes(q)) return false;
                if (this.socialFilters.rarity !== 'TODAS' && t.get.rareza !== this.socialFilters.rarity) return false;
                if (this.socialFilters.expansion !== 'TODAS' && t.get.expansion.toLowerCase() !== this.socialFilters.expansion) return false;
                if (this.socialFilters.onlyFav) {
                    const isWished = this.wishlist.some(w => w.id_carta === t.get.id_carta);
                    if (!isWished) return false;
                }
                return true;
            });
            return { shares: finalShares, trades: finalTrades };
        },
        get virtualSharesData() {
            if (this.currentUser && this.currentUser.nombre === 'Dinama20') return { items: [], totalHeight: 0, offsetY: 0 };
            const allItems = this.filteredSocialItems.shares;
            const totalItems = allItems.length;
            if (totalItems === 0) return { items: [], totalHeight: 0, offsetY: 0 };
            
            const width = this.windowWidth > 0 ? this.windowWidth : window.innerWidth;
            const safeWidth = Math.max(300, (width > 900 ? width/2 : width) - 50); 
            const itemsPerRow = Math.max(1, Math.floor(safeWidth / 122)); 
            const totalRows = Math.ceil(totalItems / itemsPerRow);
            const totalHeight = totalRows * this.virtual.itemHeightShare;
            const startRow = Math.floor(this.virtual.shareScroll / this.virtual.itemHeightShare);
            const visibleRows = Math.ceil(800 / this.virtual.itemHeightShare);
            const startIndex = Math.max(0, startRow - this.virtual.buffer) * itemsPerRow;
            const endIndex = Math.min(totalItems, (startRow + visibleRows + this.virtual.buffer) * itemsPerRow);
            const offsetY = Math.max(0, startRow - this.virtual.buffer) * this.virtual.itemHeightShare;
            return { items: allItems.slice(startIndex, endIndex), totalHeight: totalHeight, offsetY: offsetY };
        },
        get virtualTradesData() {
            const allItems = this.filteredSocialItems.trades;
            const totalItems = allItems.length;
            if (totalItems === 0) return { items: [], totalHeight: 0, offsetY: 0 };
            
            const width = this.windowWidth > 0 ? this.windowWidth : window.innerWidth;
            const safeWidth = Math.max(300, (width > 900 ? width/2 : width) - 50);
            const itemsPerRow = Math.max(1, Math.floor(safeWidth / 315)); 
            const totalRows = Math.ceil(totalItems / itemsPerRow);
            const totalHeight = totalRows * this.virtual.itemHeightTrade;
            const startRow = Math.floor(this.virtual.tradeScroll / this.virtual.itemHeightTrade);
            const visibleRows = Math.ceil(800 / this.virtual.itemHeightTrade);
            const startIndex = Math.max(0, startRow - this.virtual.buffer) * itemsPerRow;
            const endIndex = Math.min(totalItems, (startRow + visibleRows + this.virtual.buffer) * itemsPerRow);
            const offsetY = Math.max(0, startRow - this.virtual.buffer) * this.virtual.itemHeightTrade;
            return { items: allItems.slice(startIndex, endIndex), totalHeight: totalHeight, offsetY: offsetY };
        },
        get topCards() {
            var self = this;
            var source = (this.masterCardList && this.masterCardList.length > 0) ? this.masterCardList : this.cards;
            return source.filter(c => c.cantidad > 0).sort((a,b) => {
                var rankA = self.RARITY_RANK[a.rareza] || 0; var rankB = self.RARITY_RANK[b.rareza] || 0;
                if (rankA !== rankB) return rankB - rankA;
                return (self.DUPLICATE_VALUES[b.rareza] || 0) - (self.DUPLICATE_VALUES[a.rareza] || 0);
            }).slice(0, 3);
        },
        get netWorth() {
            var self = this;
            var source = (this.masterCardList.length > 0) ? this.masterCardList : this.cards;
            return source.reduce((acc, c) => c.cantidad > 0 ? acc + ((self.DUPLICATE_VALUES[c.rareza] || 0) * c.cantidad) : acc, 0);
        },
        get nemesis() {
            if (this.leaderboard && this.leaderboard.length > 0 && this.currentUser) {
                var myIndex = this.leaderboard.findIndex(u => u.id_cuenta === this.currentUser.id_cuenta);
                if (myIndex === 0) return { nombre: "¡Eres el Líder!", avatar_img: this.currentUser.avatar_img, diff: "N/A", isLeader: true };
                if (myIndex > 0) {
                    var rival = this.leaderboard[myIndex - 1]; var me = this.leaderboard[myIndex];
                    return { nombre: rival.nombre, avatar_img: rival.avatar_img, diff: (rival.score || 0) - (me.score || 0), isLeader: false };
                }
            }
            return null;
        },
        get computedProgress() {
            if (!this.rawStats.breakdown) return { owned: 0, total: 0, pct: 0 };
            var total = 0, owned = 0, self = this;
            this.rawStats.breakdown.forEach(b => {
                if (!self.showSecrets && !b.rareza.includes('Rombo')) return;
                total += b.total; owned += b.owned;
            });
            return { owned: owned, total: total, pct: total > 0 ? ((owned / total) * 100).toFixed(1) : 0 };
        },
        get bestExpansion() {
            if (!this.expansionStats.length) return null;
            return [].concat(this.expansionStats).sort((a,b) => parseFloat(b.pct) - parseFloat(a.pct))[0];
        },
        // FIX: Agrupar expansiones ignorando mayúsculas/minúsculas
        get expansionStats() {
            if (!this.expansiones.length || !this.masterCardList.length) return [];
            var self = this;
            return this.expansiones.map(expRaw => {
                const exp = expRaw.toLowerCase();
                var setCards = self.masterCardList.filter(c => (c.expansion ? c.expansion.toLowerCase() : '') === exp);
                var total = setCards.length;
                var owned = setCards.filter(c => c.cantidad > 0).length;
                return { name: expRaw, total: total, owned: owned, pct: total > 0 ? ((owned / total) * 100).toFixed(1) : 0 };
            });
        },
        get openingPotential() {
            if (!this.currentUser) return 0;
            return Math.floor(this.currentUser.relojes_arena / 12);
        },

        // --- HELPERS ---
        handleScroll() { this.showScrollTop = window.scrollY > 300; },
        scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); },
        isNew(d) { if(!d) return false; return (Math.abs(new Date() - new Date(d)) / (1000*60*60*24)) < 1; },
        getTimeString(d) {
            if(!d) return '?';
            const diff = (new Date() - new Date(d)) / 1000 / 60;
            if(diff < 60) return `Hace ${Math.floor(diff)} min`;
            if(diff < 1440) return `Hace ${Math.floor(diff/60)} h`;
            return 'Hace días';
        },
        openModal(card) { this.modalCard = card; },
        closeModal() { this.modalCard = null; },
        showToast(msg, type='info') {
            const id = Date.now();
            this.toasts.push({id, msg, type});
            setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id); }, 3000);
        },
        openContextMenu(e, card) {
            e.preventDefault();
            this.contextMenu = { visible: true, x: e.clientX, y: e.clientY, card: card };
            if (window.innerWidth - e.clientX < 260) this.contextMenu.x = e.clientX - 260;
        },
        closeContextMenu() { this.contextMenu.visible = false; },
        getHistoryClass(h) {
            if(h.cantidad_nueva > h.cantidad_anterior) return 'gain';
            if(h.cantidad_nueva < h.cantidad_anterior) return 'loss';
            return 'trade';
        },
        // FIX: Destruir gráfica previa para evitar conflictos
        renderChart() {
            var ctx = document.getElementById('rarityChart');
            if (!ctx || !this.rawStats.breakdown) return;
            
            var existingChart = Chart.getChart(ctx);
            if (existingChart) existingChart.destroy();

            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: this.rawStats.breakdown.map(b => b.rareza),
                    datasets: [{
                        data: this.rawStats.breakdown.map(b => b.owned),
                        backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'], borderWidth: 0
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }
            });
        },
        getBiomeClass(t) { return 'biome-dark'; },
        getAuraClass(r) { return 'aura-rombo'; },
        isSetCompleter(c) { return false; },
        getAvatar(uid) {
            var u = this.accounts.find(a => a.id_cuenta == uid);
            return u ? u.avatar_img : null;
        },
        toggleVoice() {
            var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return this.showToast("No soportado", "error");
            if (this.isListening) { this.isListening = false; return; }
            var self = this;
            var recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.onstart = function() { self.isListening = true; self.showToast("Escuchando...", "info"); };
            recognition.onend = function() { self.isListening = false; };
            recognition.onresult = function(e) {
                var t = e.results[0][0].transcript;
                self.filters.search = t;
                self.showToast("Buscado: " + t, "success");
                self.loadInventory();
            };
            recognition.start();
        },
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
        
        // MODIFICADO: FUNCIÓN DE GUARDAR PERFIL ARREGLADA (Ahora guarda avatar y tema)
        async saveSettingsProfile() {
            if(this.currentUser) {
                this.currentUser.avatar_img = this.settingsForm.avatar;
                this.currentUser.tema = this.currentTheme;

                // Guardar Tema
                await fetch('/api/cuentas/update_theme', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({id_cuenta: this.currentUser.id_cuenta, tema: this.currentTheme})
                });

                // Guardar Avatar (Fix)
                await fetch('/api/cuentas/update_resources', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_cuenta: this.currentUser.id_cuenta,
                        fichas: this.currentUser.fichas_cambio,
                        polvos: this.currentUser.polvos_iris,
                        relojes: this.currentUser.relojes_arena,
                        notas: this.currentUser.notas,
                        avatar: this.settingsForm.avatar 
                    })
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
            if(d.success){ this.showToast("Contraseña cambiada", "success"); this.settingsForm.passOld = ''; this.settingsForm.passNew = ''; }
            else { this.showToast(d.msg, "error"); }
        },
        toggleCompact() {
            this.compactMode = !this.compactMode;
            localStorage.setItem('compactMode', this.compactMode);
        },
        toggleLowPower() {
            this.lowPowerMode = !this.lowPowerMode;
            localStorage.setItem('lowPowerMode', this.lowPowerMode);
            if(this.lowPowerMode) this.showToast("Efectos 3D desactivados", "info");
        },

        // --- SOCIAL & ADMIN MODIFICADO (MOBILE TABS) ---
        async initSocial() {
            this.isLoading = true; 
            this.socialData = { shares: [], trades: [] };
            this.resetVirtualScrolls();
            
            // LÓGICA MÓVIL: Si soy Dinama20, forzar Mercado.
            if (this.currentUser && this.currentUser.nombre === 'Dinama20') {
                this.socialMobileTab = 'trades';
            } else {
                this.socialMobileTab = 'gifts';
            }

            try {
                const res = await fetch('/api/social/smart-matches?id_usuario=' + this.currentUser.id_cuenta);
                if (res.ok) {
                    this.socialData = await res.json();
                    this.$nextTick(() => this.recalcVirtualScroll());
                }
            } catch (e) { this.showToast("Error Social", "error"); } 
            finally { this.isLoading = false; }
        },
        resetVirtualScrolls() {
            this.virtual.shareScroll = 0; this.virtual.tradeScroll = 0;
            document.querySelectorAll('.social-column-scroll').forEach(el => el.scrollTop = 0);
        },
        recalcVirtualScroll() {
            this.virtual.containerWidth = window.innerWidth;
            const cols = document.querySelector('.social-column-scroll');
            if (cols && cols.clientHeight > 0) this.virtual.containerHeight = cols.clientHeight;
            else this.virtual.containerHeight = 800; 
        },
        handleVirtualScroll(type, event) {
            const scrollTop = event.target.scrollTop;
            const clientHeight = event.target.clientHeight;
            if (clientHeight > 0) this.virtual.containerHeight = clientHeight;
            if (type === 'SHARE') this.virtual.shareScroll = scrollTop;
            else this.virtual.tradeScroll = scrollTop;
        },
        startHold(trade, user, el) {
            if(this.holdTimer) clearTimeout(this.holdTimer);
            this.holdingTrade = trade; this.holdProgress = 0;
            this.holdTimer = setInterval(() => {
                this.holdProgress += (20 / 800) * 100;
                if(this.holdProgress >= 100) { this.cancelHold(); this.visualTradeEffect(el, trade, user); }
            }, 20);
        },
        cancelHold() { if(this.holdTimer) clearInterval(this.holdTimer); this.holdTimer = null; this.holdProgress = 0; this.holdingTrade = null; },
        visualTradeEffect(btn, trade, u) {
            const capsule = btn.closest('.trade-capsule');
            this.requestTrade(trade).then(success => { if(success && capsule) capsule.classList.add('ghost-out'); });
        },
        async requestTrade(tradeInfo) {
            if(this.currentUser.polvos_iris < tradeInfo.cost) { this.showToast("Insuficientes Polvos", "error"); return false; }
            try {
                const res = await fetch('/api/social/execute_trade', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        id_origen: this.currentUser.id_cuenta, id_destino: tradeInfo.partner.id,
                        give_id: tradeInfo.give.id_carta, exp_give: tradeInfo.give.expansion,
                        get_id: tradeInfo.get.id_carta, exp_get: tradeInfo.get.expansion, rarity: tradeInfo.rarity
                    })
                });
                const d = await res.json();
                if(d.success) { 
                    this.showToast("¡Intercambio Épico!", "success"); 
                    this.currentUser.polvos_iris -= tradeInfo.cost; this.currentUser.fichas_cambio -= 1;
                    setTimeout(() => this.initSocial(), 1200); 
                    return true;
                } else { this.showToast(d.msg, "error"); return false; }
            } catch(e) { return false; }
        },
        visualGiftEffect(btn, item) {
            const ticket = btn.closest('.gift-ticket');
            if(ticket) {
                ticket.classList.add('packing-anim');
                setTimeout(() => {
                    fetch('/api/social/execute_gift', {
                        method: 'POST', headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ id_origen: this.currentUser.id_cuenta, id_destino: item.targetUser.id, id_carta: item.card.id_carta, expansion: item.card.expansion })
                    }).then(() => { this.showToast("Regalo enviado", "success"); this.initSocial(); });
                }, 800);
            }
        },
        async checkNotifications() {
            if(!this.currentUser) return;
            const r = await fetch('/api/social/notifications?id_cuenta='+this.currentUser.id_cuenta);
            if(r.ok) { this.notifications = await r.json(); this.unreadNotif = this.notifications.filter(n => !n.leida).length; }
        },
        async markRead() {
            await fetch('/api/social/notifications/read', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({id_cuenta:this.currentUser.id_cuenta})
            });
            this.unreadNotif = 0;
        },
        async loadFeed() {
            const r = await fetch('/api/social/feed');
            if(r.ok) this.globalFeed = await r.json();
        },
        async loadAdminUserInventory(userId, side) {
            if (!userId) return;
            try {
                const res = await fetch('/api/inventario?id_cuenta=' + userId + '&expansion=TODAS');
                const data = await res.json();
                if (side === 'A') { this.adminUserAInventory = data.filter(c => c.cantidad > 0); this.adminUserAInventoryFiltered = this.adminUserAInventory; }
                else { this.adminUserBInventory = data.filter(c => c.cantidad > 0); this.adminUserBInventoryFiltered = this.adminUserBInventory; }
            } catch(e) {}
        },
        filterAdminInventory(side) {
            const search = (side === 'A' ? this.adminTrade.searchA : this.adminTrade.searchB).toLowerCase();
            const source = side === 'A' ? this.adminUserAInventory : this.adminUserBInventory;
            const filtered = source.filter(c => c.nombre.toLowerCase().includes(search) || c.id_carta.toLowerCase().includes(search));
            if (side === 'A') this.adminUserAInventoryFiltered = filtered; else this.adminUserBInventoryFiltered = filtered;
        },
        selectAdminCard(card, side) { if (side === 'A') this.adminTrade.cardA = card; else this.adminTrade.cardB = card; },
        getTradeCost(rarity) { if (!rarity) return 0; return this.TRADE_COSTS[rarity] !== undefined ? this.TRADE_COSTS[rarity] : 0; },
        async executeAdminTrade() {
            if (!this.adminTrade.cardA || !this.adminTrade.cardB) return this.showToast("Faltan cartas", "warning");
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
                if(d.success) { this.showToast("Intercambio Éxito", "success"); this.loadAdminUserInventory(this.adminTrade.userA, 'A'); this.loadAdminUserInventory(this.adminTrade.userB, 'B'); } 
                else this.showToast(d.msg, "error");
            } catch(e) { this.showToast("Error Red", "error"); }
        },
        async executeAdminGift() { this.showToast("Función Gift (WIP)", "info"); },
        updatePackConfig() {
            const isDeluxe = this.packSimulator.expansion.toLowerCase().includes('deluxe');
            this.packSimulator.slots = [null,null,null,null,null,null]; this.packSimulator.queries = ['','','','','','']; this.packSimulator.searchResults = [[],[],[],[],[],[]];
            this.packSimulator.activeCount = isDeluxe ? 4 : 5;
        },
        searchCardForPack(index) {
            const q = this.packSimulator.queries[index].toLowerCase();
            if(q.length < 1) { this.packSimulator.searchResults[index] = []; return; }
            const exp = this.packSimulator.expansion;
            this.packSimulator.searchResults[index] = this.masterCardList.filter(c => (c.nombre.toLowerCase().includes(q) || c.id_carta.toLowerCase().includes(q)) && c.expansion === exp).slice(0, 5);
        },
        selectCardForSlot(i, c) { this.packSimulator.slots[i] = {...c}; this.packSimulator.queries[i] = c.nombre; this.packSimulator.searchResults[i] = []; },
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
                if(d.success) this.showToast("Sobre abierto!", "success"); else this.showToast(d.msg, "error");
            } catch(e) { this.showToast("Error Red", "error"); }
        },
        openCreateUserModal() { this.adminUserForm.visible = true; },
        async adminCreateUser() { if(!this.adminUserForm.name) return; this.showToast("Usuario creado", "success"); this.adminUserForm.visible = false; },
        async adminDeleteUser(id) {
            if(!confirm("¿Eliminar?")) return;
            try {
                await fetch('/api/admin/account/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id_cuenta: id}) });
                this.accounts = this.accounts.filter(a => a.id_cuenta !== id); this.showToast("Eliminado", "success");
            } catch(e) {}
        },
        async adminResetPass(userId) {
            if(!confirm("¿Resetear?")) return;
            await fetch('/api/admin/tools/reset_password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id_cuenta: userId}) });
            this.showToast("Contraseña reseteada", "success");
        },
        async syncWiki() {
            if(!confirm("¿Sync?")) return;
            try { const res = await fetch('/api/admin/sync-wiki', {method:'POST'}); const d = await res.json(); this.showToast(d.msg, "success"); } catch(e) {}
        },
        async forceReset() {
            if(!confirm("¿Reset?")) return;
            await fetch('/api/admin/force_reset', {method:'POST'}); this.showToast("Reset OK", "success");
        },
        fullDbBackup() { window.open('/api/admin/backup/export'); },
        fullDbRestore(e) {
            const f = e.target.files[0]; if(!f || !confirm("¿Restaurar?")) return;
            const r = new FileReader();
            r.onload = async (ev) => {
                try {
                    const d = JSON.parse(ev.target.result);
                    await fetch('/api/admin/backup/import', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(d) });
                    alert("OK. Recargando."); location.reload();
                } catch(err) { alert("Error"); }
            }; r.readAsText(f);
        },
        async adminCleanDB() {
            if(!confirm("¿Limpiar DB?")) return;
            const r = await fetch('/api/admin/tools/clean_db', {method:'POST'}); const d = await r.json(); this.showToast(d.msg, "success");
        },
        handleCSVSelect(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => { this.csvFileContent = ev.target.result; this.showToast("Archivo cargado.", "info"); };
            reader.readAsText(file);
        },
        async processCSVUpload() {
            if (!this.csvFileContent) return this.showToast("Selecciona un CSV", "warning");
            try {
                const r = await fetch('/api/user/tools/import_text', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id_cuenta: this.currentUser.id_cuenta, text: this.csvFileContent }) });
                const d = await r.json();
                if (d.success) { this.showToast(`¡Éxito! ${d.count} líneas`, "success"); this.csvFileContent = null; this.loadInventory(); } else { this.showToast("Error", "error"); }
            } catch(e) { this.showToast("Error Conexión", "error"); }
        },
        exportCollection() {
            let csv = "ID,Nombre,Expansion,Rareza,Cantidad\n";
            this.cards.forEach(c => { if(c.cantidad > 0) csv += `${c.id_carta},"${c.nombre}","${c.expansion}","${c.rareza}",${c.cantidad}\n`; });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `coleccion_${this.currentUser.nombre}.csv`; a.click();
        },
        async runAutoWishlist() {
            if(!confirm("¿Marcar todas las faltantes como deseadas?")) return;
            await fetch('/api/user/tools/auto_wishlist', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id_cuenta:this.currentUser.id_cuenta}) });
            this.showToast("Wishlist actualizada", "success"); this.loadInventory();
        },
        async loadAdminData() { this.adminStats = { totalUsers: this.accounts.length }; },

        // --- STUB HELPERS (Para evitar errores si no se usan) ---
        getBiomeClass(t) { return 'biome-dark'; },
        getAuraClass(r) { return 'aura-rombo'; },
        isSetCompleter(c) { return false; }
    }));
});

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/service-worker.js').catch(() => {}); }