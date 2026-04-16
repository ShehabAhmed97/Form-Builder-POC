import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedRegistry } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function getDb(dbPath) {
  if (db) return db;

  const resolvedPath = dbPath || join(__dirname, '..', 'poc.db');
  db = new DatabaseSync(resolvedPath);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  seedRegistry(db);

  return db;
}

// For tests: reset the singleton so each test suite gets a fresh DB
export function resetDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
