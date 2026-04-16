# POC - Dynamic Forms & Sub-Apps Platform

## What This Is
A proof-of-concept for a dynamic form building and submission platform. Admins create reusable form templates and assign them to sub-apps. Regular users browse sub-apps, create requests by filling forms, and view their submissions.

## Tech Stack
- **Frontend**: React 18+ (Vite), React Router, TailwindCSS, TanStack Query
- **Backend**: Node.js + Express
- **Database**: SQLite via node:sqlite (Node built-in DatabaseSync)
- **Form Engine**: Form.io Community Edition (formio.js / @formio/react)
  - Drag-and-drop builder (Form.io FormBuilder)
  - Simple config-based builder (custom UI outputting same Form.io JSON schema)
  - Single renderer for both (Form.io Form component)

## Architecture Decisions
- **Form versioning**: Every form edit creates a new version. Submissions pin to the version used at creation time. Old submissions always render correctly with their original schema.
- **JSON columns**: Form schemas and submission data stored as JSON in SQLite. Relational structure for entities and relationships, JSON for dynamic content.
- **No real auth for POC**: Simple role switcher (admin/user) with a text-based user ID.
- **Workflow**: Status field on submissions (draft/submitted/pending/approved/rejected). Actual workflow will be handled by SAP integration later -- not in scope for POC.

## Project Structure
- `client/` - React frontend (Vite)
- `server/` - Express backend
- `server/db/` - SQLite schema and connection helpers

## Key Patterns
- Both form builders output identical Form.io JSON schema
- Sub-apps reference form templates (not specific versions)
- Submissions reference exact form versions (immutable after submit)
- Forms are reusable templates -- one form can be assigned to multiple sub-apps
