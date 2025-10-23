import requests

# Test login with syyun / ksm@1234
url = "http://localhost:8000/api/auth/login"
payload = {
    "username": "syyun",
    "password": "ksm@1234"
}

print(f"Testing login: {payload['username']} / {payload['password']}")
response = requests.post(url, json=payload)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    result = response.json()
    print(f"✅ Login successful!")
    print(f"   Username: {result['username']}")
    print(f"   Display Name: {result.get('display_name', 'N/A')}")
    print(f"   Is Admin: {result.get('is_admin', False)}")
    print(f"   Token: {result['token'][:50]}...")
else:
    print(f"❌ Login failed!")
    print(f"   Error: {response.text}")

# Test a few more users
test_users = ["sjlee", "hmkim", "sangmkim"]
print(f"\nTesting additional users...")
for username in test_users:
    payload = {"username": username, "password": "ksm@1234"}
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        print(f"  ✅ {username} - Login OK")
    else:
        print(f"  ❌ {username} - Login FAILED")
