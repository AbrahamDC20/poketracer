const { createClient } = require("@libsql/client");
require("dotenv").config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("❌ ERROR CRÍTICO: No se encontraron las variables de Turso en el archivo .env");
  process.exit(1);
}

// Conexión a la nube
const db = createClient({
  url: url,
  authToken: authToken,
});

module.exports = db;