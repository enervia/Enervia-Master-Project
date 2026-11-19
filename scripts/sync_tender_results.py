import json
import re
import sys
import time
from pathlib import Path
from datetime import datetime
from urllib.parse import quote
import requests

API_URLS = ["https://etender.gov.az/api/events", "https://www.etender.gov.az/api/events"]
SOURCE_URL = "https://etender.gov.az/main/competitions"
OUT = Path("data/tender-results.json")
EVENT_TYPES = (2, 4)
PAGE_SIZE = 100
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36", "Accept": "application/json, text/plain, */*", "Referer": "https://etender.gov.az/main/competitions/2/2", "Origin": "https://etender.gov.az"}
ALIASES = {
 "buyer": ["buyerOrganizationName","buyerName","organizationName","procuringEntityName","buyer","customerName"],
 "subject": ["eventName","eventTitle","procurementSubject","procurementName","subject","title","name"],
 "winner": ["awardedParticipantName","winnerName","winner","awardedParticipant"],
 "amount": ["awardedPrice","awardAmount","contractAmount","awardedAmount","totalAmount","price","value","suggestedPrice"],
 "date": ["awardDate","awardedDate","resultDate","publishDate","eventDate","date"]
}

def clean(value):
 if value is None or isinstance(value,(dict,list)): return ""
 return re.sub(r"\s+"," ",str(value)).strip()

def norm_key(key): return re.sub(r"[^a-z0-9]","",str(key).lower())

def walk_dicts(value):
 if isinstance(value,dict):
  yield value
  for child in value.values(): yield from walk_dicts(child)
 elif isinstance(value,list):
  for child in value: yield from walk_dicts(child)

def pick(obj,aliases):
 wanted={norm_key(x) for x in aliases}
 for item in walk_dicts(obj):
  for key,value in item.items():
   if norm_key(key) in wanted:
    text=clean(value)
    if text: return text
 return ""

def request_page(session,event_type,page):
 params={"EventType":event_type,"PageSize":PAGE_SIZE,"PageNumber":page,"EventStatus":1,"Keyword":"","buyerOrganizationName":"","PrivateRfxId":"","publishDateFrom":"","publishDateTo":"","AwardedparticipantName":"","AwardedparticipantVoen":"","DocumentViewType":""}
 errors=[]
 for api_url in API_URLS:
  for attempt in range(3):
   try:
    print(f"[INFO] Requesting {api_url} EventType={event_type} page={page}, attempt={attempt+1}/3")
    response=session.get(api_url,params=params,timeout=(25,90))
    response.raise_for_status()
    payload=response.json()
    if not isinstance(payload,dict) or not isinstance(payload.get("items"),list):
     raise ValueError("Unexpected eTender API response structure")
    return payload
   except Exception as exc:
    errors.append(f"{api_url}: {exc}")
    if attempt<2:
     time.sleep(3*(attempt+1))
 raise RuntimeError(f"eTender API failed for EventType={event_type}, page={page}: "+" | ".join(errors))

