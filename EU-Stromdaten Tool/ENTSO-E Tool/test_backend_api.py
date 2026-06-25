import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from backend_api import app
from fastapi.testclient import TestClient

os.environ['BACKEND_API_KEY'] = 'test-secret'
client = TestClient(app)

paths = ['/', '/health', '/ggc/metrics', '/ggc/co2_intensity', '/entsoe/generation', '/unified']
results = {}
for path in paths:
    no_key = client.get(path)
    with_key = client.get(path, headers={'x-api-key': 'test-secret'})
    results[path] = {
        'no_key_status': no_key.status_code,
        'with_key_status': with_key.status_code,
        'with_key_body': with_key.text[:200],
    }

for path, result in results.items():
    print(path)
    print('  no_key_status:', result['no_key_status'])
    print('  with_key_status:', result['with_key_status'])
    print('  with_key_body:', result['with_key_body'])
    print()
