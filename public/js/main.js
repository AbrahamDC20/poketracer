/* ==========================================================================
   MAIN.JS - MODO SEGURO (CON STORE Y MEDIA INTEGRADOS)
   ========================================================================== */

// Importamos solo los módulos de lógica para simplificar
import { authModule } from './modules/auth.js';
import { inventoryModule } from './modules/inventory.js';
import { socialModule } from './modules/social.js';
import { adminModule } from './modules/admin.js';
import { helpersModule } from './utils/helpers.js';

console.log('🔄 Cargando Main.js en Modo Seguro...');

// 1. DEFINIMOS EL GESTOR DE MEDIOS AQUÍ DIRECTAMENTE
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
        return `assets/images/sets/${exp.split(' ')[0]}.webp`;
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

// Exponer globalmente (CRÍTICO para el HTML)
window.mediaManager = mediaManager;

// 2. DEFINIMOS EL ESTADO INICIAL AQUÍ DIRECTAMENTE
const initialState = () => ({
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
    socialData: { shares: [], trades: [] }, socialSearch: '', socialFilters: { rarity: 'TODAS', expansion: 'TODAS', onlyFav: false },
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
    RARITY_RANK: { "Corona": 100, "3 Estrellas": 90, "Shiny 2 Estrellas": 85, "2 Estrellas": 80, "Shiny 1 Estrella": 75, "1 Estrella": 70, "4 Rombos": 60, "3 Rombos": 50, "2 Rombos": 40, "1 Rombo": 10 },
    DUPLICATE_VALUES: { "1 Rombo": 20, "2 Rombos": 40, "3 Rombos": 240, "4 Rombos": 720, "1 Estrella": 470, "2 Estrellas": 2400, "Shiny 1 Estrella": 1700, "Shiny 2 Estrellas": 3600, "3 Estrellas": 5400, "Corona": 30000 },
    TRADE_COSTS: { "1 Rombo": 0, "2 Rombos": 0, "3 Rombos": 1200, "4 Rombos": 5000, "1 Estrella": 4000, "2 Estrellas": 25000, "Shiny 1 Estrella": 10000, "Shiny 2 Estrellas": 30000, "3 Estrellas": null, "Corona": null },
    TYPE_MAP: { 'planta': 'Planta', 'grass': 'Planta', 'fuego': 'Fuego', 'fire': 'Fuego', 'agua': 'Agua', 'water': 'Agua', 'electrico': 'Electrico', 'lightning': 'Electrico', 'psiquico': 'Psiquico', 'psychic': 'Psiquico', 'lucha': 'Lucha', 'fighting': 'Lucha', 'oscuro': 'Oscuro', 'siniestro': 'Oscuro', 'darkness': 'Oscuro', 'acero': 'Acero', 'metal': 'Acero', 'dragon': 'Dragon', 'incoloro': 'Incoloro', 'normal': 'Incoloro', 'colorless': 'Incoloro' }
});

// 3. INICIALIZAR ALPINE
document.addEventListener('alpine:init', () => {
    Alpine.data('pokeApp', () => ({
        ...initialState(),
        ...authModule,
        ...inventoryModule,
        ...socialModule,
        ...adminModule,
        ...helpersModule,
        mediaManager: mediaManager,

        async init() {
            console.log('🚀 Sistema arrancando...');
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
                console.error("Error init:", e);
                this.accounts = [{ id_cuenta: 1, nombre: 'Admin', tipo: 'Principal', avatar_img: null }];
                this.expansiones = ['Genetica Apex (A1)'];
            }
            
            this.currentUser = null;
            setTimeout(() => { self.isLoading = false; }, 800);

            this.$watch('socialFilters.rarity', () => this.resetVirtualScrolls && this.resetVirtualScrolls());
            this.$watch('socialFilters.expansion', () => this.resetVirtualScrolls && this.resetVirtualScrolls());
            this.$watch('socialFilters.onlyFav', () => this.resetVirtualScrolls && this.resetVirtualScrolls());
            this.$watch('socialSearch', () => this.resetVirtualScrolls && this.resetVirtualScrolls());

            setInterval(() => {
                if(this.currentUser) {
                    if(this.checkNotifications) this.checkNotifications();
                    if(this.loadFeed) this.loadFeed();
                }
            }, 30000);
        }
    }));
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
}