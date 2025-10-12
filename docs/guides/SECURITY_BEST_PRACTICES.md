# Security Best Practices

## Overview

This document outlines security best practices for the Routing ML system, covering authentication, authorization, data protection, and vulnerability prevention.

## Authentication & Authorization

### 1. JWT Token Security

**Best Practices**:
- ✅ Use strong secret keys (minimum 32 characters)
- ✅ Rotate JWT secrets every 90 days
- ✅ Set appropriate token expiration (1 hour recommended)
- ✅ Use HTTPS only in production (`JWT_COOKIE_SECURE=true`)
- ✅ Implement token refresh mechanism
- ❌ Never expose JWT secrets in logs or error messages
- ❌ Never store JWT secrets in Git

**Configuration**:
```bash
# Production .env
JWT_SECRET_KEY=<44-character-random-string>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_TTL_SECONDS=3600
JWT_COOKIE_SECURE=true
```

**Generate Secure Key**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2. Password Security

**Requirements**:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

**Implementation**:
```python
# backend/api/services/auth_service.py
import re
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def validate_password(password: str) -> bool:
    """Validate password strength."""
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"[0-9]", password):
        return False
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False
    return True

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pwd_context.verify(plain_password, hashed_password)
```

### 3. Role-Based Access Control (RBAC)

**Roles**:
| Role | Permissions |
|------|-------------|
| `admin` | Full system access, user management, audit logs |
| `auditor` | Read-only audit logs, quality reports |
| `security_admin` | Security settings, JWT rotation, access controls |
| `operator` | Create/update routing groups, predictions |
| `viewer` | Read-only access to routing data |

**Implementation**:
```python
from backend.api.middleware.audit_access_control import require_audit_access

@router.get("/audit/logs")
@require_audit_access  # Only admin/auditor/security_admin
async def get_audit_logs(request: Request):
    return {"logs": [...]}
```

## Data Protection

### 1. Sensitive Data Handling

**Never Log**:
- ❌ Passwords (plain or hashed)
- ❌ JWT tokens
- ❌ API keys
- ❌ Database credentials
- ❌ Personal Identifiable Information (PII) without consent

**Always Encrypt**:
- ✅ Passwords (bcrypt, argon2)
- ✅ Sensitive database fields (AES-256)
- ✅ Backups
- ✅ Data in transit (HTTPS/TLS)

**Example - Field Encryption**:
```python
from cryptography.fernet import Fernet

# Generate key (store securely)
key = Fernet.generate_key()
cipher = Fernet(key)

def encrypt_field(value: str) -> bytes:
    """Encrypt sensitive field."""
    return cipher.encrypt(value.encode())

def decrypt_field(encrypted: bytes) -> str:
    """Decrypt sensitive field."""
    return cipher.decrypt(encrypted).decode()
```

### 2. SQL Injection Prevention

**Use Parameterized Queries**:

✅ **Good** (SQLAlchemy ORM):
```python
# Parameterized query
items = session.query(Item).filter(Item.item_code == user_input).all()
```

❌ **Bad** (String formatting):
```python
# SQL injection vulnerable!
query = f"SELECT * FROM items WHERE item_code = '{user_input}'"
items = session.execute(query)
```

✅ **Good** (Raw SQL with parameters):
```python
from sqlalchemy import text

query = text("SELECT * FROM items WHERE item_code = :code")
items = session.execute(query, {"code": user_input})
```

### 3. Cross-Site Scripting (XSS) Prevention

**Backend**:
```python
from fastapi import FastAPI
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app = FastAPI()

# Only allow trusted hosts
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["routing-ml.ksm.co.kr", "*.ksm.co.kr"]
)
```

**Frontend**:
```typescript
// Use React's built-in XSS protection
function ItemDisplay({ itemName }: { itemName: string }) {
  // Automatically escaped by React
  return <div>{itemName}</div>;
}

// For HTML content, sanitize first
import DOMPurify from 'dompurify';

function HtmlContent({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

## Network Security

### 1. HTTPS/TLS Configuration

**Nginx SSL Configuration**:
```nginx
server {
    listen 443 ssl http2;
    server_name routing-ml.ksm.co.kr;

    # SSL certificates
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # Strong SSL protocols
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Other security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. CORS Configuration

**Production Settings**:
```python
# backend/api/app.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://routing-ml.ksm.co.kr",
        "https://prediction.ksm.co.kr",
        "https://training.ksm.co.kr"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=3600,
)
```

❌ **Never in Production**:
```python
allow_origins=["*"]  # Allows any origin - DANGEROUS!
```

### 3. Rate Limiting

**Implementation**:
```python
# pip install slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/auth/login")
@limiter.limit("5/minute")  # Max 5 login attempts per minute
async def login(request: Request, credentials: LoginRequest):
    return auth_service.login(credentials)
```

## Input Validation

### 1. Request Validation

**Use Pydantic Models**:
```python
from pydantic import BaseModel, Field, validator

class ItemCreateRequest(BaseModel):
    item_code: str = Field(..., min_length=1, max_length=50, regex="^[A-Z0-9-]+$")
    item_name: str = Field(..., min_length=1, max_length=200)
    material_code: str | None = Field(None, max_length=50)

    @validator("item_code")
    def validate_item_code(cls, v):
        """Additional validation for item code."""
        if not v.startswith("ITEM-"):
            raise ValueError("Item code must start with 'ITEM-'")
        return v
```

### 2. File Upload Security

**Validate File Types**:
```python
from fastapi import UploadFile, HTTPException
import magic

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".parquet"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

async def validate_upload(file: UploadFile):
    """Validate uploaded file."""
    # Check extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Invalid file type. Allowed: {ALLOWED_EXTENSIONS}")

    # Check file size
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(400, f"File too large. Max: {MAX_FILE_SIZE/1024/1024} MB")

    # Check MIME type (prevents extension spoofing)
    mime = magic.from_buffer(await file.read(1024), mime=True)
    file.file.seek(0)

    allowed_mimes = {"text/csv", "application/vnd.ms-excel"}
    if mime not in allowed_mimes:
        raise HTTPException(400, f"Invalid file content type: {mime}")
```

## Audit Logging

### 1. Log Security Events

**Events to Log**:
- ✅ Login attempts (success/failure)
- ✅ Password changes
- ✅ Permission changes
- ✅ Data exports
- ✅ Configuration changes
- ✅ Failed authentication
- ✅ Suspicious activity

**Implementation**:
```python
from common.logger import audit_routing_event

# Log login attempt
audit_routing_event(
    action="auth.login",
    result="success" if authenticated else "failure",
    username=username,
    client_host=request.client.host,
    payload={"method": "password", "mfa_enabled": False}
)

# Log data export
audit_routing_event(
    action="data.export",
    result="success",
    username=current_user.username,
    payload={"export_type": "csv", "row_count": 1000}
)
```

### 2. Audit Log Retention

**Policy**:
- Security events: 1 year
- User activity: 90 days
- System logs: 30 days

**Implementation**:
```bash
# Automated cleanup script
find logs/audit/ -name "*.log" -mtime +365 -delete
```

## Dependency Security

### 1. Keep Dependencies Updated

```bash
# Check for vulnerabilities
pip install safety
safety check --json

# Update dependencies
pip list --outdated
pip install --upgrade <package>
```

### 2. Pin Dependency Versions

**requirements.txt**:
```
fastapi==0.103.2
pydantic==1.10.14
sqlalchemy==2.0.23
# Use specific versions, not >=
```

### 3. Scan for Vulnerabilities

**GitHub Dependabot**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
```

## Docker Security

### 1. Use Non-Root User

**Dockerfile.backend**:
```dockerfile
# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser
```

### 2. Scan Images

```bash
# Scan with Trivy
docker run aquasec/trivy image routing-ml-backend:latest

# Scan with Docker Scout
docker scout cves routing-ml-backend:latest
```

### 3. Minimal Base Images

```dockerfile
# Use slim/alpine images
FROM python:3.11-slim  # 150MB instead of 1GB
```

## Secrets Management

### 1. Never Commit Secrets

**.gitignore**:
```
.env
.env.*
!.env.example
*.pem
*.key
credentials.json
```

### 2. Use Secret Management Tools

**AWS Secrets Manager**:
```python
import boto3

client = boto3.client('secretsmanager')
secret = client.get_secret_value(SecretId='routing-ml/jwt-secret')
JWT_SECRET_KEY = secret['SecretString']
```

**HashiCorp Vault**:
```python
import hvac

client = hvac.Client(url='https://vault.ksm.co.kr', token='<token>')
secret = client.secrets.kv.v2.read_secret_version(path='routing-ml/jwt')
JWT_SECRET_KEY = secret['data']['data']['secret_key']
```

### 3. Environment Variable Security

```bash
# Production: Don't use .env files
# Use container secrets instead

# Docker secrets
docker secret create jwt_secret jwt_secret.txt
docker service create --secret jwt_secret routing-ml-backend

# Kubernetes secrets
kubectl create secret generic jwt-secret --from-literal=key=<secret>
```

## Security Checklist

### Deployment Checklist

- [ ] HTTPS enabled (TLS 1.2+)
- [ ] JWT secret rotated and >32 characters
- [ ] CORS configured (no wildcard origins)
- [ ] Rate limiting enabled
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (input sanitization)
- [ ] File upload validation
- [ ] Audit logging enabled
- [ ] Dependencies scanned for vulnerabilities
- [ ] Docker images scanned
- [ ] Non-root user in containers
- [ ] Secrets not in Git
- [ ] Security headers configured
- [ ] Database backups encrypted
- [ ] Log retention policy enforced

### Code Review Checklist

- [ ] No hardcoded secrets
- [ ] No SQL string formatting
- [ ] Input validation present
- [ ] Authentication required for protected routes
- [ ] Authorization checks present
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't include PII/passwords
- [ ] File uploads validated
- [ ] Rate limiting on sensitive endpoints

## Incident Response

### 1. Security Incident Procedure

1. **Detect**: Monitor logs, alerts
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove threat, patch vulnerability
4. **Recover**: Restore from clean backup
5. **Learn**: Post-mortem, update procedures

### 2. Emergency Contacts

- Security Team: security@ksm.co.kr
- On-Call DevOps: +82-10-XXXX-XXXX
- Management: CTO@ksm.co.kr

### 3. Breach Notification

If data breach detected:
1. Notify security team immediately
2. Document evidence (logs, screenshots)
3. Isolate affected systems
4. Notify affected users within 72 hours (GDPR)
5. File incident report

## Compliance

### GDPR (EU)

- User consent for data processing
- Right to access personal data
- Right to deletion ("right to be forgotten")
- Data breach notification (72 hours)
- Data Protection Officer (DPO) appointed

### PCI-DSS (Payment Cards)

- Encrypt cardholder data
- Maintain secure network
- Regular security testing
- Access control measures

### SOC 2 (Trust Services)

- Security controls documented
- Audit logging enabled
- Incident response plan
- Annual security review

## Additional Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **CWE Top 25**: https://cwe.mitre.org/top25/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **Python Security Best Practices**: https://python.readthedocs.io/en/stable/library/security_warnings.html

## Support

For security issues:
- **DO NOT** open public GitHub issues
- Email: security@ksm.co.kr
- PGP Key: https://ksm.co.kr/security.asc
