import httpx
from fastapi import APIRouter, HTTPException

from ..database import create_reference, delete_imported_reference, list_references
from ..external_sources import fetch_website_reference
from ..models import ReferenceCreateRequest, ReferenceSource, WebsiteReferenceRequest, WebsiteReferenceResponse
from .helpers import summary


router = APIRouter(prefix="/api/references", tags=["references"])


@router.get("", response_model=list[ReferenceSource])
def references() -> list[ReferenceSource]:
    return [ReferenceSource(**reference) for reference in list_references()]


@router.post("", response_model=ReferenceSource)
def add_reference(request: ReferenceCreateRequest) -> ReferenceSource:
    reference = create_reference(
        name=request.name,
        source_type=request.source_type,
        url=request.url,
        report_type=request.report_type,
        hl7_version=request.hl7_version,
        content=request.content,
        content_summary=summary(request.content),
    )
    return ReferenceSource(**reference)


@router.delete("/{reference_id}")
def delete_reference(reference_id: int) -> dict[str, bool | int]:
    deleted_reference = delete_imported_reference(reference_id)
    if deleted_reference is None:
        raise HTTPException(status_code=404, detail="Reference source was not found.")
    if deleted_reference.get("protected"):
        raise HTTPException(status_code=400, detail="Built-in database references cannot be removed.")
    return {"deleted": True, "id": reference_id}


@router.post("/import-website", response_model=WebsiteReferenceResponse)
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
