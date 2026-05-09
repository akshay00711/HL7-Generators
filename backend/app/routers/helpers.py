def summary(content: str) -> str:
    compact = " ".join(content.split())
    if len(compact) <= 700:
        return compact
    return compact[:697].rstrip() + "..."


def mysql_source_url(connection) -> str:
    return f"mysql://{connection.host.strip()}:{connection.port}/{connection.database.strip()}"


def mysql_test_message(database: str, database_found: bool) -> str:
    requested = database.strip()
    if not requested:
        return "MySQL server connection succeeded. Choose a database from the list."
    if database_found:
        return f"MySQL server connection succeeded and database '{requested}' was found."
    return f"MySQL server connection succeeded, but database '{requested}' was not found."
