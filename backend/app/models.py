from typing import Literal

from pydantic import BaseModel, Field


SupportedVersion = Literal["2.3", "2.4", "2.5", "2.5.1"]
ReportType = Literal["lab_result", "radiology_report", "adt_admission", "discharge_summary"]


class PatientInfo(BaseModel):
    patient_id: str = Field(default="P100045", min_length=1)
    first_name: str = Field(default="Anaya", min_length=1)
    last_name: str = Field(default="Rao", min_length=1)
    date_of_birth: str = Field(default="19870512", min_length=8, max_length=8)
    sex: Literal["M", "F", "O", "U"] = "F"
    address: str = "42 Lake Road^^Bengaluru^KA^560001"
    phone: str = "9876543210"


class ProviderInfo(BaseModel):
    provider_id: str = Field(default="DR7788", min_length=1)
    first_name: str = Field(default="Mira", min_length=1)
    last_name: str = Field(default="Sen", min_length=1)


class ObservationInput(BaseModel):
    identifier: str = Field(default="718-7", min_length=1)
    name: str = Field(default="Hemoglobin", min_length=1)
    value: str = Field(default="13.2", min_length=1)
    unit: str = "g/dL"
    reference_range: str = "12.0-15.5"
    abnormal_flag: str = "N"
    value_type: str = "NM"
    result_status: str = "F"


class GenerateRequest(BaseModel):
    hl7_version: SupportedVersion = "2.5.1"
    report_type: ReportType = "lab_result"
    sending_application: str = "HL7-AI-WORKBENCH"
    sending_facility: str = "SEMICOLON-LAB"
    receiving_application: str = "EHR"
    receiving_facility: str = "CITY-HOSPITAL"
    visit_number: str = "VST-20260508-001"
    order_id: str = "ORD-90001"
    filler_order_id: str = "FIL-44501"
    patient: PatientInfo = Field(default_factory=PatientInfo)
    provider: ProviderInfo = Field(default_factory=ProviderInfo)
    observations: list[ObservationInput] = Field(default_factory=list)
    diagnosis_code: str = "R53.83"
    diagnosis_text: str = "Other fatigue"
    study_description: str = "Chest X-ray"
    notes: str = "Generated for HL7 troubleshooting and validation."
    reference_id: int | None = None
    reference_name: str = ""
    external_reference_text: str = ""
    save_to_history: bool = False


class ParseRequest(BaseModel):
    message: str = Field(min_length=1)


class ValidateRequest(BaseModel):
    message: str = Field(min_length=1)
    hl7_version: SupportedVersion | None = None


class FieldDetail(BaseModel):
    position: str
    label: str
    raw: str
    components: list[str]


class SegmentDetail(BaseModel):
    index: int
    name: str
    description: str
    raw: str
    fields: list[FieldDetail]


class ParsedMessage(BaseModel):
    segment_count: int
    summary: dict[str, str]
    segments: list[SegmentDetail]


class ValidationIssue(BaseModel):
    severity: Literal["error", "warning", "info"]
    message: str
    segment: str | None = None
    line: int | None = None
    field: str | None = None


class ValidationResult(BaseModel):
    valid: bool
    issue_count: int
    errors: int
    warnings: int
    infos: int
    issues: list[ValidationIssue]


class ReferenceSource(BaseModel):
    id: int
    name: str
    source_type: str
    url: str | None = None
    report_type: str | None = None
    hl7_version: str | None = None
    content: str
    content_summary: str
    created_at: str
    already_exists: bool = False


class ReferenceCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    source_type: str = "database"
    url: str | None = None
    report_type: ReportType | None = None
    hl7_version: SupportedVersion | None = None
    content: str = Field(min_length=1)


class WebsiteReferenceRequest(BaseModel):
    url: str = Field(min_length=1)
    name: str | None = None
    report_type: ReportType | None = None
    hl7_version: SupportedVersion | None = None
    save: bool = True


class WebsiteReferenceResponse(BaseModel):
    reference: ReferenceSource
    fetched_title: str
    fetched_url: str


class MySQLConnectionConfig(BaseModel):
    host: str = Field(default="127.0.0.1", min_length=1)
    port: int = Field(default=3306, ge=1, le=65535)
    user: str = Field(default="root", min_length=1)
    password: str = ""
    database: str = ""


class MySQLTestRequest(BaseModel):
    connection: MySQLConnectionConfig


class MySQLTestResponse(BaseModel):
    ok: bool
    message: str
    server_version: str | None = None
    database: str | None = None
    database_found: bool = False
    databases: list[str] = []


class MySQLQueryRequest(BaseModel):
    connection: MySQLConnectionConfig
    query: str = Field(min_length=1)
    limit: int = Field(default=25, ge=1, le=100)


class MySQLQueryResponse(BaseModel):
    columns: list[str]
    rows: list[dict]
    row_count: int


class MySQLReferenceImportRequest(BaseModel):
    connection: MySQLConnectionConfig
    query: str = Field(min_length=1)
    name_column: str = "name"
    custom_name: str | None = None
    content_column: str = Field(default="content", min_length=1)
    report_type: ReportType | None = None
    hl7_version: SupportedVersion | None = None
    selected_name: str | None = None
    selected_content: str | None = None


class MySQLSavedDatabaseCreateRequest(BaseModel):
    name: str | None = None
    connection: MySQLConnectionConfig
    query: str = Field(min_length=1)
    name_column: str = "name"
    custom_name: str | None = None
    content_column: str = Field(default="content", min_length=1)
    save_password: bool = False


class MySQLSavedDatabaseItem(BaseModel):
    id: int
    name: str
    host: str
    port: int
    user: str
    database: str
    query: str
    name_column: str
    custom_name: str | None = None
    content_column: str
    saved_password: str | None = None
    password_saved: bool = False
    created_at: str
    updated_at: str
    already_exists: bool = False


class MessageHistoryItem(BaseModel):
    id: int
    message_control_id: str | None = None
    report_type: str
    hl7_version: str
    reference_id: int | None = None
    reference_name: str | None = None
    message: str
    created_at: str


class MessageHistoryCreateRequest(BaseModel):
    message: str = Field(min_length=1)
    report_type: ReportType
    hl7_version: SupportedVersion
    reference_id: int | None = None


class GenerateResponse(BaseModel):
    message: str
    parsed: ParsedMessage
    validation: ValidationResult
    reference: ReferenceSource | None = None
    history_item: MessageHistoryItem | None = None


class ParseResponse(BaseModel):
    parsed: ParsedMessage


class ValidateResponse(BaseModel):
    validation: ValidationResult
