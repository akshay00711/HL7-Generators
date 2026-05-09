from fastapi import APIRouter, HTTPException

from ..database import delete_message_history, get_reference, list_message_history, save_message_history
from ..hl7 import parse_message
from ..models import MessageHistoryCreateRequest, MessageHistoryItem


router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("", response_model=list[MessageHistoryItem])
def history(limit: int = 20) -> list[MessageHistoryItem]:
    safe_limit = max(1, min(limit, 100))
    return [MessageHistoryItem(**item) for item in list_message_history(safe_limit)]


@router.post("", response_model=MessageHistoryItem)
def save_history(request: MessageHistoryCreateRequest) -> MessageHistoryItem:
    if request.reference_id is not None and get_reference(request.reference_id) is None:
        raise HTTPException(status_code=404, detail="Reference source was not found.")

    parsed = parse_message(request.message)
    saved_history = save_message_history(
        message_control_id=parsed.summary.get("message_control_id", ""),
        custom_name=request.custom_name.strip() if request.custom_name else None,
        report_type=request.report_type,
        hl7_version=request.hl7_version,
        reference_id=request.reference_id,
        message=request.message,
    )
    return MessageHistoryItem(**saved_history)


@router.delete("/{history_id}")
def delete_history_item(history_id: int) -> dict[str, bool | int]:
    if not delete_message_history(history_id):
        raise HTTPException(status_code=404, detail="Saved generated HL7 was not found.")
    return {"deleted": True, "id": history_id}
