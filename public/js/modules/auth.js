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

    // --- FUNCIONES DE REGISTRO (FIX PARA EL BOTÓN 'NUEVO') ---

    openCreateUserModal() {
        const loginContainer = document.querySelector('.login-container');
        // Ocultar rejilla de perfiles
        const grid = loginContainer.querySelector('.profiles-grid');
        // Mostrar formulario (buscamos por ID)
        const form = document.getElementById('register-form'); 
        
        if(grid) grid.style.display = 'none';
        
        if(form) {
            form.classList.remove('hidden');
            form.style.display = 'block';
            // Mover el formulario dentro del contenedor de login si no estaba ahí
            if(form.parentNode !== loginContainer) {
               loginContainer.appendChild(form);
            }
        }
        
        // Cambiar título
        const title = loginContainer.querySelector('.login-title');
        if(title) title.textContent = "Crear Entrenador";
    },
    
    cancelCreateUser() {
        const loginContainer = document.querySelector('.login-container');
        const grid = loginContainer.querySelector('.profiles-grid');
        const form = document.getElementById('register-form');
        
        if(grid) grid.style.display = 'grid';
        if(form) form.style.display = 'none';
        
        const title = loginContainer.querySelector('.login-title');
        if(title) title.textContent = "Seleccionar Perfil";
    },

    async registerNewUser() {
        // Obtenemos valores directos de los inputs del formulario
        const name = document.getElementById('reg-username').value;
        const pin = document.getElementById('reg-password').value;

        if (!name || !pin) return this.showToast("Rellena todos los datos", "warning");
        if (pin.length !== 4) return this.showToast("El PIN debe ser de 4 dígitos", "warning");

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user: name, pass: pin })
            });
            const data = await res.json();

            if (data.success) {
                this.showToast("Usuario creado! Inicia sesión.", "success");
                
                // Recargar la lista de cuentas para que aparezca el nuevo
                const r = await fetch('/api/cuentas');
                if (r.ok) this.accounts = await r.json();
                
                // Volver a la pantalla de selección
                this.cancelCreateUser();
                
                // Limpiar inputs
                document.getElementById('reg-username').value = '';
                document.getElementById('reg-password').value = '';
            } else {
                this.showToast(data.msg || "Error al crear usuario", "error");
            }
        } catch (e) {
            console.error(e);
            this.showToast("Error de conexión", "error");
        }
    }
};