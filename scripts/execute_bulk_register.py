import json
import requests

# Load payload
with open('scripts/bulk_users_payload.json', 'r', encoding='utf-8') as f:
    payload = json.load(f)

print(f"Loaded {len(payload['users'])} users from payload")

# API request (HTTP not HTTPS)
url = "http://localhost:8000/api/auth/admin/bulk-register"
headers = {
    "User-Agent": "RoutingML-Monitor/1.0",
    "Content-Type": "application/json"
}

print(f"Sending request to {url}...")
response = requests.post(url, json=payload, headers=headers)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    result = response.json()
    print(f"\nSuccess: {len(result['successes'])} users registered")
    print(f"Failures: {len(result['failures'])} users failed")
    print(f"Total: {result['total']}")
    
    if result['failures']:
        print("\nFailure Details:")
        for f in result['failures']:
            print(f"  - {f['username']}: {f.get('message', 'unknown error')}")
    
    # Show first 5 successes
    if result['successes']:
        print("\nSample Successes (first 5):")
        for s in result['successes'][:5]:
            print(f"  + {s['username']} ({s['status']})")
else:
    print(f"Error: {response.text}")
