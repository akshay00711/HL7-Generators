import pytest
from fastapi.testclient import TestClient

from app import database, external_databases
from app.external_sources import _is_tls_certificate_error
from app.external_databases import ExternalDatabaseError, _connect_mysql, _safe_select_query
from app.main import app
from app.models import MySQLConnectionConfig


def test_mysql_query_guard_allows_select():
    assert _safe_select_query("  SELECT name, content FROM hl7_references LIMIT 1  ") == "SELECT name, content FROM hl7_references LIMIT 1"


def test_website_import_recognizes_tls_certificate_errors():
    assert _is_tls_certificate_error("[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate")


def test_mysql_query_guard_allows_where_with_trailing_semicolon():
    assert (
        _safe_select_query("SELECT * FROM order_reports_detail where type = 'HL72.3';")
        == "SELECT * FROM order_reports_detail where type = 'HL72.3'"
    )


def test_mysql_query_guard_blocks_non_select():
    with pytest.raises(ExternalDatabaseError):
        _safe_select_query("DELETE FROM hl7_references")


def test_mysql_query_guard_blocks_multiple_statements():
    with pytest.raises(ExternalDatabaseError):
        _safe_select_query("SELECT name FROM hl7_references; DROP TABLE hl7_references")


def test_mysql_connection_requires_database_for_query():
    with pytest.raises(ExternalDatabaseError, match="Choose a MySQL database"):
        _connect_mysql(MySQLConnectionConfig(host="127.0.0.1", user="root", database=""))


def test_mysql_import_allows_custom_reference_name(monkeypatch):
    def fake_run_mysql_select(*_, **__):
        return {"rows": [{"content": "MSH|^~\\&|LAB|HOSP|EHR|HOSP|20260508103000||ORU^R01|MSG1|P|2.5.1"}]}

    monkeypatch.setattr(external_databases, "run_mysql_select", fake_run_mysql_select)

    imported = external_databases.first_reference_from_mysql(
        config=MySQLConnectionConfig(database="hl7"),
        query="SELECT content FROM reports LIMIT 1",
        name_column="",
        content_column="content",
        custom_name="New HL7",
    )

    assert imported["name"] == "New HL7"
    assert imported["content"].startswith("MSH|")


def test_mysql_import_endpoint_uses_selected_validator_content(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "hl7_workbench.db")
    hl7 = "MSH|^~\\&|LAB|HOSP|EHR|HOSP|20260508103000||ORU^R01|MSG1|P|2.5.1\r"

    with TestClient(app) as client:
        response = client.post(
            "/api/external-databases/mysql/import-reference",
            json={
                "connection": {"host": "127.0.0.1", "port": 3306, "user": "root", "password": "", "database": "hl7"},
                "query": "SELECT wrong_content FROM reports LIMIT 1",
                "name_column": "name",
                "content_column": "wrong_content",
                "report_type": "lab_result",
                "hl7_version": "2.5.1",
                "selected_name": "Validated Row",
                "selected_content": hl7,
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["name"] == "Validated Row"
    assert payload["content"] == hl7.strip()
    assert payload["source_type"] == "mysql"


def test_imported_reference_can_be_deleted_but_default_is_protected(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "hl7_workbench.db")

    with TestClient(app) as client:
        created = client.post(
            "/api/references",
            json={
                "name": "Imported website profile",
                "source_type": "website",
                "url": "https://example.test/hl7",
                "content": "Imported profile text",
            },
        )
        assert created.status_code == 200

        delete_created = client.delete(f"/api/references/{created.json()['id']}")
        assert delete_created.status_code == 200

        references = client.get("/api/references").json()
        assert all(reference["id"] != created.json()["id"] for reference in references)

        default_reference_id = next(reference["id"] for reference in references if reference["source_type"] == "database")
        delete_default = client.delete(f"/api/references/{default_reference_id}")
        assert delete_default.status_code == 400


def test_saved_generated_hl7_can_be_deleted(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "hl7_workbench.db")

    with TestClient(app) as client:
        created = client.post(
            "/api/history",
            json={
                "message": "MSH|^~\\&|APP|FAC|EHR|HOSP|20260508120000||ORU^R01|MSG1|P|2.5.1\r",
                "report_type": "lab_result",
                "hl7_version": "2.5.1",
            },
        )
        assert created.status_code == 200

        delete_created = client.delete(f"/api/history/{created.json()['id']}")
        assert delete_created.status_code == 200

        history = client.get("/api/history").json()
        assert all(item["id"] != created.json()["id"] for item in history)


def test_mysql_database_preset_is_saved_without_password(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "hl7_workbench.db")
    database.init_database()

    saved = database.save_mysql_database_preset(
        name="Local HL7",
        host="127.0.0.1",
        port=3306,
        user="root",
        database_name="hl7_reference_lab",
        query="SELECT content FROM order_reports_detail LIMIT 1",
        name_column="name",
        custom_name=None,
        content_column="content",
    )

    presets = database.list_mysql_database_presets()

    assert saved["database"] == "hl7_reference_lab"
    assert saved["query"].startswith("SELECT content")
    assert saved["saved_password"] is None
    assert not saved["password_saved"]
    assert presets[0]["name"] == "Local HL7"
    assert presets[0]["saved_password"] is None
    assert not presets[0]["password_saved"]


def test_mysql_database_preset_can_optionally_save_password(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "hl7_workbench.db")
    database.init_database()

    saved = database.save_mysql_database_preset(
        name="Local HL7",
        host="127.0.0.1",
        port=3306,
        user="root",
        database_name="hl7_reference_lab",
        query="SELECT content FROM order_reports_detail LIMIT 1",
        name_column="name",
        custom_name=None,
        content_column="content",
        saved_password="secret",
    )

    assert saved["saved_password"] == "secret"
    assert saved["password_saved"]

    updated = database.update_mysql_database_preset_password(preset_id=saved["id"], saved_password=None)

    assert updated["saved_password"] is None
    assert not updated["password_saved"]


def test_matching_mysql_database_preset_can_be_found(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "hl7_workbench.db")
    database.init_database()

    database.save_mysql_database_preset(
        name="Local HL7",
        host="127.0.0.1",
        port=3306,
        user="root",
        database_name="hl7_reference_lab",
        query="SELECT content FROM order_reports_detail LIMIT 1",
        name_column="name",
        custom_name="",
        content_column="content",
    )

    existing = database.find_mysql_database_preset_by_fields(
        host="127.0.0.1",
        port=3306,
        user="root",
        database_name="hl7_reference_lab",
        query="SELECT content FROM order_reports_detail LIMIT 1",
        name_column="name",
        custom_name=None,
        content_column="content",
    )

    assert existing is not None
    assert existing["name"] == "Local HL7"


def test_matching_mysql_reference_can_be_found(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", tmp_path / "hl7_workbench.db")
    database.init_database()

    content = "MSH|^~\\&|LAB|HOSP|EHR|HOSP|20260508103000||ORU^R01|MSG1|P|2.5.1"
    created = database.create_reference(
        name="New HL7",
        source_type="mysql",
        url="mysql://127.0.0.1:3306/hl7_reference_lab",
        report_type="lab_result",
        hl7_version="2.5.1",
        content=content,
        content_summary=content,
    )

    existing = database.find_reference_by_fields(
        name="New HL7",
        source_type="mysql",
        url="mysql://127.0.0.1:3306/hl7_reference_lab",
        report_type="lab_result",
        hl7_version="2.5.1",
        content=content,
    )

    assert existing is not None
    assert existing["id"] == created["id"]
