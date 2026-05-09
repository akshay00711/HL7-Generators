from app.hl7 import generate_message, parse_message, validate_message
from app.models import GenerateRequest


def test_generated_lab_message_is_valid():
    request = GenerateRequest(report_type="lab_result", hl7_version="2.5.1")

    message = generate_message(request)
    validation = validate_message(message, expected_version="2.5.1")

    assert "MSH|^~\\&" in message
    assert "ORU^R01" in message
    assert validation.valid
    assert validation.errors == 0


def test_parser_returns_readable_summary():
    message = generate_message(GenerateRequest(report_type="radiology_report"))

    parsed = parse_message(message)

    assert parsed.segment_count >= 5
    assert parsed.summary["message_type"] == "ORU^R01"
    assert parsed.summary["patient_name"] == "Anaya Rao"
    assert parsed.summary["observation_count"] == "1"


def test_validator_rejects_missing_required_segments():
    message = "MSH|^~\\&|APP|FAC|EHR|HOSP|20260508120000||ORU^R01|MSG1|P|2.5.1\rPID|1||P1^^^MRN||Rao^Anaya||19870512|F\r"

    validation = validate_message(message)

    assert not validation.valid
    assert any(issue.segment == "OBR" for issue in validation.issues)
    assert any(issue.segment == "OBX" for issue in validation.issues)


def test_generated_message_can_include_external_reference_note():
    request = GenerateRequest(
        report_type="lab_result",
        reference_name="External ORU profile",
        external_reference_text="OBX segments should carry observation values and final result status.",
    )

    message = generate_message(request)
    validation = validate_message(message, expected_version=request.hl7_version)

    assert "Reference External ORU profile" in message
    assert "OBX segments should carry observation values" in message
    assert validation.valid
