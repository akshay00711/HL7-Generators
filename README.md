# HL7 AI Workbench

A full-stack React and Python application for generating, parsing, and validating HL7 v2 messages.

## What It Does

- Generates HL7 messages from configurable inputs such as HL7 version, report type, patient details, provider details, and observations.
- Parses HL7 messages into a human-readable structure with segment and field labels.
- Validates generated or externally supplied HL7 messages for structural and standards-oriented compliance.
- Imports external website reference content and stores it in a local SQLite database.
- Connects to a MySQL database, previews read-only query results, and imports rows as references.
- Saves reusable MySQL database presets without storing passwords.
- Saves generated-message history to the database only when the user enables the save option.

For a screenshot-based walkthrough, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md).
For fresh clone setup and complete run commands, see [docs/CLONE_AND_RUN.md](docs/CLONE_AND_RUN.md).
For a visual workflow diagram, see [docs/WORKFLOW_DIAGRAM.md](docs/WORKFLOW_DIAGRAM.md).
For setup, cleanup, reset, and troubleshooting commands, see [docs/OPERATIONS.md](docs/OPERATIONS.md).
For demo-ready sample data and UI block descriptions, see [docs/SAMPLE_DATA_AND_BLOCK_GUIDE.md](docs/SAMPLE_DATA_AND_BLOCK_GUIDE.md).

## Project Structure

```text
backend/
  app/
    hl7.py        # HL7 generation, parsing, validation logic
    main.py       # FastAPI routes
    models.py     # API request/response schemas
    database.py   # SQLite reference, message-history, and MySQL preset storage
    external_sources.py # Website reference importer
    external_databases.py # MySQL connector and query guard
  tests/
    test_hl7.py
frontend/
  e2e/
    hl7-workbench.spec.js # Playwright end-to-end tests
  public/
    sample-hl7-reference.html # Local website-import test page
  src/
    App.jsx
    main.jsx
    styles.css
samples/
  hl7/
    manual_messages.md
  mysql/
    hl7_reference_lab_seed.sql
```

## Backend Setup

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --reload --port 8000
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open the React app at the URL printed by Vite, usually `http://localhost:5173`.

## E2E Testing

Playwright tests live in `frontend/e2e` and start the FastAPI and Vite servers automatically.

Install the browser once:

```bash
cd frontend
npx playwright install chromium
```

Run the E2E suite:

```bash
cd frontend
npm run test:e2e
```

Useful variants:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
```

## One Command Cleanup

Stop the app, then run:

```bash
./scripts/clean_all.sh
```

This removes the local SQLite app database, frontend build output, and local cache files. Use `./scripts/clean_all.sh --with-deps` when you also want to remove `.venv` and `frontend/node_modules`.

## API Endpoints

- `GET /health` - API health check.
- `GET /api/options` - supported HL7 versions and report types.
- `POST /api/generate` - generate an HL7 message and return parsed/validation results.
- `POST /api/parse` - parse any HL7 message into readable segments and fields.
- `POST /api/validate` - validate any HL7 message.
- `GET /api/references` - list database and imported website references.
- `POST /api/references` - save a manual reference to SQLite.
- `DELETE /api/references/{id}` - remove an imported website/MySQL reference.
- `POST /api/references/import-website` - fetch website text and save it as a reference.
- `POST /api/external-databases/mysql/test` - test a MySQL connection.
- `POST /api/external-databases/mysql/query` - preview a read-only MySQL `SELECT` query.
- `POST /api/external-databases/mysql/import-reference` - import the first row from a MySQL `SELECT` query as a reference.
- `GET /api/external-databases/mysql/saved` - list saved MySQL database presets.
- `POST /api/external-databases/mysql/saved` - save a MySQL database preset, optionally with the password.
- `GET /api/history` - list recent generated HL7 messages saved in SQLite.
- `POST /api/history` - save the currently generated HL7 message to SQLite history.
- `DELETE /api/history/{id}` - remove a saved generated HL7 message.

## External References And Database

The backend creates `backend/hl7_workbench.db` automatically on startup. The database stores:

- Reference sources from seeded local profiles, manual records, and imported websites.
- Generated-message history with message control ID, report type, HL7 version, selected reference, and saved HL7 text.
- MySQL database presets with host, port, user, database, query, and column settings. Passwords are stored only when `Save password` is checked.

Generated messages are not saved by default. In the UI, click `Generate`, then click `Save` when you want that generated message to appear in `Saved Generated HL7`.

When a database reference is selected in the UI, generation attaches a short `NTE` reference note to the HL7 message so downstream reviewers can see which external source guided the message.

## MySQL Workbench Connection

The UI can connect to a running MySQL server, including databases managed through MySQL Workbench. Enter host, port, user, password, and database name in the MySQL panel. Add a preset name and click `Save DB` to remember the database details, query, and column settings for later. Check `Save password` before saving if you also want the local app database to remember the MySQL password. Loading a saved database fills the password only when it was saved.

The connector only allows single-statement `SELECT` queries. A simple reference table can look like:

```sql
CREATE TABLE hl7_references (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL
);
```

Use a query such as:

```sql
SELECT name, content FROM hl7_references LIMIT 1
```

Then set `Name Column` to `name` and `Content Column` to `content`, preview the query, and import it. Imported rows are saved into the app's local SQLite reference list with source type `mysql`; your MySQL password is saved only if you choose `Save password` while saving a database preset.

For a fuller dataset covering lab, radiology, ADT, duplicate checks, custom reference names, and invalid validation examples, run:

```text
samples/mysql/hl7_reference_lab_seed.sql
```

The local website import sample is available while Vite is running:

```text
http://127.0.0.1:5173/sample-hl7-reference.html
```

## Validation Scope

The validator checks practical HL7 v2 rules including:

- MSH segment placement and delimiter configuration.
- Required MSH fields such as message type, control ID, processing ID, and version.
- Required segments by message type, including ORU and ADT workflows.
- PID demographic fields and common date/code formats.
- OBR/OBX ordering and required observation fields.
- Segment naming, blank segment detection, and unsupported version warnings.

This is designed as a solid project baseline. Production-grade conformance can be extended by loading detailed HL7 profiles, facility-specific constraints, and vocabulary bindings.
