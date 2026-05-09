from __future__ import annotations

import html
import re
from urllib.parse import urlparse

import httpx


MAX_REFERENCE_CHARS = 12000
FETCH_TIMEOUT = httpx.Timeout(12.0, connect=6.0)
FETCH_HEADERS = {"User-Agent": "HL7-AI-Workbench/0.1"}


async def fetch_website_reference(url: str) -> dict[str, str]:
    parsed = urlparse(str(url))
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Only valid http or https website URLs are supported.")

    try:
        response = await _fetch_response(url, verify=True)
    except httpx.ConnectError as error:
        if not _is_tls_certificate_error(error):
            raise
        response = await _fetch_response(url, verify=False)

    content_type = response.headers.get("content-type", "")
    text = response.text
    if "html" in content_type.lower():
        title = _extract_title(text) or parsed.netloc
        readable_text = _html_to_text(text)
    else:
        title = parsed.netloc
        readable_text = _normalize_space(text)

    readable_text = readable_text[:MAX_REFERENCE_CHARS]
    return {
        "title": title,
        "content": readable_text,
        "summary": _summary(readable_text),
        "url": str(response.url),
    }


async def _fetch_response(url: str, *, verify: bool) -> httpx.Response:
    async with httpx.AsyncClient(
        follow_redirects=True,
        timeout=FETCH_TIMEOUT,
        headers=FETCH_HEADERS,
        verify=verify,
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response


def _is_tls_certificate_error(error: Exception) -> bool:
    message = str(error).lower()
    return "certificate_verify_failed" in message or "certificate verify failed" in message


def _extract_title(source: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", source, flags=re.IGNORECASE | re.DOTALL)
    return _normalize_space(html.unescape(match.group(1))) if match else ""


def _html_to_text(source: str) -> str:
    cleaned = re.sub(r"(?is)<(script|style|noscript|svg).*?</\1>", " ", source)
    cleaned = re.sub(r"(?is)<br\s*/?>", "\n", cleaned)
    cleaned = re.sub(r"(?is)</(p|div|li|tr|h[1-6]|section|article)>", "\n", cleaned)
    cleaned = re.sub(r"(?is)<[^>]+>", " ", cleaned)
    return _normalize_space(html.unescape(cleaned))


def _normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _summary(content: str) -> str:
    if len(content) <= 700:
        return content
    return content[:697].rstrip() + "..."
