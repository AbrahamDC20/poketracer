/* ==========================================================================
   MÓDULO: STORE (VARIABLES GLOBALES)
   ========================================================================== */
export const initialState = () => ({
    // Estado
    isLoading: true,
    currentUser: null,
    isAdmin: false,
    readOnly: false,

    // Datos Maestros
    accounts: [],
    expansiones: [],
    cards: [],
    masterCardList: [],
    history: [],
    wishlist: [],
    
    // Estadísticas
    rawStats: { breakdown: [], totalCards: 0, ownedCards: 0, byExpansion: [] },
    adminStats: { totalUsers: 0, totalCards: 0, activeToday: 0 },

    // UI
    tab: 'info',
    section: 'Normal',
    currentExp: 'TODAS',
    currentTheme: 'neon',
    showMobileSidebar: false,
    
    // Seguridad
    showPinPad: false,
    pinInput: "",
    selectedUserForLogin: null,

    // Filtros
    filters: { search: '', rarity: 'TODAS', energy: '', sortBy: 'id_asc' },
    
    // Flags
    zenMode: false,
    bulkMode: false,
    hideOwned: false,
    showSecrets: false,
    isListening: false,
    saveStatus: 'Listo',
    autoSaveTimeout: null,
    showScrollTop: false,
    
    // Modales
    modalCard: null,
    showSettings: false,
    contextMenu: { visible: false, x: 0, y: 0, card: null },
    toasts: [],

    // Formularios
    settingsForm: { avatar: null, passOld: '', passNew: '' },
    adminUserForm: { visible: false, name: '', role: 'Secundaria', priority: 10 },

    // Social
    socialData: { shares: [], trades: [] }, 
    socialSearch: '',
    socialFilters: { rarity: 'TODAS', expansion: 'TODAS', onlyFav: false },
    holdTimer: null,
    holdProgress: 0,
    holdingTrade: null,

    // Notificaciones
    notifications: [],
    unreadNotif: 0,
    showNotifications: false,
    globalFeed: [],
    
    // Configuración
    settingsTab: 'profile',
    compactMode: localStorage.getItem('compactMode') === 'true',
    lowPowerMode: localStorage.getItem('lowPowerMode') === 'true',
    
    // Admin Tools
    adminSearchQuery: '',
    adminSearchResults: [],
    csvFileContent: null,
    importTextData: '',

    // Virtual Scroll
    windowWidth: window.innerWidth,
    virtual: {
        shareScroll: 0,
        tradeScroll: 0,
        itemHeightShare: 210, 
        itemHeightTrade: 180, 
        buffer: 15,
        containerHeight: 800
    },

    // Admin Legacy
    adminTrade: { userA: '', userB: '', cardA: null, cardB: null, searchA: '', searchB: '' },
    adminUserAInventory: [], adminUserAInventoryFiltered: [],
    adminUserBInventory: [], adminUserBInventoryFiltered: [],
    adminPack: { targetUser: '' },
    packSimulator: { 
        expansion: 'Genetica Apex (A1)', 
        slots: [null,null,null,null,null,null], 
        queries: ['','','','','',''], 
        searchResults: [[],[],[],[],[],[]], 
        activeCount: 6 
    },

    // Constantes
    RARITY_RANK: { 
        "Corona": 100, "3 Estrellas": 90, "Shiny 2 Estrellas": 85, "2 Estrellas": 80,
        "Shiny 1 Estrella": 75, "1 Estrella": 70, "4 Rombos": 60, "3 Rombos": 50,
        "2 Rombos": 40, "1 Rombo": 10 
    },
    
    DUPLICATE_VALUES: {
        "1 Rombo": 20, "2 Rombos": 40, "3 Rombos": 240, "4 Rombos": 720,
        "1 Estrella": 470, "2 Estrellas": 2400, "Shiny 1 Estrella": 1700,
        "Shiny 2 Estrellas": 3600, "3 Estrellas": 5400, "Corona": 30000
    },

    TRADE_COSTS: {
        "1 Rombo": 0, "2 Rombos": 0, "3 Rombos": 1200, "4 Rombos": 5000,
        "1 Estrella": 4000, "2 Estrellas": 25000, "Shiny 1 Estrella": 10000,
        "Shiny 2 Estrellas": 30000, "3 Estrellas": null, "Corona": null
    },

    TYPE_MAP: {
        'planta': 'Planta', 'grass': 'Planta', 'fuego': 'Fuego', 'fire': 'Fuego',
        'agua': 'Agua', 'water': 'Agua', 'electrico': 'Electrico', 'lightning': 'Electrico',
        'psiquico': 'Psiquico', 'psychic': 'Psiquico', 'lucha': 'Lucha', 'fighting': 'Lucha',
        'oscuro': 'Oscuro', 'siniestro': 'Oscuro', 'darkness': 'Oscuro', 'acero': 'Acero',
        'metal': 'Acero', 'dragon': 'Dragon', 'incoloro': 'Incoloro', 'normal': 'Incoloro', 'colorless': 'Incoloro'
    }
});