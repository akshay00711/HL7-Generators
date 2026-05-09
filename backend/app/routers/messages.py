from fastapi import APIRouter, HTTPException

from ..database import get_reference, save_message_history
from ..hl7 import generate_message, options, parse_message, validate_message
from ..models import GenerateRequest, GenerateResponse, MessageHistoryItem, ParseRequest, ParseResponse, ReferenceSource, ValidateRequest, ValidateResponse


router = APIRouter(prefix="/api", tags=["hl7 messages"])


@router.get("/options")
def get_options() -> dict:
    return options()


@router.post("/generate", response_model=GenerateResponse)
def generate(request: GenerateRequest) -> GenerateResponse:
    resolved_request, reference = _resolve_reference(request)
    message = generate_message(resolved_request)
    parsed = parse_message(message)
    history_item = None
    if resolved_request.save_to_history:
        saved_history = save_message_history(
            message_control_id=parsed.summary.get("message_control_id", ""),
            custom_name=None,
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


@router.post("/parse", response_model=ParseResponse)
def parse(request: ParseRequest) -> ParseResponse:
    return ParseResponse(parsed=parse_message(request.message))


@router.post("/validate", response_model=ValidateResponse)
def validate(request: ValidateRequest) -> ValidateResponse:
    return ValidateResponse(validation=validate_message(request.message, expected_version=request.hl7_version))


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
