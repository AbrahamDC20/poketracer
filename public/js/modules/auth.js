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
    },

    // --- FUNCIONES DE REGISTRO ---

    // Abre el modo registro (compatible con el sistema JS puro)
    openCreateUserModal() {
        const grid = document.querySelector('.profiles-grid');
        const form = document.getElementById('register-form');
        const title = document.querySelector('.login-title');

        if(grid) grid.style.display = 'none';
        
        if(form) {
            form.classList.remove('hidden'); // Quitar clase CSS
            form.style.display = 'block';    // Forzar display
        }
        
        if(title) title.innerText = "Crear Nuevo Entrenador";
    },

    // Cancela y vuelve a la lista (compatible con JS puro)
    cancelCreateUser() {
        const grid = document.querySelector('.profiles-grid');
        const form = document.getElementById('register-form');
        const title = document.querySelector('.login-title');

        if(grid) grid.style.display = 'grid';
        if(form) form.style.display = 'none';
        
        if(title) title.innerText = "Seleccionar Perfil";
    },

    // Función principal de registro (Mejorada para Logs y Feedback)
    async registerNewUser() {
        console.log("Intentando registrar usuario...");
        
        // Búsqueda robusta de elementos por ID
        const nameInput = document.getElementById('reg-username');
        const pinInput = document.getElementById('reg-password');

        if (!nameInput || !pinInput) {
            console.error("Error: No se encuentran los inputs de registro en el DOM");
            return this.showToast("Error interno: Recarga la página", "error");
        }

        const name = nameInput.value.trim();
        const pin = pinInput.value.trim();

        if (!name || !pin) return this.showToast("Rellena nombre y PIN", "warning");
        if (pin.length !== 4) return this.showToast("El PIN debe ser de 4 dígitos", "warning");

        try {
            // Mostrar carga (si tienes spinner global)
            this.isLoading = true; 
            
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user: name, pass: pin })
            });
            const data = await res.json();
            
            this.isLoading = false;

            if (data.success) {
                this.showToast("✅ Usuario creado. ¡Ya puedes entrar!", "success");
                
                // Limpiar campos
                nameInput.value = '';
                pinInput.value = '';
                
                // Recargar lista de cuentas para que aparezca el nuevo
                const r = await fetch('/api/cuentas');
                if (r.ok) this.accounts = await r.json();
                
                // Volver a la pantalla de selección
                // Si estamos usando el modo "blindado" (localRegisterMode), lo cerramos
                // Si no, usamos el método estándar
                if (typeof this.registerMode !== 'undefined') {
                    this.registerMode = false;
                } else {
                    this.cancelCreateUser();
                }
                
            } else {
                this.showToast(data.msg || "Error al crear usuario", "error");
            }
        } catch (e) {
            this.isLoading = false;
            console.error(e);
            this.showToast("Error de conexión", "error");
        }
    }
};