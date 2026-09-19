import json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

URL = "https://etender.gov.az/main/competitions?tabEventType=2"
OUT = Path("data/tender-results.json")
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; EnerviaTenderSync/1.0; +https://www.enervia.az/)"}

def clean(v):
    return re.sub(r"\s+", " ", v or "").strip()

def amount(v):
    v = clean(v)
    return v

def parse():
    r = requests.get(URL, headers=HEADERS, timeout=40)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    rows = []
    for tr in soup.select("tr"):
        cells = [clean(x.get_text(" ", strip=True)) for x in tr.find_all(["td","th"])]
        if len(cells) < 5:
            continue
        joined = " | ".join(cells)
        if "ENERVIA" not in joined.upper():
            continue
        # Expected visible columns: #, buyer, procurement subject, winner, price, date, ...
        winner_i = next((i for i,x in enumerate(cells) if "ENERVIA" in x.upper()), None)
        if winner_i is None:
            continue
        buyer = cells[1] if len(cells) > 1 else ""
        subject = cells[2] if len(cells) > 2 else ""
        price = cells[winner_i + 1] if winner_i + 1 < len(cells) else ""
        date = cells[winner_i + 2] if winner_i + 2 < len(cells) else ""
        rows.append({
            "buyer": buyer,
            "subject": subject,
            "winner": "ENERVIA",
            "amount": amount(price),
            "date": date,
            "source": "eTender",
            "sourceUrl": URL
        })
    # Deduplicate
    unique = {}
    for x in rows:
        key = "|".join([x["buyer"], x["subject"], x["winner"], x["amount"], x["date"]])
        unique[key] = x
    return list(unique.values())

def main():
    rows = parse()
    if not rows:
        raise RuntimeError("No ENERVIA winning rows found. Refusing to overwrite existing data.")
    rows.sort(key=lambda x: x.get("date",""), reverse=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Synced {len(rows)} ENERVIA tender results.")

if __name__ == "__main__":
    main()
