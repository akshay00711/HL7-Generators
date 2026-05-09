from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


DB_PATH = Path(__file__).resolve().parent.parent / "hl7_workbench.db"
IMPORTED_REFERENCE_TYPES = {"website", "mysql"}


def init_database() -> None:
    with _connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS reference_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                source_type TEXT NOT NULL,
                url TEXT,
                report_type TEXT,
                hl7_version TEXT,
                content TEXT NOT NULL,
                content_summary TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS message_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_control_id TEXT,
                custom_name TEXT,
                report_type TEXT NOT NULL,
                hl7_version TEXT NOT NULL,
                reference_id INTEGER,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(reference_id) REFERENCES reference_sources(id)
            )
            """
        )
        _ensure_message_history_custom_name(connection)
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS mysql_database_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                host TEXT NOT NULL,
                port INTEGER NOT NULL,
                user TEXT NOT NULL,
                saved_password TEXT,
                database_name TEXT NOT NULL,
                query TEXT NOT NULL,
                name_column TEXT NOT NULL,
                custom_name TEXT,
                content_column TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        _ensure_mysql_password_columns(connection)
        _seed_references(connection)


def list_references() -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT id, name, source_type, url, report_type, hl7_version, content, content_summary, created_at
            FROM reference_sources
            ORDER BY datetime(created_at) DESC, id DESC
            """
        ).fetchall()
    return [_row_to_dict(row) for row in rows]


def get_reference(reference_id: int) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, name, source_type, url, report_type, hl7_version, content, content_summary, created_at
            FROM reference_sources
            WHERE id = ?
            """,
            (reference_id,),
        ).fetchone()
    return _row_to_dict(row) if row else None


def create_reference(
    *,
    name: str,
    source_type: str,
    content: str,
    content_summary: str,
    url: str | None = None,
    report_type: str | None = None,
    hl7_version: str | None = None,
) -> dict[str, Any]:
    created_at = _now()
    with _connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO reference_sources
                (name, source_type, url, report_type, hl7_version, content, content_summary, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, source_type, url, report_type, hl7_version, content, content_summary, created_at),
        )
        reference_id = cursor.lastrowid
    created = get_reference(int(reference_id))
    if created is None:
        raise RuntimeError("Reference was not created.")
    return created


def find_reference_by_fields(
    *,
    name: str,
    source_type: str,
    content: str,
    url: str | None = None,
    report_type: str | None = None,
    hl7_version: str | None = None,
) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, name, source_type, url, report_type, hl7_version, content, content_summary, created_at
            FROM reference_sources
            WHERE name = ?
              AND source_type = ?
              AND COALESCE(url, '') = COALESCE(?, '')
              AND COALESCE(report_type, '') = COALESCE(?, '')
              AND COALESCE(hl7_version, '') = COALESCE(?, '')
              AND content = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (name, source_type, url, report_type, hl7_version, content),
        ).fetchone()
    return _row_to_dict(row) if row else None


def delete_imported_reference(reference_id: int) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, name, source_type, url, report_type, hl7_version, content, content_summary, created_at
            FROM reference_sources
            WHERE id = ?
            """,
            (reference_id,),
        ).fetchone()
        if row is None:
            return None

        reference = _row_to_dict(row)
        if reference["source_type"] not in IMPORTED_REFERENCE_TYPES:
            return {**reference, "protected": True}

        connection.execute("UPDATE message_history SET reference_id = NULL WHERE reference_id = ?", (reference_id,))
        connection.execute("DELETE FROM reference_sources WHERE id = ?", (reference_id,))
    return {**reference, "protected": False}


def save_message_history(
    *,
    message_control_id: str,
    custom_name: str | None,
    report_type: str,
    hl7_version: str,
    reference_id: int | None,
    message: str,
) -> dict[str, Any]:
    created_at = _now()
    with _connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO message_history
                (message_control_id, custom_name, report_type, hl7_version, reference_id, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (message_control_id, custom_name, report_type, hl7_version, reference_id, message, created_at),
        )
        history_id = cursor.lastrowid
        row = connection.execute(
            """
            SELECT h.id, h.message_control_id, h.custom_name, h.report_type, h.hl7_version, h.reference_id,
                   r.name AS reference_name, h.message, h.created_at
            FROM message_history h
            LEFT JOIN reference_sources r ON r.id = h.reference_id
            WHERE h.id = ?
            """,
            (history_id,),
        ).fetchone()
    return _row_to_dict(row)


def list_message_history(limit: int = 20) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT h.id, h.message_control_id, h.custom_name, h.report_type, h.hl7_version, h.reference_id,
                   r.name AS reference_name, h.message, h.created_at
            FROM message_history h
            LEFT JOIN reference_sources r ON r.id = h.reference_id
            ORDER BY datetime(h.created_at) DESC, h.id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [_row_to_dict(row) for row in rows]


def delete_message_history(history_id: int) -> bool:
    with _connect() as connection:
        cursor = connection.execute("DELETE FROM message_history WHERE id = ?", (history_id,))
    return cursor.rowcount > 0


def list_mysql_database_presets() -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            """
            SELECT id, name, host, port, user, database_name AS database, query,
                   name_column, custom_name, content_column, saved_password,
                   CASE WHEN saved_password IS NOT NULL AND saved_password != '' THEN 1 ELSE 0 END AS password_saved,
                   created_at, updated_at
            FROM mysql_database_presets
            ORDER BY datetime(updated_at) DESC, id DESC
            """
        ).fetchall()
    return [_row_to_dict(row) for row in rows]


def save_mysql_database_preset(
    *,
    name: str,
    host: str,
    port: int,
    user: str,
    database_name: str,
    query: str,
    name_column: str,
    custom_name: str | None,
    content_column: str,
    saved_password: str | None = None,
) -> dict[str, Any]:
    saved_at = _now()
    with _connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO mysql_database_presets
                (name, host, port, user, saved_password, database_name, query, name_column, custom_name,
                 content_column, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                host,
                port,
                user,
                saved_password,
                database_name,
                query,
                name_column,
                custom_name,
                content_column,
                saved_at,
                saved_at,
            ),
        )
        preset_id = cursor.lastrowid
        row = connection.execute(
            """
            SELECT id, name, host, port, user, database_name AS database, query,
                   name_column, custom_name, content_column, saved_password,
                   CASE WHEN saved_password IS NOT NULL AND saved_password != '' THEN 1 ELSE 0 END AS password_saved,
                   created_at, updated_at
            FROM mysql_database_presets
            WHERE id = ?
            """,
            (preset_id,),
        ).fetchone()
    return _row_to_dict(row)


def update_mysql_database_preset_password(*, preset_id: int, saved_password: str | None) -> dict[str, Any]:
    updated_at = _now()
    with _connect() as connection:
        connection.execute(
            """
            UPDATE mysql_database_presets
            SET saved_password = ?, updated_at = ?
            WHERE id = ?
            """,
            (saved_password, updated_at, preset_id),
        )
        row = connection.execute(
            """
            SELECT id, name, host, port, user, database_name AS database, query,
                   name_column, custom_name, content_column, saved_password,
                   CASE WHEN saved_password IS NOT NULL AND saved_password != '' THEN 1 ELSE 0 END AS password_saved,
                   created_at, updated_at
            FROM mysql_database_presets
            WHERE id = ?
            """,
            (preset_id,),
        ).fetchone()
    if row is None:
        raise RuntimeError("Saved MySQL database preset was not found.")
    return _row_to_dict(row)


def find_mysql_database_preset_by_fields(
    *,
    host: str,
    port: int,
    user: str,
    database_name: str,
    query: str,
    name_column: str,
    custom_name: str | None,
    content_column: str,
) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            """
            SELECT id, name, host, port, user, database_name AS database, query,
                   name_column, custom_name, content_column, saved_password,
                   CASE WHEN saved_password IS NOT NULL AND saved_password != '' THEN 1 ELSE 0 END AS password_saved,
                   created_at, updated_at
            FROM mysql_database_presets
            WHERE host = ?
              AND port = ?
              AND user = ?
              AND database_name = ?
              AND query = ?
              AND name_column = ?
              AND COALESCE(custom_name, '') = COALESCE(?, '')
              AND content_column = ?
            ORDER BY id DESC
            LIMIT 1
            """,
            (host, port, user, database_name, query, name_column, custom_name, content_column),
        ).fetchone()
    return _row_to_dict(row) if row else None


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _ensure_mysql_password_columns(connection: sqlite3.Connection) -> None:
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(mysql_database_presets)").fetchall()}
    if "saved_password" not in columns:
        connection.execute("ALTER TABLE mysql_database_presets ADD COLUMN saved_password TEXT")


def _ensure_message_history_custom_name(connection: sqlite3.Connection) -> None:
    columns = {row["name"] for row in connection.execute("PRAGMA table_info(message_history)").fetchall()}
    if "custom_name" not in columns:
        connection.execute("ALTER TABLE message_history ADD COLUMN custom_name TEXT")


def _seed_references(connection: sqlite3.Connection) -> None:
    existing_count = connection.execute("SELECT COUNT(*) FROM reference_sources").fetchone()[0]
    if existing_count:
        return

    created_at = _now()
    seed_rows = [
        (
            "Default ORU R01 Lab Profile",
            "database",
            None,
            "lab_result",
            "2.5.1",
            "ORU R01 lab messages should include MSH, PID, PV1, ORC, OBR, and at least one OBX segment. OBX-2 identifies the value type, OBX-3 carries the observation identifier, OBX-5 carries the result value, and OBX-11 carries the result status.",
            "ORU R01 profile with required lab result segments and key OBX fields.",
            created_at,
        ),
        (
            "Default ADT Visit Profile",
            "database",
            None,
            "adt_admission",
            "2.5.1",
            "ADT visit messages should include MSH, EVN, PID, and PV1. PV1-2 carries patient class and PV1-19 carries the visit number. ADT A01 represents admission or registration and ADT A03 represents discharge.",
            "ADT profile with visit context requirements for A01 and A03 messages.",
            created_at,
        ),
    ]
    connection.executemany(
        """
        INSERT INTO reference_sources
            (name, source_type, url, report_type, hl7_version, content, content_summary, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        seed_rows,
    )


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


def _now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
