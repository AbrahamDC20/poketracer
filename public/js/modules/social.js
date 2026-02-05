/* ==========================================================================
   MÓDULO: SOCIAL (VERSIÓN FIX: SIN VIRTUAL SCROLL Y CON FILTRO USUARIO)
   Mercado, Regalos, Feed, Notificaciones
   ========================================================================== */

export const socialModule = {
    
    // Iniciar datos sociales
    async initSocial() {
        this.isLoading = true; 
        this.socialData = { shares: [], trades: [] };
        
        try {
            const res = await fetch('/api/social/smart-matches?id_usuario=' + this.currentUser.id_cuenta);
            if (res.ok) {
                this.socialData = await res.json();
            }
        } catch (e) {
            this.showToast("Error cargando social", "error");
        } finally {
            this.isLoading = false;
        }
    },

    // --- FILTRADO POTENTE (FIX PUNTO 6) ---
    get filteredSocialItems() {
        // Obtenemos filtros reactivos de Alpine
        const rarity = this.socialFilters.rarity;
        const exp = this.socialFilters.expansion;
        const onlyFav = this.socialFilters.onlyFav;
        // Nos aseguramos que sea string y minúsculas para evitar errores
        const userSearch = String(this.socialFilters.user || '').toLowerCase().trim();
        const globalSearch = String(this.socialSearch || '').toLowerCase().trim();

        // Función de filtrado común para Gifts y Trades
        const filterFn = (item) => {
            // Unificar estructura: en Gift es 'card', en Trade es 'get' (la carta que recibes)
            const card = item.card || item.get; 
            // Unificar usuario: en Gift es 'targetUser', en Trade es 'partner'
            const userObj = item.targetUser || item.partner;
            // Obtenemos el nombre del usuario de forma segura
            const userName = userObj ? String(userObj.name).toLowerCase() : '';

            // 1. Filtro Usuario (CORREGIDO)
            // Si hay un usuario seleccionado en el filtro, debe coincidir
            if (userSearch && userSearch !== '' && !userName.includes(userSearch)) {
                return false;
            }

            // 2. Filtro Rareza
            if (rarity !== 'TODAS' && card.rareza !== rarity) return false;
            
            // 3. Filtro Expansión
            if (exp !== 'TODAS' && card.expansion !== exp) return false;
            
            // 4. Filtro Favoritos (Wishlist)
            if (onlyFav && !card.deseada) return false;

            // 5. Búsqueda Global (Input texto: busca en nombre de carta O nombre de usuario)
            if (globalSearch) {
                const matchCard = card.nombre.toLowerCase().includes(globalSearch);
                const matchUser = userName.includes(globalSearch);
                if (!matchCard && !matchUser) return false;
            }

            return true;
        };

        // Devolvemos los arrays filtrados
        return {
            shares: this.socialData.shares.filter(filterFn),
            trades: this.socialData.trades.filter(filterFn)
        };
    },

    // --- DATOS PARA VISTA (SIN VIRTUAL SCROLL) ---
    // Devolvemos la lista entera para que el CSS nativo maneje el scroll.
    // Esto soluciona que "se vean cortados" o "no carguen todos".
    
    get virtualSharesData() {
        return { items: this.filteredSocialItems.shares, totalHeight: 'auto', offsetY: 0 };
    },

    get virtualTradesData() {
        return { items: this.filteredSocialItems.trades, totalHeight: 'auto', offsetY: 0 };
    },

    // Funciones dummy para evitar errores si el HTML antiguo las llama
    resetVirtualScrolls() {},
    recalcVirtualScroll() {},
    handleVirtualScroll(type, event) {}, // El scroll ahora es nativo CSS

    // --- LÓGICA DE INTERCAMBIO (HOLD) ---

    startHold(trade, user, el) {
        if(this.holdTimer) clearTimeout(this.holdTimer);
        
        this.holdingTrade = trade;
        this.holdProgress = 0;
        
        const step = 20; 
        const duration = 800; // 0.8 segundos para confirmar
        
        this.holdTimer = setInterval(() => {
            this.holdProgress += (step / duration) * 100;
            if(this.holdProgress >= 100) {
                this.cancelHold();
                this.visualTradeEffect(el, trade, user);
            }
        }, step);
    },

    cancelHold() {
        if(this.holdTimer) clearInterval(this.holdTimer);
        this.holdTimer = null;
        this.holdProgress = 0;
        this.holdingTrade = null;
    },

    // --- EJECUCIÓN DE ACCIONES ---

    visualTradeEffect(btn, trade, u) {
        // Efecto visual antes de la petición
        const capsule = btn.closest('.trade-capsule');
        this.requestTrade(trade).then(success => { 
            if(success && capsule) {
                capsule.style.transition = "transform 0.5s, opacity 0.5s";
                capsule.style.transform = "translateX(100%)";
                capsule.style.opacity = "0";
                setTimeout(() => {
                    // Eliminamos localmente para feedback instantáneo
                    this.socialData.trades = this.socialData.trades.filter(t => t !== trade);
                }, 500);
            }
        });
    },

    async requestTrade(tradeInfo) {
        if(this.currentUser.polvos_iris < tradeInfo.cost) {
            this.showToast("No tienes suficientes Polvos Iris", "error");
            return false;
        }
        
        try {
            const res = await fetch('/api/social/execute_trade', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    id_origen: this.currentUser.id_cuenta, 
                    id_destino: tradeInfo.partner.id,
                    give_id: tradeInfo.give.id_carta, 
                    exp_give: tradeInfo.give.expansion,
                    get_id: tradeInfo.get.id_carta, 
                    exp_get: tradeInfo.get.expansion,
                    rarity: tradeInfo.rarity
                })
            });
            const d = await res.json();
            
            if(d.success) { 
                this.showToast("¡Intercambio Épico Realizado!", "success");
                
                // Actualizar recursos visualmente
                this.currentUser.polvos_iris -= tradeInfo.cost;
                this.currentUser.fichas_cambio = (this.currentUser.fichas_cambio || 0) - 1;
                
                // Efecto confeti
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                
                // Recargar datos en segundo plano
                this.loadInventory(); 
                return true;
            } else {
                this.showToast(d.msg || "Error en el intercambio", "error");
                return false;
            }
        } catch(e) { 
            this.showToast("Error de conexión", "error"); 
            return false;
        }
    },

    // --- LOGICA DE REGALOS (WONDER TRADE) ---
    
    visualGiftEffect(btn, item) {
        const ticket = btn.closest('.gift-ticket');
        
        // Animación CSS (asume que existe clase packing-anim o fade-out)
        if(ticket) {
            ticket.style.transition = "all 0.5s";
            ticket.style.transform = "scale(0)";
            ticket.style.opacity = "0";
        }
        
        // Ejecutar envío
        this.requestShare(item);
    },

    async requestShare(item) {
        try {
            const res = await fetch('/api/social/execute_gift', {
                method: 'POST', 
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    id_origen: this.currentUser.id_cuenta, 
                    id_destino: item.targetUser.id, 
                    id_carta: item.card.id_carta, 
                    expansion: item.card.expansion 
                })
            });
            
            if(res.ok) {
                this.showToast("🎁 Regalo enviado a " + item.targetUser.name, "success");
                // Eliminar de la lista local
                this.socialData.shares = this.socialData.shares.filter(s => s !== item);
            }
        } catch(e) { console.error(e); }
    },

    // --- NOTIFICACIONES Y FEED ---

    async checkNotifications() {
        if(!this.currentUser) return;
        try {
            const r = await fetch('/api/social/notifications?id_cuenta='+this.currentUser.id_cuenta);
            if(r.ok) {
                this.notifications = await r.json();
                this.unreadNotif = this.notifications.filter(n => !n.leida).length;
            }
        } catch(e) {}
    },

    async markRead() {
        if(this.unreadNotif === 0) return;
        try {
            await fetch('/api/social/notifications/read', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({id_cuenta:this.currentUser.id_cuenta})
            });
            this.unreadNotif = 0;
        } catch(e) {}
    },

    async loadFeed() {
        try {
            const r = await fetch('/api/social/feed');
            if(r.ok) this.globalFeed = await r.json();
        } catch(e) {}
    },

    // Helpers Visuales
    getBiomeClass(type) {
        if(!type) return 'biome-base';
        return 'biome-' + type.toLowerCase();
    },
    
    getAuraClass(rarity) {
        if(!rarity) return '';
        if(rarity.includes('Corona')) return 'aura-rainbow';
        if(rarity.includes('Estrella')) return 'aura-gold';
        if(rarity.includes('4 Rombos')) return 'aura-purple';
        return 'aura-blue';
    },

    isSetCompleter(card) {
        // Lógica simple: Si la desea es True, asumimos que completa set o es buscada
        return card.deseada === true || card.deseada === 1;
    }
};