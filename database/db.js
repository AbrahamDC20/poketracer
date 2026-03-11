const { createClient } = require("@libsql/client");
require("dotenv").config();

const url = process.env.TURSO_DATABASE_URL || "file:./local.db";

// Conexión a la base de datos local
const db = createClient({
  url: url,
  // Ya no pedimos authToken porque es un archivo local
});

module.exports = db;