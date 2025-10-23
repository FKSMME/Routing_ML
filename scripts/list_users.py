import requests

# Get user list
url = "http://localhost:8000/api/auth/admin/users"
headers = {"User-Agent": "RoutingML-Monitor/1.0"}

print(f"Fetching users from {url}...")
response = requests.get(url, headers=headers, params={"limit": 100})

if response.status_code == 200:
    result = response.json()
    users = result['users']
    print(f"\nTotal users: {len(users)}")
    
    # Check for email-based accounts
    email_accounts = [u for u in users if '@' in u['username']]
    id_accounts = [u for u in users if '@' not in u['username']]
    
    print(f"Email-based accounts: {len(email_accounts)}")
    print(f"ID-based accounts: {len(id_accounts)}")
    
    if email_accounts:
        print("\nEmail-based accounts found:")
        for u in email_accounts:
            print(f"  - {u['username']} ({u['status']})")
    
    print(f"\nFirst 10 ID-based accounts:")
    for u in id_accounts[:10]:
        print(f"  - {u['username']} ({u['status']})")
else:
    print(f"Error: {response.status_code} - {response.text}")
