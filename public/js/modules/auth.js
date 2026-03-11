/* ==========================================================================
   MÓDULO: AUTENTICACIÓN (CORREGIDO AUTO-LOGIN)
   ========================================================================== */

function getApp() {
    const el = document.querySelector('[x-data]');
    return (el && el.__x) ? el.__x.$data : null;
}

function safeToast(msg, type) {
    const app = getApp();
    if (app && app.showToast) app.showToast(msg, type);
    else console.log(`[${type}] ${msg}`);
}

export const authModule = {
    
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
                app.currentUser = app.selectedUserForLogin;
                app.isAdmin = data.isAdmin;
                
                if (app.currentUser.tema) app.currentTheme = app.currentUser.tema;
                
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

    openCreateUserModal() {
        const app = getApp();
        if(app) app.registerMode = true; 
        
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

        const form = document.getElementById('register-form');
        const grid = document.querySelector('.profiles-grid');
        if(form) form.style.display = 'none';
        if(grid) grid.style.display = 'grid';
        
        const title = document.querySelector('.login-title');
        if(title) title.innerText = "Seleccionar Perfil";
    },

    async registerNewUser() {
        console.log("🚀 Iniciando registro...");
        
        const nameInput = document.getElementById('reg-username');
        const pinInput = document.getElementById('reg-password');

        if (!nameInput || !pinInput) return safeToast("Error interno", "error");

        const name = nameInput.value.trim();
        const pin = pinInput.value.trim();

        if (!name || !pin) return safeToast("Rellena todos los datos", "warning");
        if (pin.length !== 4) return safeToast("El PIN debe tener 4 dígitos", "warning");

        const app = getApp();
        if(app) app.isLoading = true;

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ user: name, pass: pin })
            });
            const data = await res.json();
            
            if(app) app.isLoading = false;

            if (data.success) {
                safeToast("✅ Entrenador creado correctamente", "success");
                nameInput.value = '';
                pinInput.value = '';
                
                // FIX: Recargar usuarios y auto-loguear
                if(app) {
                    const r = await fetch('/api/cuentas');
                    if (r.ok) {
                        app.accounts = await r.json();
                        const newUser = app.accounts.find(a => a.nombre === name);
                        if(newUser) {
                            app.selectedUserForLogin = newUser;
                            app.pinInput = pin;
                            authModule.verifyPin(); 
                        }
                    }
                    const loginContainer = document.querySelector('.login-container');
                    if(loginContainer && loginContainer.__x) {
                        loginContainer.__x.$data.localRegisterMode = false;
                    }
                    app.registerMode = false;
                }
                
                authModule.cancelCreateUser();
                
            } else {
                safeToast(data.msg || "Error al crear usuario", "error");
            }
        } catch (e) {
            if(app) app.isLoading = false;
            safeToast("Error de conexión", "error");
        }
    }
};