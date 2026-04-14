const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function createDb(dbPath) {
  const resolvedPath = dbPath || path.join(__dirname, '..', 'poc.db');
  const db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

let defaultDb;
function getDb() {
  if (!defaultDb) {
    defaultDb = createDb();
  }
  return defaultDb;
}

module.exports = { createDb, getDb };
