from fastapi import APIRouter, HTTPException

from ..database import (
    create_reference,
    find_mysql_database_preset_by_fields,
    find_reference_by_fields,
    list_mysql_database_presets,
    save_mysql_database_preset,
    update_mysql_database_preset_password,
)
from ..external_databases import ExternalDatabaseError, first_reference_from_mysql, run_mysql_select, test_mysql_connection
from ..models import (
    MySQLQueryRequest,
    MySQLQueryResponse,
    MySQLReferenceImportRequest,
    MySQLSavedDatabaseCreateRequest,
    MySQLSavedDatabaseItem,
    MySQLTestRequest,
    MySQLTestResponse,
    ReferenceSource,
)
from .helpers import mysql_source_url, mysql_test_message, summary


router = APIRouter(prefix="/api/external-databases/mysql", tags=["mysql"])


@router.post("/test", response_model=MySQLTestResponse)
def test_mysql(request: MySQLTestRequest) -> MySQLTestResponse:
    try:
        result = test_mysql_connection(request.connection)
    except ExternalDatabaseError as error:
        raise HTTPException(status_code=502, detail=f"MySQL connection failed: {error}") from error

    return MySQLTestResponse(
        ok=True,
        message=mysql_test_message(request.connection.database, result["database_found"]),
        server_version=result["server_version"],
        database=result["database"],
        database_found=result["database_found"],
        databases=result["databases"],
    )


@router.post("/query", response_model=MySQLQueryResponse)
def query_mysql(request: MySQLQueryRequest) -> MySQLQueryResponse:
    try:
        result = run_mysql_select(request.connection, request.query, request.limit)
    except ExternalDatabaseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return MySQLQueryResponse(**result)


@router.post("/import-reference", response_model=ReferenceSource)
def import_mysql_reference(request: MySQLReferenceImportRequest) -> ReferenceSource:
    selected_content = request.selected_content.strip() if request.selected_content else ""
    if selected_content:
        selected_name = request.selected_name.strip() if request.selected_name else ""
        imported = {
            "name": selected_name or "Selected MySQL HL7",
            "content": selected_content,
        }
    else:
        try:
            imported = first_reference_from_mysql(
                config=request.connection,
                query=request.query,
                name_column=request.name_column,
                content_column=request.content_column,
                custom_name=request.custom_name,
            )
        except ExternalDatabaseError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    source_url = mysql_source_url(request.connection)
    existing_reference = find_reference_by_fields(
        name=imported["name"],
        source_type="mysql",
        url=source_url,
        report_type=request.report_type,
        hl7_version=request.hl7_version,
        content=imported["content"],
    )
    if existing_reference is not None:
        return ReferenceSource(**{**existing_reference, "already_exists": True})

    reference = create_reference(
        name=imported["name"],
        source_type="mysql",
        url=source_url,
        report_type=request.report_type,
        hl7_version=request.hl7_version,
        content=imported["content"],
        content_summary=summary(imported["content"]),
    )
    return ReferenceSource(**reference)


@router.get("/saved", response_model=list[MySQLSavedDatabaseItem])
def saved_mysql_databases() -> list[MySQLSavedDatabaseItem]:
    return [MySQLSavedDatabaseItem(**preset) for preset in list_mysql_database_presets()]


@router.post("/saved", response_model=MySQLSavedDatabaseItem)
def save_mysql_database(request: MySQLSavedDatabaseCreateRequest) -> MySQLSavedDatabaseItem:
    connection = request.connection
    host = connection.host.strip()
    user = connection.user.strip()
    database_name = connection.database.strip()
    if not database_name:
        raise HTTPException(status_code=400, detail="Enter a database name before saving.")

    preset_name = request.name.strip() if request.name else ""
    if not preset_name:
        preset_name = f"{database_name} @ {connection.host}:{connection.port}"
    query = request.query.strip()
    name_column = request.name_column.strip()
    custom_name = request.custom_name.strip() if request.custom_name else None
    content_column = request.content_column.strip()
    saved_password = connection.password if request.save_password else None

    existing_preset = find_mysql_database_preset_by_fields(
        host=host,
        port=connection.port,
        user=user,
        database_name=database_name,
        query=query,
        name_column=name_column,
        custom_name=custom_name,
        content_column=content_column,
    )
    if existing_preset is not None:
        updated_preset = update_mysql_database_preset_password(
            preset_id=existing_preset["id"],
            saved_password=saved_password,
        )
        return MySQLSavedDatabaseItem(**{**updated_preset, "already_exists": True})

    saved = save_mysql_database_preset(
        name=preset_name,
        host=host,
        port=connection.port,
        user=user,
        database_name=database_name,
        query=query,
        name_column=name_column,
        custom_name=custom_name,
        content_column=content_column,
        saved_password=saved_password,
    )
    return MySQLSavedDatabaseItem(**saved)
