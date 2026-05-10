# Clone And Run Guide

Use this guide when setting up the HL7 AI Workbench from a fresh clone. It covers the backend API, React frontend, local database, optional MySQL data, checks, and cleanup.

## 1. Prerequisites

Install these first:

- Git
- Python 3.11 or newer
- Node.js 20 or newer
- npm
- Optional: MySQL Server or MySQL Workbench if you want to test database imports

Check versions:

```bash
git --version
python3 --version
node --version
npm --version
```

## 2. Clone The Project

```bash
git clone https://github.com/akshay00711/HL7-Generators.git
cd HL7-Generators
```

## 3. Install Backend Dependencies

From the project root:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
```

Windows PowerShell equivalent:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

## 4. Install Frontend Dependencies

Open a terminal at the project root:

```bash
cd frontend
npm install
```

## 5. Start The Backend

Open terminal 1 from the project root:

```bash
. .venv/bin/activate
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend health check:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok","service":"HL7 AI Workbench API"}
```

The backend automatically creates this local SQLite database:

```text
backend/hl7_workbench.db
```

It stores generated HL7 history, imported references, and saved MySQL presets.

## 6. Start The Frontend

Open terminal 2 from the project root:

```bash
cd frontend
npm run dev
```

Open the app:

```text
http://127.0.0.1:5173/
```

The frontend uses this backend by default:

```text
http://127.0.0.1:8000
```

If you run the backend on another URL, create `frontend/.env.local`:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then restart `npm run dev`.

## 7. Verify The App Manually

In the browser:

1. Open `Generate`.
2. Click `Generate`.
3. Confirm an HL7 message appears in the validator.
4. Enter a custom save name and click `Save`.
5. Open `Validate`.
6. Load the saved generated HL7 from `Saved Generated HL7`.
7. Open `Sources`.
8. Confirm `Stored References`, `Website Import`, and `MySQL Workbench Database` are visible.

## 8. Optional MySQL Setup

Use this only if you want to test database imports.

1. Start MySQL locally.
2. Open MySQL Workbench.
3. Run the sample SQL:

```text
samples/mysql/hl7_reference_lab_seed.sql
```

In the app, open `Sources` and enter:

```text
Host: 127.0.0.1
Port: 3306
User: your_mysql_user
Password: your_mysql_password
Database: the_database_from_the_sample_sql
SELECT Query: SELECT name, content FROM hl7_references LIMIT 5
Name Column: name
Content Column: content
```

Then:

1. Click `Test`.
2. Click `Run Query`.
3. Click `Use in Validator` for a row that contains HL7.
4. Click `Import` to save a row as a stored reference.
5. Click `Save DB` if you want to reuse the database settings.

Passwords are saved only when `Save password` is checked.

## 9. Run Automated Checks

Backend tests:

```bash
cd backend
../.venv/bin/python -m pytest
```

Frontend build:

```bash
cd frontend
npm run build
```

Playwright E2E tests:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

Useful E2E variants:

```bash
npm run test:e2e:headed
npm run test:e2e:ui
```

## 10. Common Problems

Backend port already in use:

```bash
lsof -i :8000
kill <PID>
```

Frontend port already in use:

```bash
lsof -i :5173
kill <PID>
```

Blank UI:

1. Open browser developer tools.
2. Check the Console tab.
3. Run `npm run build` inside `frontend`.
4. Restart `npm run dev`.

Backend connection errors:

1. Confirm the backend is running on `http://127.0.0.1:8000`.
2. Open `http://127.0.0.1:8000/health`.
3. Confirm `VITE_API_BASE_URL` is correct if you changed ports.

MySQL errors:

1. Confirm MySQL server is running.
2. Confirm host, port, user, password, and database name.
3. Use only single-statement `SELECT` queries.
4. If you see `Unknown database`, choose an existing database or create/import the sample database first.

## 11. Cleanup And Reset

Stop backend and frontend first, then run from the project root:

```bash
./scripts/clean_all.sh
```

This removes local generated data, caches, and frontend build output.

To also remove installed dependencies:

```bash
./scripts/clean_all.sh --with-deps
```

After cleanup with dependencies removed, repeat the install steps in this guide.

## 12. Daily Development Commands

Backend:

```bash
. .venv/bin/activate
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

Backend tests:

```bash
cd backend
../.venv/bin/python -m pytest
```

Frontend build:

```bash
cd frontend
npm run build
```

E2E tests:

```bash
cd frontend
npm run test:e2e
```
