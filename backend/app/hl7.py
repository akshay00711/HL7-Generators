from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import uuid4

from .models import (
    FieldDetail,
    GenerateRequest,
    ParsedMessage,
    SegmentDetail,
    ValidationIssue,
    ValidationResult,
)


SUPPORTED_VERSIONS = ["2.3", "2.4", "2.5", "2.5.1"]

REPORT_TYPES = {
    "lab_result": {
        "label": "Lab Result",
        "message_type": "ORU^R01",
        "event": "R01",
        "required_segments": ["MSH", "PID", "ORC", "OBR", "OBX"],
    },
    "radiology_report": {
        "label": "Radiology Report",
        "message_type": "ORU^R01",
        "event": "R01",
        "required_segments": ["MSH", "PID", "ORC", "OBR", "OBX"],
    },
    "adt_admission": {
        "label": "ADT Admission",
        "message_type": "ADT^A01",
        "event": "A01",
        "required_segments": ["MSH", "PID", "PV1"],
    },
    "discharge_summary": {
        "label": "Discharge Summary",
        "message_type": "ADT^A03",
        "event": "A03",
        "required_segments": ["MSH", "PID", "PV1", "DG1", "NTE"],
    },
}

SEGMENT_DESCRIPTIONS = {
    "MSH": "Message Header",
    "EVN": "Event Type",
    "PID": "Patient Identification",
    "PV1": "Patient Visit",
    "ORC": "Common Order",
    "OBR": "Observation Request",
    "OBX": "Observation Result",
    "DG1": "Diagnosis",
    "NTE": "Notes and Comments",
    "AL1": "Patient Allergy Information",
    "TXA": "Document Notification",
}

KNOWN_SEGMENTS = set(SEGMENT_DESCRIPTIONS)

FIELD_LABELS = {
    "MSH": {
        1: "Field Separator",
        2: "Encoding Characters",
        3: "Sending Application",
        4: "Sending Facility",
        5: "Receiving Application",
        6: "Receiving Facility",
        7: "Date/Time of Message",
        8: "Security",
        9: "Message Type",
        10: "Message Control ID",
        11: "Processing ID",
        12: "Version ID",
    },
    "EVN": {
        1: "Event Type Code",
        2: "Recorded Date/Time",
    },
    "PID": {
        1: "Set ID",
        2: "Patient ID",
        3: "Patient Identifier List",
        4: "Alternate Patient ID",
        5: "Patient Name",
        6: "Mother's Maiden Name",
        7: "Date/Time of Birth",
        8: "Administrative Sex",
        11: "Patient Address",
        13: "Phone Number - Home",
    },
    "PV1": {
        1: "Set ID",
        2: "Patient Class",
        3: "Assigned Patient Location",
        7: "Attending Doctor",
        19: "Visit Number",
    },
    "ORC": {
        1: "Order Control",
        2: "Placer Order Number",
        3: "Filler Order Number",
        12: "Ordering Provider",
    },
    "OBR": {
        1: "Set ID",
        2: "Placer Order Number",
        3: "Filler Order Number",
        4: "Universal Service Identifier",
        7: "Observation Date/Time",
        16: "Ordering Provider",
        25: "Result Status",
    },
    "OBX": {
        1: "Set ID",
        2: "Value Type",
        3: "Observation Identifier",
        5: "Observation Value",
        6: "Units",
        7: "Reference Range",
        8: "Abnormal Flags",
        11: "Observation Result Status",
    },
    "DG1": {
        1: "Set ID",
        3: "Diagnosis Code",
        5: "Diagnosis Date/Time",
        6: "Diagnosis Type",
    },
    "NTE": {
        1: "Set ID",
        2: "Source of Comment",
        3: "Comment",
    },
}


@dataclass(frozen=True)
class SegmentLine:
    index: int
    name: str
    raw: str
    parts: list[str]


def generate_message(request: GenerateRequest) -> str:
    report = REPORT_TYPES[request.report_type]
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    control_id = f"MSG{uuid4().hex[:12].upper()}"
    provider = _provider_xcn(request.provider.provider_id, request.provider.last_name, request.provider.first_name)
    patient_name = f"{_escape(request.patient.last_name)}^{_escape(request.patient.first_name)}"
    patient_id = f"{_escape(request.patient.patient_id)}^^^MRN"

    segments = [
        _join(
            [
                "MSH",
                "^~\\&",
                _escape(request.sending_application),
                _escape(request.sending_facility),
                _escape(request.receiving_application),
                _escape(request.receiving_facility),
                timestamp,
                "",
                report["message_type"],
                control_id,
                "P",
                request.hl7_version,
            ]
        ),
        _join(["PID", "1", "", patient_id, "", patient_name, "", request.patient.date_of_birth, request.patient.sex, "", "", _escape(request.patient.address), "", _escape(request.patient.phone)]),
    ]

    if request.report_type in {"adt_admission", "discharge_summary"}:
        segments.append(_join(["EVN", report["event"], timestamp]))
        segments.append(_patient_visit_segment(request.visit_number, provider))
        if request.report_type == "discharge_summary":
            segments.append(_join(["DG1", "1", "", f"{_escape(request.diagnosis_code)}^{_escape(request.diagnosis_text)}^ICD-10", "", timestamp, "F"]))
            segments.extend(_note_segments(request.notes, request.reference_name, request.external_reference_text))
        else:
            segments.extend(_note_segments("", request.reference_name, request.external_reference_text))
        return "\r".join(segments) + "\r"

    observations = request.observations or _default_observations(request.report_type, request.study_description)
    segments.extend(
        [
            _patient_visit_segment(request.visit_number, provider),
            _join(["ORC", "RE", _escape(request.order_id), _escape(request.filler_order_id), "", "", "", "", "", "", "", "", provider]),
            _obr_segment(request, provider, timestamp),
        ]
    )

    for index, observation in enumerate(observations, start=1):
        segments.append(
            _join(
                [
                    "OBX",
                    str(index),
                    _escape(observation.value_type),
                    f"{_escape(observation.identifier)}^{_escape(observation.name)}^LN",
                    "",
                    _escape(observation.value),
                    _escape(observation.unit),
                    _escape(observation.reference_range),
                    _escape(observation.abnormal_flag),
                    "",
                    "",
                    _escape(observation.result_status),
                ]
            )
        )

    segments.extend(_note_segments(request.notes, request.reference_name, request.external_reference_text))

    return "\r".join(segments) + "\r"


def parse_message(message: str) -> ParsedMessage:
    lines = _segment_lines(message)
    segments: list[SegmentDetail] = []

    for segment in lines:
        fields = _field_details(segment)
        segments.append(
            SegmentDetail(
                index=segment.index,
                name=segment.name,
                description=SEGMENT_DESCRIPTIONS.get(segment.name, "Unknown or custom segment"),
                raw=segment.raw,
                fields=fields,
            )
        )

    return ParsedMessage(
        segment_count=len(segments),
        summary=_message_summary(lines),
        segments=segments,
    )


def validate_message(message: str, expected_version: str | None = None) -> ValidationResult:
    issues: list[ValidationIssue] = []
    lines = _segment_lines(message, keep_blank=True)
    non_blank_lines = [line for line in lines if line.raw.strip()]

    if not message.strip():
        issues.append(_issue("error", "Message is empty."))
        return _validation_result(issues)

    if "\r" not in message and "\n" in message:
        issues.append(_issue("warning", "HL7 v2 segments are conventionally separated with carriage returns. Newline-separated input was normalized."))

    normalized_message = message.replace("\r\n", "\r").replace("\n", "\r")
    for line in lines:
        if not line.raw.strip():
            if line.index == len(lines) and normalized_message.endswith("\r"):
                continue
            issues.append(_issue("warning", "Blank segment line was found and ignored.", line=line.index))

    if not non_blank_lines:
        issues.append(_issue("error", "No HL7 segments were found."))
        return _validation_result(issues)

    first = non_blank_lines[0]
    if first.name != "MSH":
        issues.append(_issue("error", "The first segment must be MSH.", segment=first.name, line=first.index))

    for line in non_blank_lines:
        if not _valid_segment_name(line.name):
            issues.append(_issue("error", f"Invalid segment name '{line.name}'. Segment names must be three uppercase alphanumeric characters.", segment=line.name, line=line.index))
        elif line.name not in KNOWN_SEGMENTS:
            issues.append(_issue("warning", f"Segment '{line.name}' is not in this validator's common HL7 segment dictionary.", segment=line.name, line=line.index))

    by_name = _group_segments(non_blank_lines)
    msh = by_name.get("MSH", [None])[0]
    if msh is not None:
        _validate_msh(msh, issues, expected_version)

    message_type = _get_field(msh, 9) if msh else ""
    _validate_required_segments(message_type, by_name, issues)

    for pid in by_name.get("PID", []):
        _validate_pid(pid, issues)

    for pv1 in by_name.get("PV1", []):
        _validate_pv1(pv1, issues)

    for obr in by_name.get("OBR", []):
        _validate_obr(obr, issues)

    for obx in by_name.get("OBX", []):
        _validate_obx(obx, issues)

    _validate_segment_order(non_blank_lines, issues)

    if not any(issue.severity == "error" for issue in issues):
        issues.append(_issue("info", "No blocking structural errors were found."))

    return _validation_result(issues)


def options() -> dict:
    return {
        "versions": SUPPORTED_VERSIONS,
        "report_types": [
            {"value": key, "label": value["label"], "message_type": value["message_type"]}
            for key, value in REPORT_TYPES.items()
        ],
    }


def _segment_lines(message: str, keep_blank: bool = False) -> list[SegmentLine]:
    normalized = message.replace("\r\n", "\r").replace("\n", "\r")
    raw_lines = normalized.split("\r")
    lines: list[SegmentLine] = []
    for index, raw in enumerate(raw_lines, start=1):
        if not keep_blank and not raw.strip():
            continue
        parts = raw.split("|") if raw else [""]
        name = parts[0].strip()
        lines.append(SegmentLine(index=index, name=name, raw=raw, parts=parts))
    return lines


def _field_details(segment: SegmentLine) -> list[FieldDetail]:
    labels = FIELD_LABELS.get(segment.name, {})
    fields: list[FieldDetail] = []

    if segment.name == "MSH":
        separator = segment.raw[3:4] if len(segment.raw) > 3 else "|"
        fields.append(FieldDetail(position="MSH-1", label=labels.get(1, "Field 1"), raw=separator, components=[separator]))
        for number, raw in enumerate(segment.parts[1:], start=2):
            fields.append(
                FieldDetail(
                    position=f"MSH-{number}",
                    label=labels.get(number, f"Field {number}"),
                    raw=raw,
                    components=_components(raw),
                )
            )
        return fields

    for number, raw in enumerate(segment.parts[1:], start=1):
        fields.append(
            FieldDetail(
                position=f"{segment.name}-{number}",
                label=labels.get(number, f"Field {number}"),
                raw=raw,
                components=_components(raw),
            )
        )
    return fields


def _message_summary(lines: list[SegmentLine]) -> dict[str, str]:
    by_name = _group_segments(lines)
    msh = by_name.get("MSH", [None])[0]
    pid = by_name.get("PID", [None])[0]
    pv1 = by_name.get("PV1", [None])[0]
    first_obr = by_name.get("OBR", [None])[0]

    summary = {
        "message_type": _get_field(msh, 9),
        "message_control_id": _get_field(msh, 10),
        "hl7_version": _get_field(msh, 12),
        "sending_application": _get_field(msh, 3),
        "sending_facility": _get_field(msh, 4),
        "receiving_application": _get_field(msh, 5),
        "receiving_facility": _get_field(msh, 6),
        "patient_id": _component(_get_field(pid, 3), 0),
        "patient_name": _human_name(_get_field(pid, 5)),
        "patient_dob": _get_field(pid, 7),
        "patient_sex": _get_field(pid, 8),
        "visit_number": _get_field(pv1, 19),
        "order_id": _get_field(first_obr, 2),
        "observation_count": str(len(by_name.get("OBX", []))),
    }
    return {key: value for key, value in summary.items() if value}


def _validate_msh(msh: SegmentLine, issues: list[ValidationIssue], expected_version: str | None) -> None:
    separator = msh.raw[3:4]
    if separator != "|":
        issues.append(_issue("error", "MSH field separator must be '|'.", segment="MSH", line=msh.index, field="MSH-1"))

    encoding = _get_field(msh, 2)
    if encoding != "^~\\&":
        issues.append(_issue("error", "MSH-2 encoding characters should be '^~\\&'.", segment="MSH", line=msh.index, field="MSH-2"))

    for field_number, label in [(9, "message type"), (10, "message control ID"), (11, "processing ID"), (12, "HL7 version")]:
        if not _get_field(msh, field_number):
            issues.append(_issue("error", f"MSH-{field_number} {label} is required.", segment="MSH", line=msh.index, field=f"MSH-{field_number}"))

    processing_id = _get_field(msh, 11)
    if processing_id and processing_id not in {"P", "T", "D"}:
        issues.append(_issue("warning", "MSH-11 processing ID is usually P, T, or D.", segment="MSH", line=msh.index, field="MSH-11"))

    version = _get_field(msh, 12)
    if version and version not in SUPPORTED_VERSIONS:
        issues.append(_issue("warning", f"HL7 version '{version}' is outside the versions supported by this app.", segment="MSH", line=msh.index, field="MSH-12"))

    if expected_version and version and expected_version != version:
        issues.append(_issue("error", f"Expected HL7 version {expected_version}, but message declares {version}.", segment="MSH", line=msh.index, field="MSH-12"))


def _validate_required_segments(message_type: str, by_name: dict[str, list[SegmentLine]], issues: list[ValidationIssue]) -> None:
    if not message_type:
        return

    required_by_message = {
        "ORU^R01": ["MSH", "PID", "OBR", "OBX"],
        "ADT^A01": ["MSH", "PID", "PV1"],
        "ADT^A03": ["MSH", "PID", "PV1"],
    }
    required = required_by_message.get(message_type)
    if required is None:
        issues.append(_issue("warning", f"No detailed segment profile is configured for message type '{message_type}'.", segment="MSH", field="MSH-9"))
        return

    for segment_name in required:
        if not by_name.get(segment_name):
            issues.append(_issue("error", f"Message type {message_type} requires segment {segment_name}.", segment=segment_name))


def _validate_pid(pid: SegmentLine, issues: list[ValidationIssue]) -> None:
    required_fields = [(3, "patient identifier"), (5, "patient name")]
    for number, label in required_fields:
        if not _get_field(pid, number):
            issues.append(_issue("error", f"PID-{number} {label} is required.", segment="PID", line=pid.index, field=f"PID-{number}"))

    dob = _get_field(pid, 7)
    if dob and not _valid_date(dob[:8]):
        issues.append(_issue("error", "PID-7 date of birth should start with YYYYMMDD.", segment="PID", line=pid.index, field="PID-7"))

    sex = _get_field(pid, 8)
    if sex and sex not in {"M", "F", "O", "U", "A", "N"}:
        issues.append(_issue("warning", "PID-8 administrative sex is not a common HL7 code.", segment="PID", line=pid.index, field="PID-8"))


def _validate_pv1(pv1: SegmentLine, issues: list[ValidationIssue]) -> None:
    patient_class = _get_field(pv1, 2)
    if not patient_class:
        issues.append(_issue("warning", "PV1-2 patient class is recommended for visit context.", segment="PV1", line=pv1.index, field="PV1-2"))
    elif patient_class not in {"I", "O", "E", "P", "R", "B", "N", "U"}:
        issues.append(_issue("warning", "PV1-2 patient class is not a common HL7 code.", segment="PV1", line=pv1.index, field="PV1-2"))


def _validate_obr(obr: SegmentLine, issues: list[ValidationIssue]) -> None:
    for number, label in [(4, "universal service identifier")]:
        if not _get_field(obr, number):
            issues.append(_issue("error", f"OBR-{number} {label} is required.", segment="OBR", line=obr.index, field=f"OBR-{number}"))


def _validate_obx(obx: SegmentLine, issues: list[ValidationIssue]) -> None:
    for number, label in [(2, "value type"), (3, "observation identifier"), (5, "observation value"), (11, "result status")]:
        if not _get_field(obx, number):
            issues.append(_issue("error", f"OBX-{number} {label} is required.", segment="OBX", line=obx.index, field=f"OBX-{number}"))

    value_type = _get_field(obx, 2)
    if value_type and value_type not in {"NM", "ST", "TX", "FT", "CWE", "CE", "DT", "TS", "SN"}:
        issues.append(_issue("warning", "OBX-2 value type is not in this validator's common value type list.", segment="OBX", line=obx.index, field="OBX-2"))

    status = _get_field(obx, 11)
    if status and status not in {"F", "C", "P", "R", "I", "S", "X"}:
        issues.append(_issue("warning", "OBX-11 result status is not a common HL7 observation status.", segment="OBX", line=obx.index, field="OBX-11"))


def _validate_segment_order(lines: list[SegmentLine], issues: list[ValidationIssue]) -> None:
    first_obr_index = _first_index(lines, "OBR")
    for obx in [line for line in lines if line.name == "OBX"]:
        if first_obr_index is None:
            issues.append(_issue("error", "OBX segment appears without an OBR segment.", segment="OBX", line=obx.index))
        elif obx.index < first_obr_index:
            issues.append(_issue("error", "OBX segment appears before OBR.", segment="OBX", line=obx.index))

    first_pid_index = _first_index(lines, "PID")
    if first_pid_index is not None and first_pid_index == 1:
        issues.append(_issue("error", "PID cannot appear before MSH.", segment="PID", line=first_pid_index))


def _validation_result(issues: list[ValidationIssue]) -> ValidationResult:
    errors = sum(1 for issue in issues if issue.severity == "error")
    warnings = sum(1 for issue in issues if issue.severity == "warning")
    infos = sum(1 for issue in issues if issue.severity == "info")
    return ValidationResult(
        valid=errors == 0,
        issue_count=len(issues),
        errors=errors,
        warnings=warnings,
        infos=infos,
        issues=issues,
    )


def _default_observations(report_type: str, study_description: str):
    from .models import ObservationInput

    if report_type == "radiology_report":
        return [
            ObservationInput(
                identifier="36643-5",
                name=study_description or "Radiology study",
                value="No acute cardiopulmonary abnormality. Clinical follow-up advised.",
                unit="",
                reference_range="",
                abnormal_flag="N",
                value_type="TX",
            )
        ]

    return [
        ObservationInput(identifier="718-7", name="Hemoglobin", value="13.2", unit="g/dL", reference_range="12.0-15.5", abnormal_flag="N", value_type="NM"),
        ObservationInput(identifier="4548-4", name="Hemoglobin A1c", value="5.7", unit="%", reference_range="4.0-5.6", abnormal_flag="H", value_type="NM"),
    ]


def _patient_visit_segment(visit_number: str, provider: str) -> str:
    return _join(["PV1", "1", "O", "OPD^01^01", "", "", "", provider, "", "", "", "", "", "", "", "", "", "", "", _escape(visit_number)])


def _obr_segment(request: GenerateRequest, provider: str, timestamp: str) -> str:
    if request.report_type == "radiology_report":
        service = f"36626-6^{_escape(request.study_description)}^LN"
        status = "F"
    else:
        service = "24323-8^Basic metabolic and blood panel^LN"
        status = "F"

    return _join(
        [
            "OBR",
            "1",
            _escape(request.order_id),
            _escape(request.filler_order_id),
            service,
            "",
            "",
            timestamp,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            provider,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            status,
        ]
    )


def _note_segments(notes: str, reference_name: str, reference_text: str) -> list[str]:
    values = []
    if notes:
        values.append(notes)
    reference_note = _reference_note(reference_name, reference_text)
    if reference_note:
        values.append(reference_note)
    return [_join(["NTE", str(index), "L", _escape(value)]) for index, value in enumerate(values, start=1)]


def _reference_note(reference_name: str, reference_text: str) -> str:
    if not reference_text:
        return ""
    source = reference_name or "External reference"
    compact = " ".join(reference_text.split())
    if len(compact) > 360:
        compact = compact[:357].rstrip() + "..."
    return f"Reference {source}: {compact}"


def _provider_xcn(provider_id: str, last_name: str, first_name: str) -> str:
    return f"{_escape(provider_id)}^{_escape(last_name)}^{_escape(first_name)}"


def _join(values: list[str]) -> str:
    return "|".join(values)


def _escape(value: str) -> str:
    return (
        str(value)
        .replace("\\", "\\E\\")
        .replace("|", "\\F\\")
        .replace("^", "\\S\\")
        .replace("~", "\\R\\")
        .replace("&", "\\T\\")
    )


def _components(raw: str) -> list[str]:
    return raw.split("^") if raw else []


def _component(raw: str, index: int) -> str:
    components = _components(raw)
    return components[index] if len(components) > index else ""


def _human_name(raw: str) -> str:
    parts = _components(raw)
    if len(parts) >= 2:
        return f"{parts[1]} {parts[0]}".strip()
    return raw


def _get_field(segment: SegmentLine | None, number: int) -> str:
    if segment is None:
        return ""
    if segment.name == "MSH":
        if number == 1:
            return segment.raw[3:4]
        index = number - 1
        return segment.parts[index] if len(segment.parts) > index else ""
    return segment.parts[number] if len(segment.parts) > number else ""


def _group_segments(lines: list[SegmentLine]) -> dict[str, list[SegmentLine]]:
    grouped: dict[str, list[SegmentLine]] = {}
    for line in lines:
        if not line.raw.strip():
            continue
        grouped.setdefault(line.name, []).append(line)
    return grouped


def _valid_segment_name(name: str) -> bool:
    return len(name) == 3 and name.isalnum() and name.upper() == name


def _valid_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y%m%d")
    except ValueError:
        return False
    return True


def _first_index(lines: list[SegmentLine], segment_name: str) -> int | None:
    for line in lines:
        if line.name == segment_name:
            return line.index
    return None


def _issue(
    severity: str,
    message: str,
    segment: str | None = None,
    line: int | None = None,
    field: str | None = None,
) -> ValidationIssue:
    return ValidationIssue(severity=severity, message=message, segment=segment, line=line, field=field)
