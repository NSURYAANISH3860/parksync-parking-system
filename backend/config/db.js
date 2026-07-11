import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Helper functions to use async/await
export const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Initialize schema
export const initDB = async () => {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS tickets (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id      VARCHAR(20) UNIQUE NOT NULL,
      vehicle_number VARCHAR(20) NOT NULL,
      vehicle_type   VARCHAR(10) CHECK(vehicle_type IN ('bike', 'car', 'truck')) NOT NULL,
      entry_time     DATETIME NOT NULL,
      exit_time      DATETIME DEFAULT NULL,
      amount         DECIMAL(6,2) DEFAULT NULL,
      status         VARCHAR(10) CHECK(status IN ('parked', 'exited')) NOT NULL DEFAULT 'parked'
    );
  `;
  try {
    await query.run(schemaSql);
    console.log('Database tables initialized.');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
};

export default db;
