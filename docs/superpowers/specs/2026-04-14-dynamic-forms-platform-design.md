# Dynamic Forms & Sub-Apps Platform -- POC Design Spec

## Overview

A platform where admins create reusable form templates using visual or config-based builders, assign them to sub-apps, and regular users browse sub-apps to submit requests by filling those forms. This POC validates the core data model, form versioning strategy, and relational database compatibility.

## Goals

- Validate that a relational database (SQLite, later PostgreSQL/MySQL) can handle dynamic form schemas and submission data
- Test form versioning: editing a form template must not break existing submissions
- Compare two form-building experiences: drag-and-drop vs. simple config-based
- Keep it simple: local storage, no real auth, no workflow engine

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18+ (Vite), React Router, TailwindCSS, TanStack Query |
| Backend | Node.js + Express |
| Database | SQLite via better-sqlite3 |
| Form Engine | Form.io Community Edition (formio.js / @formio/react) |

**Paid alternatives for later**: SurveyJS (commercial license for white-labeling), Form.io Enterprise (hosted platform with team management, RBAC).

## Data Model

### forms
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Template name |
| description | TEXT | Template description |
| current_version | INTEGER | Latest version number |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### form_versions
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| form_id | INTEGER FK → forms | Parent template |
| version_num | INTEGER | Sequential version number |
| schema | JSON | Form.io JSON definition |
| created_at | DATETIME | |

UNIQUE constraint on (form_id, version_num).

### sub_apps
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| name | TEXT | Sub-app display name |
| description | TEXT | Sub-app description |
| form_id | INTEGER FK → forms | Assigned form template |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### submissions
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| sub_app_id | INTEGER FK → sub_apps | Which sub-app |
| form_version_id | INTEGER FK → form_versions | Exact form version used |
| user_id | TEXT | Simple string identifier |
| data | JSON | Submitted field values |
| status | TEXT | draft / submitted / pending / approved / rejected |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### Relationships

- One form template → many form versions (1:N)
- One form template → many sub-apps (1:N, forms are reusable)
- One sub-app → many submissions (1:N)
- One form version → many submissions (1:N)

## Form Versioning Strategy

1. Admin creates a form → `forms` row + `form_versions` row (version 1)
2. Admin edits the form → new `form_versions` row (version 2), `forms.current_version` bumps to 2
3. User opens a sub-app to create a request → resolve `sub_app.form_id → forms.current_version → form_versions.schema` to get the latest form definition
4. User submits → `submission.form_version_id` is pinned to the version used (e.g., version 2), immutable
5. Admin edits again → version 3 created. Old submissions still reference version 2 and render correctly

**Retrieving a submission with its form schema:**
```sql
SELECT s.data, s.status, fv.schema, fv.version_num
FROM submissions s
JOIN form_versions fv ON s.form_version_id = fv.id
WHERE s.sub_app_id = ?
```

## Form Builder

Both builders output identical Form.io JSON schema. One renderer handles both.

### Drag-and-Drop Builder
Uses the Form.io `FormBuilder` React component directly. Admin drags fields onto a canvas, configures properties in a sidebar. Full WYSIWYG experience with support for:
- Conditional visibility
- File uploads
- Nested components / sub-forms
- Calculated values
- Multi-step wizard layout

### Simple Config-Based Builder
Custom React UI where the admin:
1. Picks a field type from a list (text, number, date, select, file, etc.)
2. Configures properties (label, placeholder, required, validation rules)
3. Reorders fields via drag or up/down buttons
4. Previews the form via the Form.io renderer

Outputs the same Form.io JSON schema as the drag-and-drop builder.

## Admin Experience

### Form Template Management
- **List view**: Table of all templates -- name, description, current version, created date
- **Create**: Choose builder mode (drag-and-drop or simple), build form, preview, save
- **Edit**: Opens the existing schema in the selected builder. Saving creates a new version automatically.
- **Version history**: Read-only list of all versions with timestamps. Can preview any past version.

### Sub-App Management
- **List view**: All sub-apps -- name, description, assigned form template, submission count
- **Create/Edit**: Name, description, pick a form template from dropdown
- **View submissions**: Read-only table of submissions for this sub-app (data, status, form version used)

### Admin Routes
```
/admin/forms                    → Form template list
/admin/forms/new                → Create (pick builder mode)
/admin/forms/:id/edit           → Edit form
/admin/forms/:id/versions       → Version history
/admin/sub-apps                 → Sub-app list
/admin/sub-apps/new             → Create sub-app
/admin/sub-apps/:id/edit        → Edit sub-app
/admin/sub-apps/:id/submissions → View submissions
```

## User Experience

Three screens, minimal and focused.

### 1. Sub-Apps List
Cards showing all available sub-apps (name, description). Click to enter.

### 2. My Submissions (Sub-App Detail)
- Lists the current user's submitted requests for this sub-app
- Each row: submission date, status badge, quick preview of submitted data
- "Create New Request" button at the top

### 3. Create Request
- Renders the current version of the sub-app's assigned form template using the Form.io `Form` component
- User fills out the form, hits submit
- Redirects back to the submissions list

### User Routes
```
/sub-apps                       → Browse all sub-apps
/sub-apps/:id                   → My submissions for this sub-app
/sub-apps/:id/new               → Create request (fill form)
```

## Authentication (POC Only)

No real authentication. A simple role switcher in the app header:
- Dropdown to select role (Admin / User)
- Text field for user ID
- Persisted in localStorage

Enough to separate admin/user views and attribute submissions.

## Project Structure

```
poc-app/
├── client/                 # React (Vite)
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   ├── pages/
│   │   │   ├── admin/
│   │   │   │   ├── FormTemplates.jsx
│   │   │   │   ├── FormBuilder.jsx
│   │   │   │   ├── FormVersionHistory.jsx
│   │   │   │   ├── SubApps.jsx
│   │   │   │   ├── SubAppForm.jsx
│   │   │   │   └── SubAppSubmissions.jsx
│   │   │   └── user/
│   │   │       ├── SubAppsList.jsx
│   │   │       ├── MySubmissions.jsx
│   │   │       └── CreateRequest.jsx
│   │   ├── api/            # API client functions
│   │   ├── App.jsx         # Router setup
│   │   └── main.jsx
│   └── package.json
├── server/                 # Express
│   ├── db/
│   │   ├── schema.sql
│   │   └── database.js
│   ├── routes/
│   │   ├── forms.js
│   │   ├── subApps.js
│   │   └── submissions.js
│   ├── index.js
│   └── package.json
└── package.json            # Root scripts
```

## API Endpoints

### Forms
- `GET    /api/forms`              → List all form templates
- `POST   /api/forms`              → Create form template + version 1
- `GET    /api/forms/:id`          → Get form template with current schema
- `PUT    /api/forms/:id`          → Update form (creates new version)
- `GET    /api/forms/:id/versions` → List all versions of a form

### Sub-Apps
- `GET    /api/sub-apps`           → List all sub-apps
- `POST   /api/sub-apps`           → Create sub-app
- `GET    /api/sub-apps/:id`       → Get sub-app with form info
- `PUT    /api/sub-apps/:id`       → Update sub-app

### Submissions
- `GET    /api/sub-apps/:id/submissions`  → List submissions for a sub-app
- `POST   /api/sub-apps/:id/submissions`  → Create submission
- `GET    /api/submissions/:id`           → Get single submission with form schema

## Out of Scope for POC

- Real authentication / authorization
- SAP workflow integration
- File upload storage beyond base64 (Form.io encodes files as base64 by default -- stored inline in the JSON data column, good enough for POC. Production would use object storage like S3.)
- Email notifications
- Search / filtering on submissions
- Export functionality
- Multi-language support
