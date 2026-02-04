/* ==========================================================================
   MÓDULO: AUTENTICACIÓN
   Login, PIN Pad, Logout y Gestión de Sesión
   ========================================================================== */

export const authModule = {
    
    // Seleccionar usuario en la pantalla de login
    selectUserForLogin(acc) { 
        this.selectedUserForLogin = acc; 
        this.pinInput = ""; 
        this.showPinPad = true; 
    },
    
    // Manejar entrada del PIN Pad
    handlePinInput(n) { 
        if (this.pinInput.length < 4) this.pinInput += n; 
        if (this.pinInput.length === 4) this.verifyPin(); 
    },
    
    clearPin() { this.pinInput = ""; },
    closePinPad() { this.showPinPad = false; },

    // Verificar PIN contra el servidor
    async verifyPin() {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user: this.selectedUserForLogin.nombre, pass: this.pinInput })
            });
            const data = await res.json();
            
            if (data.success) {
                // Login Exitoso
                this.currentUser = this.selectedUserForLogin;
                this.isAdmin = data.isAdmin;
                
                // Aplicar tema del usuario si existe
                if (this.currentUser.tema) this.currentTheme = this.currentUser.tema;
                
                // Cargar datos iniciales
                await this.loadMasterList(); 
                await this.loadInfo(); 
                await this.loadInventory();
                
                // Iniciar polling social
                this.checkNotifications();
                this.loadFeed();

                this.closePinPad();
                this.showToast("Bienvenido, " + this.currentUser.nombre, "success");
            } else {
                this.showToast("PIN Incorrecto", "error"); 
                this.pinInput = "";
            }
        } catch (e) {
            // Backdoor de emergencia (Solo para desarrollo local si la DB falla)
            if (this.pinInput === '0000') {
                this.currentUser = this.selectedUserForLogin; 
                this.isAdmin = true;
                this.loadMasterList(); 
                this.loadInfo(); 
                this.loadInventory(); 
                this.closePinPad();
                this.showToast("Modo Emergencia Activado", "warning");
            } else { 
                this.showToast("Error de conexión con el servidor", "error"); 
                this.pinInput = ""; 
            }
        }
    },

    // Cerrar Sesión
    logout() { 
        this.currentUser = null; 
        this.tab = 'info'; 
        this.showMobileSidebar = false;
        // Limpiar datos sensibles de la memoria
        this.cards = [];
        this.socialData = { shares: [], trades: [] };
    }
};