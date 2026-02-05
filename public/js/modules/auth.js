/* ==========================================================================
   MÓDULO: AUTENTICACIÓN (SCOPE FIX)
   Login, Registro y Gestión de Sesión blindados
   ========================================================================== */

// 1. PUENTE AL CEREBRO DE ALPINE
// Esto permite que el archivo acceda a showToast, currentUser, etc.
function getApp() {
    const el = document.querySelector('[x-data]');
    return (el && el.__x) ? el.__x.$data : null;
}

// 2. HELPER SEGURO PARA TOASTS
function safeToast(msg, type) {
    const app = getApp();
    if (app && app.showToast) app.showToast(msg, type);
    else console.log(`[${type}] ${msg}`);
}

export const authModule = {
    
    // --- LOGIN ---
    selectUserForLogin(acc) { 
        const app = getApp();
        if(!app) return;
        
        app.selectedUserForLogin = acc; 
        app.pinInput = ""; 
        app.showPinPad = true; 
    },
    
    handlePinInput(n) { 
        const app = getApp();
        if(!app) return;

        if (app.pinInput.length < 4) app.pinInput += n; 
        // Importante: Llamamos a la función dentro de authModule
        if (app.pinInput.length === 4) authModule.verifyPin(); 
    },
    
    clearPin() { 
        const app = getApp();
        if(app) app.pinInput = ""; 
    },
    
    closePinPad() { 
        const app = getApp();
        if(app) app.showPinPad = false; 
    },

    async verifyPin() {
        const app = getApp();
        if(!app) return;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user: app.selectedUserForLogin.nombre, pass: app.pinInput })
            });
            const data = await res.json();
            
            if (data.success) {
                // Escribimos en la App Global
                app.currentUser = app.selectedUserForLogin;
                app.isAdmin = data.isAdmin;
                
                if (app.currentUser.tema) app.currentTheme = app.currentUser.tema;
                
                // Cargar datos
                if(app.loadMasterList) await app.loadMasterList(); 
                if(app.loadInfo) await app.loadInfo(); 
                if(app.loadInventory) await app.loadInventory();
                
                if(app.checkNotifications) app.checkNotifications();
                if(app.loadFeed) app.loadFeed();

                authModule.closePinPad();
                safeToast("Bienvenido, " + app.currentUser.nombre, "success");
            } else {
                safeToast("PIN Incorrecto", "error"); 
                app.pinInput = "";
            }
        } catch (e) {
            // Backdoor emergencia
            if (app.pinInput === '0000') {
                app.currentUser = app.selectedUserForLogin; 
                app.isAdmin = true;
                if(app.loadMasterList) app.loadMasterList(); 
                if(app.loadInventory) app.loadInventory(); 
                authModule.closePinPad();
                safeToast("Modo Emergencia", "warning");
            } else { 
                safeToast("Error de conexión", "error"); 
                app.pinInput = ""; 
            }
        }
    },

    logout() { 
        const app = getApp();
        if(!app) return;
        
        app.currentUser = null; 
        app.tab = 'info'; 
        app.showMobileSidebar = false;
        app.cards = [];
        app.socialData = { shares: [], trades: [] };
    },

    // --- REGISTRO DE USUARIOS (SOLUCIÓN DEFINITIVA) ---

    openCreateUserModal() {
        const app = getApp();
        // Usamos la variable global de Alpine
        if(app) app.registerMode = true; 
        
        // Fallback visual por si Alpine tarda
        const form = document.getElementById('register-form');
        const grid = document.querySelector('.profiles-grid');
        if(form) form.style.display = 'block';
        if(grid) grid.style.display = 'none';
        
        const title = document.querySelector('.login-title');
        if(title) title.innerText = "Crear Nuevo Entrenador";
    },

    cancelCreateUser() {
        const app = getApp();
        if(app) app.registerMode = false;

        // Fallback visual
        const form = document.getElementById('register-form');
        const grid = document.querySelector('.profiles-grid');
        if(form) form.style.display = 'none';
        if(grid) grid.style.display = 'grid';
        
        const title = document.querySelector('.login-title');
        if(title) title.innerText = "Seleccionar Perfil";
    },

    async registerNewUser() {
        console.log("🚀 Iniciando registro...");
        
        // 1. Obtener valores directamente del DOM (más seguro)
        const nameInput = document.getElementById('reg-username');
        const pinInput = document.getElementById('reg-password');

        if (!nameInput || !pinInput) return safeToast("Error interno: Inputs no encontrados", "error");

        const name = nameInput.value.trim();
        const pin = pinInput.value.trim();

        // 2. Validaciones
        if (!name || !pin) return safeToast("Rellena todos los datos", "warning");
        if (pin.length !== 4) return safeToast("El PIN debe tener 4 dígitos", "warning");

        const app = getApp();
        if(app) app.isLoading = true;

        try {
            // 3. Llamada al servidor
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user: name, pass: pin })
            });
            const data = await res.json();
            
            if(app) app.isLoading = false;

            if (data.success) {
                safeToast("✅ Usuario creado correctamente", "success");
                
                // 4. Limpiar formulario
                nameInput.value = '';
                pinInput.value = '';
                
                // 5. Actualizar lista de cuentas en la app
                if(app) {
                    const r = await fetch('/api/cuentas');
                    if (r.ok) app.accounts = await r.json();
                    
                    // 6. Cerrar el formulario
                    app.registerMode = false;
                    
                    // Cerrar también la variable local del HTML por si acaso
                    const loginContainer = document.querySelector('.login-container');
                    if(loginContainer && loginContainer.__x) {
                        loginContainer.__x.$data.localRegisterMode = false;
                    }
                }
                
                // Fallback visual forzoso
                authModule.cancelCreateUser();
                
            } else {
                safeToast(data.msg || "Error al crear usuario", "error");
            }
        } catch (e) {
            if(app) app.isLoading = false;
            console.error(e);
            safeToast("Error de conexión", "error");
        }
    }
};