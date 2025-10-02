import os
import json

# MSSQL 모드로 설정
os.environ['DB_TYPE'] = 'MSSQL'
os.environ['MSSQL_PASSWORD'] = 'test_password'

from backend.database import DB_TYPE, MSSQL_CONFIG

print('=== Database Configuration Test ===')
print(f'DB Type: {DB_TYPE}')
print('\nMSSQL Config:')
config_safe = {k: v if k != 'password' else '***' for k, v in MSSQL_CONFIG.items()}
print(json.dumps(config_safe, indent=2))
