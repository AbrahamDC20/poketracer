/* ==========================================================================
   MÓDULO: SOCIAL
   Mercado, Regalos, Feed, Notificaciones y Scroll Virtual
   ========================================================================== */

export const socialModule = {
    
    // Iniciar datos sociales
    async initSocial() {
        this.isLoading = true; 
        this.socialData = { shares: [], trades: [] };
        
        this.resetVirtualScrolls();
        
        try {
            const res = await fetch('/api/social/smart-matches?id_usuario=' + this.currentUser.id_cuenta);
            if (res.ok) {
                this.socialData = await res.json();
                this.$nextTick(() => this.recalcVirtualScroll());
            }
        } catch (e) {
            this.showToast("Error Social", "error");
        } finally {
            this.isLoading = false;
        }
    },

    // Helpers de Interfaz Social
    toggleUserAccordion(user) { this.expandedUser = (this.expandedUser === user.user.id) ? null : user.user.id; },
    hasTrades(user) { return user.trades && user.trades.length > 0; },

    // --- VIRTUAL SCROLL LOGIC ---
    
    resetVirtualScrolls() {
        this.virtual.shareScroll = 0;
        this.virtual.tradeScroll = 0;
        document.querySelectorAll('.social-column-scroll').forEach(el => el.scrollTop = 0);
    },
    
    recalcVirtualScroll() {
        this.virtual.containerWidth = window.innerWidth;
        const cols = document.querySelector('.social-column-scroll');
        if (cols && cols.clientHeight > 0) {
            this.virtual.containerHeight = cols.clientHeight;
        } else {
            this.virtual.containerHeight = 800; // Altura segura por defecto
        }
    },

    handleVirtualScroll(type, event) {
        const scrollTop = event.target.scrollTop;
        const clientHeight = event.target.clientHeight;
        
        if (clientHeight > 0 && this.virtual.containerHeight !== clientHeight) {
            this.virtual.containerHeight = clientHeight;
        }

        if (type === 'SHARE') {
            this.virtual.shareScroll = scrollTop;
        } else {
            this.virtual.tradeScroll = scrollTop;
        }
    },

    // --- HOLD TO TRADE LOGIC ---

    startHold(trade, user, el) {
        if(this.holdTimer) clearTimeout(this.holdTimer);
        
        this.holdingTrade = trade;
        this.holdProgress = 0;
        
        const step = 20; 
        const duration = 800;
        
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

    // --- ACCIONES DE INTERCAMBIO Y REGALO ---

    visualTradeEffect(btn, trade, u) {
        const capsule = btn.closest('.trade-capsule');
        this.requestTrade(trade).then(success => { 
            if(success && capsule) {
                capsule.classList.add('ghost-out');
            }
        });
    },

    async requestTrade(tradeInfo) {
        if(this.currentUser.polvos_iris < tradeInfo.cost) {
            this.showToast("Insuficientes Polvos", "error");
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
                this.currentUser.polvos_iris -= tradeInfo.cost;
                this.currentUser.fichas_cambio -= 1;
                setTimeout(() => this.initSocial(), 1200); 
                return true;
            } else {
                this.showToast(d.msg, "error");
                return false;
            }
        } catch(e) { 
            this.showToast("Error de conexión", "error"); 
            return false;
        }
    },

    visualGiftEffect(btn, item) {
        const ticket = btn.closest('.gift-ticket');
        if(ticket) {
            ticket.classList.add('packing-anim');
            setTimeout(() => {
                this.requestShare(item);
            }, 800);
        }
    },

    requestShare(item) {
        fetch('/api/social/execute_gift', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                id_origen: this.currentUser.id_cuenta, 
                id_destino: item.targetUser.id, 
                id_carta: item.card.id_carta, 
                expansion: item.card.expansion 
            })
        }).then(res => {
            this.showToast("Regalo enviado", "success");
            this.initSocial();
        });
    },

    // --- NOTIFICACIONES Y FEED ---

    async checkNotifications() {
        if(!this.currentUser) return;
        const r = await fetch('/api/social/notifications?id_cuenta='+this.currentUser.id_cuenta);
        if(r.ok) {
            this.notifications = await r.json();
            this.unreadNotif = this.notifications.filter(n => !n.leida).length;
        }
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
    }
};