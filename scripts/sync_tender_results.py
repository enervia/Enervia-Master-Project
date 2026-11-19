import json
import re
import sys
import time
from pathlib import Path
from datetime import datetime
from urllib.parse import quote

import requests

API_URLS = [
    "https://etender.gov.az/api/events",
    "https://www.etender.gov.az/api/events",
]
SOURCE_URL = "https://etender.gov.az/main/competitions"
OUT = Path("data/tender-results.json")
EVENT_TYPES = (2, 4)
PAGE_SIZE = 100
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://etender.gov.az/main/competitions/2/2",
    "Origin": "https://etender.gov.az",
}
ALIASES = {
    "buyer": ["buyerOrganizationName", "buyerName", "organizationName", "procuringEntityName", "buyer", "customerName"],
    "subject": ["eventName", "eventTitle", "procurementSubject", "procurementName", "subject", "title", "name"],
    "winner": ["awardedParticipantName", "winnerName", "winner", "awardedParticipant"],
    "amount": ["awardedPrice", "awardAmount", "contractAmount", "awardedAmount", "totalAmount", "price", "value", "suggestedPrice"],
    "date": ["awardDate", "awardedDate", "resultDate", "publishDate", "eventDate", "date"],
}


def clean(value):
    if value is None or isinstance(value, (dict, list)):
        return ""
    return re.sub(r"\\s+", " ", str(value)).strip()


def norm_key(key):
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


def walk_dicts(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def pick(obj, aliases):
    wanted = {norm_key(x) for x in aliases}
    for item in walk_dicts(obj):
        for key, value in item.items():
            if norm_key(key) in wanted:
                text = clean(value)
                if text:
                    return text
    return ""


def request_page(session, event_type, page):
    params = {
        "EventType": event_type,
        "PageSize": PAGE_SIZE,
        "PageNumber": page,
        "EventStatus": 1,
        "Keyword": "",
        "buyerOrganizationName": "",
        "PrivateRfxId": "",
        "publishDateFrom": "",
        "publishDateTo": "",
        "AwardedparticipantName": "",
        "AwardedparticipantVoen": "",
        "DocumentViewType": "",
    }
    errors = []
    for api_url in API_URLS:
        for attempt in range(3):
            try:
                print(f"[INFO] Requesting {api_url} EventType={event_type} page={page}, attempt={attempt + 1}/3", flush=True)
                response = session.get(api_url, params=params, timeout=(25, 90))
                response.raise_for_status()
                payload = response.json()
                if not isinstance(payload, dict) or not isinstance(payload.get("items"), list):
                    raise ValueError("Unexpected eTender API response structure")
                return payload
            except Exception as exc:
                errors.append(f"{api_url}: {exc}")
                print(f"[WARN] Request failed: {exc}", flush=True)
                if attempt < 2:
                    time.sleep(3 * (attempt + 1))
    raise RuntimeError(
        f"eTender API failed for EventType={event_type}, page={page}: " + " | ".join(errors)
    )


def parse():
    session = requests.Session()
    session.headers.update(HEADERS)
    found = {}
    scanned = 0

    for event_type in EVENT_TYPES:
        first = request_page(session, event_type, 1)
        total_pages = max(1, int(first.get("totalPages") or 1))
        print(
            f"[INFO] EventType={event_type}: {first.get('totalItems', '?')} records, {total_pages} pages",
            flush=True,
        )

        for page in range(1, total_pages + 1):
            data = first if page == 1 else request_page(session, event_type, page)
            items = data.get("items", [])
            scanned += len(items)

            for item in items:
                raw = json.dumps(item, ensure_ascii=False).upper()
                winner = pick(item, ALIASES["winner"])
                if "ENERVIA" not in raw and "ENERVIA" not in winner.upper():
                    continue

                buyer = pick(item, ALIASES["buyer"])
                subject = pick(item, ALIASES["subject"])
                if not buyer or not subject:
                    print(
                        f"[WARN] Enervia record missing buyer/subject; eventId={item.get('eventId')}",
                        flush=True,
                    )
                    continue

                event_id = clean(item.get("eventId") or item.get("id"))
                detail_url = (
                    f"https://etender.gov.az/main/competition/detail/{quote(event_id)}"
                    if event_id else SOURCE_URL
                )
                row = {
                    "eventId": event_id,
                    "buyer": buyer,
                    "subject": subject,
                    "winner": winner or "ENERVIA",
                    "amount": pick(item, ALIASES["amount"]),
                    "date": pick(item, ALIASES["date"]),
                    "source": "eTender",
                    "sourceUrl": detail_url,
                }
                key = event_id or "|".join([buyer, subject, row["date"]]).lower()
                found[key] = row

            print(
                f"[INFO] EventType={event_type}: page {page}/{total_pages}, "
                f"items={len(items)}, Enervia awards={len(found)}",
                flush=True,
            )
            time.sleep(0.15)

    print(
        f"[INFO] Scanned {scanned} event records; found {len(found)} Enervia award records.",
        flush=True,
    )
    return list(found.values())


def load_existing():
    if not OUT.exists():
        return []
    data = json.loads(OUT.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Existing tender-results.json is not a list")
    return data


def date_key(row):
    raw = clean(row.get("date"))
    for fmt in ("%d.%m.%Y %H:%M", "%d.%m.%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y%m%d%H%M%S")
        except ValueError:
            pass
    return "00000000000000"


def main():
    existing = load_existing()
    print(f"[INFO] Existing published tender records: {len(existing)}", flush=True)
    fresh = parse()

    merged = {}
    for row in existing + fresh:
        event_id = clean(row.get("eventId"))
        key = event_id or "|".join([
            clean(row.get("buyer")),
            clean(row.get("subject")),
            clean(row.get("winner")),
            clean(row.get("date")),
        ]).lower()
        previous = merged.get(key, {})
        merged[key] = {
            **previous,
            **{k: clean(v) for k, v in row.items() if v is not None},
            "winner": clean(row.get("winner")) or clean(previous.get("winner")) or "ENERVIA",
            "source": clean(row.get("source")) or "eTender",
            "sourceUrl": clean(row.get("sourceUrl")) or clean(previous.get("sourceUrl")) or SOURCE_URL,
        }

    rows = sorted(merged.values(), key=date_key, reverse=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    print(
        f"[OK] Added/updated {len(fresh)} Enervia records. Total published records: {len(rows)}.",
        flush=True,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ERROR] Tender synchronization failed: {exc}", file=sys.stderr, flush=True)
        raise
