from __future__ import annotations

from typing import Any

import pymysql
from pymysql.cursors import DictCursor

from .models import MySQLConnectionConfig


class ExternalDatabaseError(Exception):
    pass


def test_mysql_connection(config: MySQLConnectionConfig) -> dict[str, Any]:
    with _connect_mysql(config, use_database=False) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT VERSION() AS version")
            version_row = cursor.fetchone()
            cursor.execute("SHOW DATABASES")
            databases = [str(next(iter(row.values()))) for row in cursor.fetchall()]

    requested_database = config.database.strip()
    return {
        "server_version": str(version_row.get("version", "")),
        "database": requested_database,
        "database_found": requested_database in databases if requested_database else False,
        "databases": databases,
    }


def run_mysql_select(config: MySQLConnectionConfig, query: str, limit: int = 25) -> dict[str, Any]:
    safe_query = _safe_select_query(query)
    safe_limit = max(1, min(limit, 100))

    try:
        with _connect_mysql(config) as connection:
            with connection.cursor() as cursor:
                cursor.execute(safe_query)
                rows = cursor.fetchmany(safe_limit)
                columns = [description[0] for description in cursor.description or []]
    except pymysql.MySQLError as error:
        raise ExternalDatabaseError(str(error)) from error

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


def first_reference_from_mysql(
    *,
    config: MySQLConnectionConfig,
    query: str,
    name_column: str,
    content_column: str,
    custom_name: str | None = None,
) -> dict[str, str]:
    result = run_mysql_select(config, query, limit=1)
    rows = result["rows"]
    if not rows:
        raise ExternalDatabaseError("The query returned no rows.")

    row = rows[0]
    resolved_custom_name = (custom_name or "").strip()
    resolved_name_column = name_column.strip()

    if not resolved_custom_name and not resolved_name_column:
        raise ExternalDatabaseError("Enter a name column or a custom reference name.")
    if not resolved_custom_name and resolved_name_column not in row:
        raise ExternalDatabaseError(f"Name column '{name_column}' was not found in the query result.")
    if content_column not in row:
        raise ExternalDatabaseError(f"Content column '{content_column}' was not found in the query result.")

    name = resolved_custom_name or str(row.get(resolved_name_column) or "").strip()
    content = str(row.get(content_column) or "").strip()
    if not name:
        raise ExternalDatabaseError("The selected name column is empty.")
    if not content:
        raise ExternalDatabaseError("The selected content column is empty.")

    return {"name": name, "content": content}


def _connect_mysql(config: MySQLConnectionConfig, use_database: bool = True):
    database = config.database.strip()
    if use_database and not database:
        raise ExternalDatabaseError("Choose a MySQL database before previewing or importing.")

    try:
        return pymysql.connect(
            host=config.host,
            port=config.port,
            user=config.user,
            password=config.password,
            database=database if use_database else None,
            connect_timeout=6,
            read_timeout=12,
            write_timeout=12,
            charset="utf8mb4",
            cursorclass=DictCursor,
            autocommit=True,
        )
    except pymysql.err.OperationalError as error:
        if error.args and error.args[0] == 1049:
            raise ExternalDatabaseError(f"Database '{database}' was not found. Click Test to list available databases.") from error
        raise ExternalDatabaseError(str(error)) from error
    except pymysql.MySQLError as error:
        raise ExternalDatabaseError(str(error)) from error


def _safe_select_query(query: str) -> str:
    compact = " ".join(query.strip().split())
    if not compact:
        raise ExternalDatabaseError("Query is required.")
    if compact.endswith(";"):
        compact = compact[:-1].rstrip()
    lowered = compact.lower()
    if not lowered.startswith("select "):
        raise ExternalDatabaseError("Only read-only SELECT queries are allowed.")
    if ";" in compact:
        raise ExternalDatabaseError("Multiple statements are not allowed.")
    blocked_tokens = [" insert ", " update ", " delete ", " drop ", " alter ", " create ", " truncate ", " replace ", " grant ", " revoke "]
    padded = f" {lowered} "
    if any(token in padded for token in blocked_tokens):
        raise ExternalDatabaseError("Only read-only SELECT queries are allowed.")
    return compact
