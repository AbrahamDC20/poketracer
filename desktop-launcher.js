const { app, BrowserWindow } = require('electron');
const path = require('path');

// Arranca el servidor Express automáticamente
require('./server.js'); 

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        // Corregida la ruta al icono desde la raíz
        icon: path.join(__dirname, 'public/assets/images/card-back.webp'), 
        webPreferences: {
            nodeIntegration: false, // Por seguridad, mejor false si no usas funciones de Node en el frontend
            contextIsolation: true
        }
    });

    win.setMenuBarVisibility(false);

    // Damos 1.5 segundos para que Express levante la base de datos
    setTimeout(() => {
        win.loadURL('http://localhost:3000');
    }, 1500);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});