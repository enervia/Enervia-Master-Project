import json, re
from pathlib import Path
from urllib.parse import urljoin

import requests

API_URL = "https://etender.gov.az/api/events"
SOURCE_URL = "https://etender.gov.az/main/competitions?tabEventType=2"
OUT = Path("data/tender-results.json")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; EnerviaTenderSync/2.0; +https://www.enervia.az/)",
    "Accept": "application/json,text/plain,*/*",
}

ALIASES = {
    "buyer": [
        "buyerOrganizationName", "buyerName", "organizationName",
        "procuringEntityName", "buyer", "customerName"
    ],
    "subject": [
        "eventName", "eventTitle", "procurementSubject",
        "procurementName", "subject", "title", "name"
    ],
    "winner": [
        "awardedParticipantName", "awardedparticipantName",
        "winnerName", "winner", "awardedParticipant"
    ],
    "amount": [
        "awardedPrice", "awardAmount", "contractAmount",
        "awardedAmount", "totalAmount", "price", "value", "suggestedPrice"
    ],
    "date": [
        "awardDate", "awardedDate", "resultDate",
        "publishDate", "eventDate", "date"
    ],
}

def clean(value):
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()

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
    for d in walk_dicts(obj):
        for key, value in d.items():
            if norm_key(key) in wanted:
                v = clean(value)
                if v:
                    return v
    return ""

def find_enervia_winner(obj):
    for d in walk_dicts(obj):
        for key, value in d.items():
            nk = norm_key(key)
            if "award" in nk and "participant" in nk:
                if isinstance(value, list):
                    for item in value:
                        text = clean(item)
                        if "ENERVIA" in text.upper():
                            return "ENERVIA"
                else:
                    text = clean(value)
                    if "ENERVIA" in text.upper():
                        return "ENERVIA"
    return ""

def request_page(page):
    params = {
        "EventType": 2,
        "PageSize": 100,
        "PageNumber": page,
        "EventStatus": 1,
        "Keyword": "",
        "buyerOrganizationName": "",
        "PrivateRfxId": "",
        "publishDateFrom": "",
        "publishDateTo": "",
        "AwardedparticipantName": "ENERVIA",
        "AwardedparticipantVoen": "",
        "DocumentViewType": "",
    }
    response = requests.get(API_URL, params=params, headers=HEADERS, timeout=45)
    response.raise_for_status()
    return response.json()

def parse():
    results = []
    page = 1
    max_pages = 20

    while page <= max_pages:
        data = request_page(page)
        items = data.get("items", []) if isinstance(data, dict) else []
        if not items:
            break

        for item in items:
            winner = pick(item, ALIASES["winner"]) or find_enervia_winner(item)
            raw = json.dumps(item, ensure_ascii=False).upper()
            if "ENERVIA" not in raw and winner != "ENERVIA":
                continue

            buyer = pick(item, ALIASES["buyer"])
            subject = pick(item, ALIASES["subject"])
            amount = pick(item, ALIASES["amount"])
            date = pick(item, ALIASES["date"])

            if not buyer or not subject:
                continue

            results.append({
                "buyer": buyer,
                "subject": subject,
                "winner": "ENERVIA",
                "amount": amount,
                "date": date,
                "source": "eTender",
                "sourceUrl": SOURCE_URL,
            })

        total_pages = int(data.get("totalPages") or page)
        if page >= total_pages:
            break
        page += 1

    unique = {}
    for row in results:
        key = "|".join([
            row["buyer"], row["subject"], row["winner"],
            row["amount"], row["date"]
        ])
        unique[key] = row

    return list(unique.values())

def load_existing():
    if not OUT.exists():
        return []
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:
        return []

def main():
    existing = load_existing()

    try:
        fresh = parse()
    except Exception as exc:
        print(f"[WARN] eTender API unavailable or changed: {exc}")
        print("[WARN] Keeping existing tender-results.json unchanged.")
        return

    if not fresh:
        print("[WARN] No ENERVIA rows returned by eTender API.")
        print("[WARN] Keeping existing tender-results.json unchanged.")
        return

    merged = {}
    for row in existing + fresh:
        key = "|".join([
            clean(row.get("buyer")),
            clean(row.get("subject")),
            clean(row.get("winner")),
            clean(row.get("amount")),
            clean(row.get("date")),
        ])
        merged[key] = {
            "buyer": clean(row.get("buyer")),
            "subject": clean(row.get("subject")),
            "winner": clean(row.get("winner")) or "ENERVIA",
            "amount": clean(row.get("amount")),
            "date": clean(row.get("date")),
            "source": clean(row.get("source")) or "eTender",
            "sourceUrl": clean(row.get("sourceUrl")) or SOURCE_URL,
        }

    rows = list(merged.values())

    def date_key(row):
        raw = row.get("date", "")
        m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", raw)
        return "".join(reversed(m.groups())) if m else "00000000"

    rows.sort(key=date_key, reverse=True)
    OUT.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8"
    )
    print(f"[OK] API returned {len(fresh)} ENERVIA rows; database now contains {len(rows)} rows.")

if __name__ == "__main__":
    main()
