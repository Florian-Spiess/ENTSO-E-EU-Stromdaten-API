import os
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / '.env')

verify_ssl = os.getenv('GGC_API_VERIFY_SSL', 'true').strip().lower() not in {'0', 'false', 'no'}

url = 'https://api.greengridcompass.eu/v1/co2-intensity'
headers = {
    'Authorization': f"Bearer {os.getenv('GGC_API_KEY')}",
    'Content-Type': 'application/json',
}
params = {
    'zone': 'DE-LU',
    'from': '2024-06-01T00:00:00Z',
    'to': '2024-06-02T00:00:00Z',
}

print('URL:', url)
print('HEADERS:', headers)
print('PARAMS:', params)

try:
    r = requests.get(url, headers=headers, params=params, timeout=30, verify=verify_ssl)
    print('STATUS:', r.status_code)
    print('RESPONSE:', r.text[:2000])
    print('RESPONSE HEADERS:', dict(r.headers))
except Exception as exc:
    print('ERROR:', exc)
