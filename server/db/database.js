import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createDb(dbPath) {
  const resolvedPath = dbPath || join(__dirname, '..', 'poc.db');
  const db = new DatabaseSync(resolvedPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}

let defaultDb;
export function getDb() {
  if (!defaultDb) {
    defaultDb = createDb();
  }
  return defaultDb;
}
