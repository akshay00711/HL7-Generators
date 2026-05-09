from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .database import (
    create_reference,
    delete_imported_reference,
    delete_message_history,
    find_mysql_database_preset_by_fields,
    find_reference_by_fields,
    get_reference,
    init_database,
    list_message_history,
    list_mysql_database_presets,
    list_references,
    save_message_history,
    save_mysql_database_preset,
    update_mysql_database_preset_password,
)
from .external_databases import ExternalDatabaseError, first_reference_from_mysql, run_mysql_select, test_mysql_connection
from .external_sources import fetch_website_reference
from .hl7 import generate_message, options, parse_message, validate_message
from .models import (
    GenerateRequest,
    GenerateResponse,
    MessageHistoryCreateRequest,
    MessageHistoryItem,
    MySQLQueryRequest,
    MySQLQueryResponse,
    MySQLReferenceImportRequest,
    MySQLSavedDatabaseCreateRequest,
    MySQLSavedDatabaseItem,
    MySQLTestRequest,
    MySQLTestResponse,
    ParseRequest,
    ParseResponse,
    ReferenceCreateRequest,
    ReferenceSource,
    ValidateRequest,
    ValidateResponse,
    WebsiteReferenceRequest,
    WebsiteReferenceResponse,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(title="HL7 AI Workbench API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "HL7 AI Workbench API"}


@app.get("/api/options")
def get_options() -> dict:
    return options()


@app.post("/api/generate", response_model=GenerateResponse)
def generate(request: GenerateRequest) -> GenerateResponse:
    resolved_request, reference = _resolve_reference(request)
    message = generate_message(resolved_request)
    parsed = parse_message(message)
    history_item = None
    if resolved_request.save_to_history:
        saved_history = save_message_history(
            message_control_id=parsed.summary.get("message_control_id", ""),
            report_type=resolved_request.report_type,
            hl7_version=resolved_request.hl7_version,
            reference_id=resolved_request.reference_id,
            message=message,
        )
        history_item = MessageHistoryItem(**saved_history)
    return GenerateResponse(
        message=message,
        parsed=parsed,
        validation=validate_message(message, expected_version=resolved_request.hl7_version),
        reference=reference,
        history_item=history_item,
    )


@app.post("/api/parse", response_model=ParseResponse)
def parse(request: ParseRequest) -> ParseResponse:
    return ParseResponse(parsed=parse_message(request.message))


@app.post("/api/validate", response_model=ValidateResponse)
def validate(request: ValidateRequest) -> ValidateResponse:
    return ValidateResponse(validation=validate_message(request.message, expected_version=request.hl7_version))


@app.get("/api/references", response_model=list[ReferenceSource])
def references() -> list[ReferenceSource]:
    return [ReferenceSource(**reference) for reference in list_references()]


@app.post("/api/references", response_model=ReferenceSource)
def add_reference(request: ReferenceCreateRequest) -> ReferenceSource:
    reference = create_reference(
        name=request.name,
        source_type=request.source_type,
        url=request.url,
        report_type=request.report_type,
        hl7_version=request.hl7_version,
        content=request.content,
        content_summary=_summary(request.content),
    )
    return ReferenceSource(**reference)


@app.delete("/api/references/{reference_id}")
def delete_reference(reference_id: int) -> dict[str, bool | int]:
    deleted_reference = delete_imported_reference(reference_id)
    if deleted_reference is None:
        raise HTTPException(status_code=404, detail="Reference source was not found.")
    if deleted_reference.get("protected"):
        raise HTTPException(status_code=400, detail="Built-in database references cannot be removed.")
    return {"deleted": True, "id": reference_id}


@app.post("/api/references/import-website", response_model=WebsiteReferenceResponse)
async def import_website_reference(request: WebsiteReferenceRequest) -> WebsiteReferenceResponse:
    try:
        fetched = await fetch_website_reference(request.url)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except httpx.HTTPStatusError as error:
        raise HTTPException(status_code=502, detail=f"Website returned HTTP {error.response.status_code}.") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Website fetch failed: {error}") from error

    name = request.name or fetched["title"] or "Imported website reference"
    if request.save:
        reference = create_reference(
            name=name,
            source_type="website",
            url=fetched["url"],
            report_type=request.report_type,
            hl7_version=request.hl7_version,
            content=fetched["content"],
            content_summary=fetched["summary"],
        )
    else:
        reference = {
            "id": 0,
            "name": name,
            "source_type": "website",
            "url": fetched["url"],
            "report_type": request.report_type,
            "hl7_version": request.hl7_version,
            "content": fetched["content"],
            "content_summary": fetched["summary"],
            "created_at": "",
        }

    return WebsiteReferenceResponse(
        reference=ReferenceSource(**reference),
        fetched_title=fetched["title"],
        fetched_url=fetched["url"],
    )


@app.post("/api/external-databases/mysql/test", response_model=MySQLTestResponse)
def test_mysql(request: MySQLTestRequest) -> MySQLTestResponse:
    try:
        result = test_mysql_connection(request.connection)
    except ExternalDatabaseError as error:
        raise HTTPException(status_code=502, detail=f"MySQL connection failed: {error}") from error

    return MySQLTestResponse(
        ok=True,
        message=_mysql_test_message(request.connection.database, result["database_found"]),
        server_version=result["server_version"],
        database=result["database"],
        database_found=result["database_found"],
        databases=result["databases"],
    )


@app.post("/api/external-databases/mysql/query", response_model=MySQLQueryResponse)
def query_mysql(request: MySQLQueryRequest) -> MySQLQueryResponse:
    try:
        result = run_mysql_select(request.connection, request.query, request.limit)
    except ExternalDatabaseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return MySQLQueryResponse(**result)


@app.post("/api/external-databases/mysql/import-reference", response_model=ReferenceSource)
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

    source_url = _mysql_source_url(request.connection)
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
        content_summary=_summary(imported["content"]),
    )
    return ReferenceSource(**reference)


@app.get("/api/external-databases/mysql/saved", response_model=list[MySQLSavedDatabaseItem])
def saved_mysql_databases() -> list[MySQLSavedDatabaseItem]:
    return [MySQLSavedDatabaseItem(**preset) for preset in list_mysql_database_presets()]


@app.post("/api/external-databases/mysql/saved", response_model=MySQLSavedDatabaseItem)
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


@app.get("/api/history", response_model=list[MessageHistoryItem])
def history(limit: int = 20) -> list[MessageHistoryItem]:
    safe_limit = max(1, min(limit, 100))
    return [MessageHistoryItem(**item) for item in list_message_history(safe_limit)]


@app.post("/api/history", response_model=MessageHistoryItem)
def save_history(request: MessageHistoryCreateRequest) -> MessageHistoryItem:
    if request.reference_id is not None and get_reference(request.reference_id) is None:
        raise HTTPException(status_code=404, detail="Reference source was not found.")

    parsed = parse_message(request.message)
    saved_history = save_message_history(
        message_control_id=parsed.summary.get("message_control_id", ""),
        report_type=request.report_type,
        hl7_version=request.hl7_version,
        reference_id=request.reference_id,
        message=request.message,
    )
    return MessageHistoryItem(**saved_history)


@app.delete("/api/history/{history_id}")
def delete_history_item(history_id: int) -> dict[str, bool | int]:
    if not delete_message_history(history_id):
        raise HTTPException(status_code=404, detail="Saved generated HL7 was not found.")
    return {"deleted": True, "id": history_id}


def _resolve_reference(request: GenerateRequest) -> tuple[GenerateRequest, ReferenceSource | None]:
    if request.reference_id is None:
        return request, None

    stored_reference = get_reference(request.reference_id)
    if stored_reference is None:
        raise HTTPException(status_code=404, detail="Reference source was not found.")

    reference = ReferenceSource(**stored_reference)
    resolved_request = request.model_copy(
        update={
            "reference_name": reference.name,
            "external_reference_text": reference.content,
        }
    )
    return resolved_request, reference


def _summary(content: str) -> str:
    compact = " ".join(content.split())
    if len(compact) <= 700:
        return compact
    return compact[:697].rstrip() + "..."


def _mysql_source_url(connection) -> str:
    return f"mysql://{connection.host.strip()}:{connection.port}/{connection.database.strip()}"


def _mysql_test_message(database: str, database_found: bool) -> str:
    requested = database.strip()
    if not requested:
        return "MySQL server connection succeeded. Choose a database from the list."
    if database_found:
        return f"MySQL server connection succeeded and database '{requested}' was found."
    return f"MySQL server connection succeeded, but database '{requested}' was not found."
