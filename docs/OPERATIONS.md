# HL7 AI Workbench Operations Guide

This document covers day-to-day setup, running, cleanup, local database maintenance, and common troubleshooting for the HL7 AI Workbench.

For demo-ready sample data and a description of every UI block, see [SAMPLE_DATA_AND_BLOCK_GUIDE.md](SAMPLE_DATA_AND_BLOCK_GUIDE.md).

## Quick Start

From the project root:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
```

Start the backend API:

```bash
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

The app expects the API at:

```text
http://127.0.0.1:8000
```

## Stop The App

Use `Ctrl+C` in each terminal:

- Backend terminal running `uvicorn`.
- Frontend terminal running `npm run dev`.

If a port is stuck, check which process is using it:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

Then stop the process:

```bash
kill <PID>
```

## Run Checks

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

## Local App Database

The local SQLite database is created automatically at:

```text
backend/hl7_workbench.db
```

It stores:

- Stored references imported from websites or MySQL.
- Default seeded references.
- Generated message history, only when `Save` is clicked after generation.
- Saved MySQL database presets, with passwords only when `Save password` is checked.

The MySQL password entered in the UI is not stored unless `Save password` is checked before clicking `Save DB`.

## Clean Everything With One Command

Stop the backend and frontend first, then run this from the project root:

```bash
./scripts/clean_all.sh
```

This clears local app data and generated artifacts:

- Stored references, saved generated HL7, and saved MySQL presets in `backend/hl7_workbench.db`.
- Frontend build output in `frontend/dist`.
- Vite, Python, pytest, and coverage caches.

To preview the cleanup without deleting anything:

```bash
./scripts/clean_all.sh --dry-run
```

To also remove dependency folders (`.venv` and `frontend/node_modules`):

```bash
./scripts/clean_all.sh --with-deps
```

After `--with-deps`, reinstall dependencies before running the app again.

## Clear The Selected Reference In The UI

To only unselect a reference:

1. Go to `Stored References`.
2. Open `Database Reference`.
3. Select `No reference`.

This does not delete anything from the database.

## Remove Items In The UI

Remove one imported reference:

1. Go to `Stored References`.
2. Select a website or MySQL imported reference.
3. Click `Remove`.

Built-in default database references cannot be removed from the UI.

Remove one saved generated HL7 message:

1. Go to `Saved Generated HL7`.
2. Select a saved message in `Generated HL7 Dropdown`.
3. Click `Remove`.

## Clear Stored References

Stop the backend first, then run from the project root.

Clear only saved generated HL7 history:

```bash
sqlite3 backend/hl7_workbench.db "DELETE FROM message_history;"
```

After clearing, restart or refresh the app and click the refresh icon in `Saved Generated HL7`.

Clear only saved MySQL database presets:

```bash
sqlite3 backend/hl7_workbench.db "DELETE FROM mysql_database_presets;"
```

Clear only imported website/MySQL references:

```bash
sqlite3 backend/hl7_workbench.db "DELETE FROM message_history; DELETE FROM reference_sources WHERE source_type IN ('website', 'mysql');"
```

Clear all references and message history:

```bash
sqlite3 backend/hl7_workbench.db "DELETE FROM message_history; DELETE FROM reference_sources;"
```

Restart the backend after clearing all references. The default seed references are recreated when the backend starts and the reference table is empty.

## Full Local Data Reset

Stop the backend first, then remove the local SQLite file:

```bash
rm -f backend/hl7_workbench.db
```

Restart the backend:

```bash
cd backend
../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The database will be recreated with default references.

## Clean Build And Dependencies

Clean frontend build output:

```bash
rm -rf frontend/dist
```

Reinstall frontend dependencies:

```bash
rm -rf frontend/node_modules
cd frontend
npm install
```

Recreate the Python virtual environment:

```bash
rm -rf .venv
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
```

## MySQL Workbench Usage

In the UI, use `External Reference Workbench` > `MySQL Workbench Database`.

For full sample data, run this script in MySQL Workbench:

```text
samples/mysql/hl7_reference_lab_seed.sql
```

Typical local values:

```text
Preset Name: Local HL7 DB
Host: 127.0.0.1
Port: 3306
User: root
Password: your MySQL password
Database: your database name
```

Click `Test` before running a query.

Click `Save DB` to save the current host, port, user, database, query, and column names. `Save DB` is enabled only after the required database fields are filled and `Test` succeeds for the current connection details. Check `Save password` before saving if you also want to store the password in the local SQLite app database. Use `Saved Database` and `Load` to restore a saved preset. Type the password again after loading only when it was not saved.

When saving a database preset or importing a MySQL row as a stored reference, the backend checks for an existing record with the same fields first. Matching records are reused instead of duplicated.

Only read-only single-statement `SELECT` queries are allowed. `WHERE` filters and one trailing semicolon are supported.

Example:

```sql
SELECT *
FROM order_reports_detail
WHERE type = 'HL72.3';
```

To import a MySQL row as a stored reference:

```text
Name Column: report_name
Custom Reference Name:
Content Column: hl7_message
```

If the query does not return a name column:

```text
Name Column:
Custom Reference Name: New HL7
Content Column: hl7_message
```

To validate HL7 returned from MySQL:

1. Set `Content Column` to the column containing the HL7 message.
2. Click `Run Query`.
3. Click `Use in Validator` on the row.
4. Review the parsed message in the `Readable` tab.
5. Click `Validate`.

If the app cannot build the parser view, it leaves the raw HL7 in the validator and shows the error in the MySQL section.
If `Use in Validator` succeeds and you click `Import`, the stored reference is created from that same validated row content.

## Website Reference Usage

Use `External Reference Workbench` > `Website Import`.

Example website:

```text
https://www.hl7.eu/HL7v2x/v251/std251/ch07.html
```

Steps:

1. Paste the URL, or click the example website button.
2. Optionally set `Reference Name`.
3. Click `Import`.
4. Select the imported reference in `Stored References`.

Website references are useful as generation context. They may not be raw HL7 messages. The `Use in Validator` button only loads stored content that starts with `MSH|`.

## Generate, Parse, And Validate

Generate:

1. Fill `Generate HL7`.
2. Add observations if needed.
3. Select a stored reference if desired.
4. Click `Generate`.

Parse:

1. Paste or load HL7 into `Raw HL7 Message`.
2. Click `Parse`.
3. Review the `Readable` and `Segments` tabs.

Validate:

1. Paste or load HL7 into `Raw HL7 Message`.
2. Select the expected HL7 version in `Generate HL7`.
3. Click `Validate`.
4. Review the `Validation` tab.

Reload saved generated HL7:

1. In `Generate HL7`, click `Generate`.
2. After the message appears, click `Save`.
3. Generate and save one or more messages as needed.
4. In `HL7 Message Inspector`, use `Saved Generated HL7` > `Generated HL7 Dropdown`.
5. Pick a message or click one of the recent saved cards.
6. Click `Load to Validator`.
7. Click `Parse` or `Validate`.

The light/dark theme button is in the top bar. The browser stores the choice locally; clearing browser site data resets it.

## Common Errors

`Unknown database`

- The database name in the UI does not exist in MySQL.
- Click `Test` and choose one of the available databases.

`Table ... doesn't exist`

- The selected database is correct, but the table name in the query is wrong or belongs to another database.

`Name column ... was not found`

- `Name Column` must be a real returned column.
- Or leave `Name Column` empty and use `Custom Reference Name`.

`Content column ... was not found`

- `Content Column` must match the column containing HL7/reference text.

Website import returns `502`

- The website may be unreachable, blocked, slow, or require login.
- Try the HL7 Chapter 7 example URL above.
- If an external site has certificate/network issues, use the local bundled website sample: `http://127.0.0.1:5173/sample-hl7-reference.html`.

Validator says first segment must be `MSH`

- The validator expects raw HL7 content starting with `MSH|`.
- Website documentation text is not the same as a raw HL7 message.

## Useful Files

```text
README.md
docs/USER_GUIDE.md
docs/OPERATIONS.md
backend/app/main.py
backend/app/hl7.py
backend/app/database.py
backend/app/external_databases.py
frontend/src/App.jsx
frontend/src/styles.css
```
