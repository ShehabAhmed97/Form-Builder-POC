# Server ESM + node:sqlite Migration

## Goal

Convert the server from CommonJS to ESM and replace the `better-sqlite3` native addon with Node's built-in `node:sqlite` module (`DatabaseSync`).

## Why

- Node 24 fully supports ESM — no reason to stay on CommonJS
- `node:sqlite` removes the native C++ compilation dependency (`better-sqlite3` requires node-gyp/prebuild)
- Aligns server module format with the client (already ESM)

## Approach

Direct replacement — no wrappers or adapters. The codebase is small (6 files) and the APIs are similar enough that inline changes are sufficient.

## Files Changed

### `server/package.json`
- Add `"type": "module"`
- Remove `better-sqlite3` from dependencies

### `server/db/database.js`
- `import { DatabaseSync } from 'node:sqlite'`
- `new Database(path)` -> `new DatabaseSync(path)`
- `db.pragma('journal_mode = WAL')` -> `db.exec('PRAGMA journal_mode = WAL')`
- `db.pragma('foreign_keys = ON')` -> `db.exec('PRAGMA foreign_keys = ON')`
- Convert `require`/`module.exports` to `import`/`export`

### `server/routes/forms.js`
- Convert to ESM
- Replace 2 `db.transaction()` calls with manual `db.exec('BEGIN')` / `db.exec('COMMIT')` wrapped in try/catch with `db.exec('ROLLBACK')`

### `server/routes/subApps.js`
- Convert to ESM (no SQLite API changes needed — only uses `.prepare().all()/.get()/.run()`)

### `server/routes/submissions.js`
- Convert to ESM (no SQLite API changes needed)

### `server/app.js`
- Convert to ESM

### `server/index.js`
- Convert to ESM

### `server/tests/*.test.js`
- Already use ESM import syntax — verify import paths resolve correctly

## API Mapping

| better-sqlite3 | node:sqlite |
|---|---|
| `new Database(path)` | `new DatabaseSync(path)` |
| `db.pragma('key = val')` | `db.exec('PRAGMA key = val')` |
| `db.transaction(fn)` returns wrapper | Manual BEGIN/COMMIT/ROLLBACK |
| `stmt.run()` -> `{ lastInsertRowid }` | `stmt.run()` -> `{ lastInsertRowid, changes }` |
| `stmt.all()`, `stmt.get()` | Same |
| `db.exec(sql)` | Same |
| `db.prepare(sql)` | Same |

## Not Changed

- `server/db/schema.sql` — pure SQL, no changes
- `client/` — already ESM, no SQLite usage
- No new files created

## Verification

- Run existing test suite (`npm test` in server/) — all tests must pass
- Verify `better-sqlite3` is fully removed from package.json and node_modules
