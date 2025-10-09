# JWT Secret Key Rotation Procedure

## Overview

This document describes the secure procedure for rotating the JWT secret key in the Routing ML system. JWT rotation is a critical security practice that should be performed regularly to minimize the impact of potential key compromise.

## Why Rotate JWT Secrets?

**Security Benefits**:
- **Limit breach exposure**: If a key is compromised, rotation limits the time window attackers can use it
- **Compliance requirements**: Many security standards (PCI-DSS, SOC 2) require periodic key rotation
- **Reduce attack surface**: Old sessions are invalidated, forcing re-authentication
- **Best practice**: Following NIST and OWASP guidelines

**Recommended Rotation Schedule**:
- **Production**: Every 90 days
- **Staging**: Every 30 days
- **Development**: On demand (after team member departure, security incident)

## Prerequisites

Before rotating JWT secrets, ensure:

- [ ] Database backup completed
- [ ] Maintenance window scheduled (15-30 minutes)
- [ ] All team members notified
- [ ] Rollback plan tested
- [ ] New secret key generated securely
- [ ] Access to production environment

## Rotation Strategies

### Strategy 1: Zero-Downtime Rotation (Recommended)

Supports both old and new keys during transition period.

**Duration**: 2-3 hours (includes session timeout)
**Downtime**: None
**User Impact**: None (transparent)

**Steps**:

1. **Generate New Secret**
   ```bash
   # Generate cryptographically secure key (44+ characters)
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   # Example output: Xy7zQ2vR8pN4mK9jL6hF3dS1aW0eT5uY7iO8pA2sD4fG6hJ9kL1mN3qR5tV7wX9
   ```

2. **Add New Secret to Environment**
   ```bash
   # .env.production
   JWT_SECRET_KEY=<new-secret-key>
   JWT_SECRET_KEY_OLD=<old-secret-key>  # Keep old key temporarily
   ```

3. **Update Backend Code** (if not already implemented)
   ```python
   # backend/api/services/auth_service.py
   from backend.api.config import get_settings

   settings = get_settings()

   def verify_token(token: str) -> dict:
       """Verify JWT token with fallback to old secret."""
       try:
           # Try new secret first
           payload = jwt.decode(
               token,
               settings.jwt_secret_key,
               algorithms=[settings.jwt_algorithm]
           )
           return payload
       except jwt.InvalidSignatureError:
           # Fallback to old secret during rotation
           if hasattr(settings, 'jwt_secret_key_old') and settings.jwt_secret_key_old:
               try:
                   payload = jwt.decode(
                       token,
                       settings.jwt_secret_key_old,
                       algorithms=[settings.jwt_algorithm]
                   )
                   # Token is valid but uses old key - consider re-issuing
                   return payload
               except jwt.InvalidSignatureError:
                   raise
           raise
   ```

4. **Deploy Updated Configuration**
   ```bash
   # Docker Compose
   docker compose down
   docker compose up -d

   # Kubernetes
   kubectl set env deployment/routing-ml-backend \
     JWT_SECRET_KEY=<new-secret> \
     JWT_SECRET_KEY_OLD=<old-secret>
   kubectl rollout restart deployment/routing-ml-backend
   ```

5. **Wait for Session Timeout**
   ```bash
   # Default: 3600 seconds (1 hour)
   # Wait for JWT_ACCESS_TOKEN_TTL_SECONDS to elapse
   echo "Waiting for old sessions to expire..."
   sleep 3600
   ```

6. **Remove Old Secret**
   ```bash
   # After all old tokens expired
   # .env.production
   JWT_SECRET_KEY=<new-secret-key>
   # JWT_SECRET_KEY_OLD=<removed>
   ```

7. **Redeploy**
   ```bash
   docker compose up -d
   # or
   kubectl rollout restart deployment/routing-ml-backend
   ```

8. **Verify**
   ```bash
   # Test login endpoint
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'

   # Verify token works
   TOKEN="<received-token>"
   curl http://localhost:8000/api/health \
     -H "Authorization: Bearer $TOKEN"
   ```

### Strategy 2: Immediate Rotation (Fast but disruptive)

Replace secret immediately, forcing all users to re-authenticate.

**Duration**: 5 minutes
**Downtime**: None (but all sessions invalidated)
**User Impact**: All users must log in again

**Steps**:

1. **Generate New Secret**
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

2. **Backup Current Configuration**
   ```bash
   cp .env.production .env.production.backup.$(date +%Y%m%d_%H%M%S)
   ```

3. **Update Environment Variable**
   ```bash
   # .env.production
   JWT_SECRET_KEY=<new-secret-key>
   ```

4. **Restart Services**
   ```bash
   docker compose restart backend
   ```

5. **Notify Users**
   ```
   Subject: System Maintenance - Re-authentication Required

   The Routing ML system has completed a scheduled security update.
   Please log in again to continue using the system.

   Your data and work are safe.
   ```

6. **Verify**
   ```bash
   # Old tokens should fail
   curl http://localhost:8000/api/health \
     -H "Authorization: Bearer <old-token>"
   # Expected: 401 Unauthorized

   # New login should work
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   # Expected: 200 OK with new token
   ```

### Strategy 3: Blue-Green Deployment

Run two environments in parallel, switch traffic after rotation.

**Duration**: 1 hour
**Downtime**: None
**User Impact**: None

**Steps**:

1. **Prepare Green Environment**
   ```bash
   # Clone production environment
   docker compose -f docker-compose.green.yml up -d

   # Update green environment with new secret
   docker compose -f docker-compose.green.yml \
     exec backend sh -c 'export JWT_SECRET_KEY=<new-secret>'
   ```

2. **Test Green Environment**
   ```bash
   # Test all endpoints on green
   curl http://green.routing-ml.internal:8000/api/health
   ```

3. **Switch Load Balancer**
   ```nginx
   # nginx.conf
   upstream backend {
       server green.routing-ml.internal:8000;  # Switch to green
       # server blue.routing-ml.internal:8000;  # Old blue
   }
   ```

4. **Reload Nginx**
   ```bash
   nginx -s reload
   ```

5. **Monitor Green Environment**
   ```bash
   # Watch logs for errors
   docker compose -f docker-compose.green.yml logs -f backend
   ```

6. **Decommission Blue Environment**
   ```bash
   # After 24 hours of stable green operation
   docker compose -f docker-compose.blue.yml down
   ```

## Configuration Management

### Environment Variables

```bash
# .env.production
JWT_SECRET_KEY=<current-secret-44-chars-minimum>
JWT_SECRET_KEY_OLD=<previous-secret-during-rotation>  # Optional
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_TTL_SECONDS=3600
JWT_COOKIE_SECURE=true  # HTTPS only in production
```

### AWS Secrets Manager (Recommended)

```bash
# Store secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name routing-ml/jwt-secret \
  --secret-string "$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"

# Retrieve secret in application
aws secretsmanager get-secret-value \
  --secret-id routing-ml/jwt-secret \
  --query SecretString \
  --output text
```

**Update backend to use AWS Secrets Manager**:
```python
# backend/api/config.py
import boto3
import os

def get_jwt_secret() -> str:
    """Get JWT secret from AWS Secrets Manager in production."""
    if os.getenv("ENV") == "production":
        client = boto3.client("secretsmanager", region_name="us-east-1")
        response = client.get_secret_value(SecretId="routing-ml/jwt-secret")
        return response["SecretString"]
    else:
        return os.getenv("JWT_SECRET_KEY", "INSECURE-CHANGE-ME")
```

### Azure Key Vault

```bash
# Store secret in Azure Key Vault
az keyvault secret set \
  --vault-name routing-ml-vault \
  --name jwt-secret-key \
  --value "$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"

# Retrieve secret in application
az keyvault secret show \
  --vault-name routing-ml-vault \
  --name jwt-secret-key \
  --query value \
  --output tsv
```

## Automated Rotation Script

```bash
#!/bin/bash
# scripts/rotate_jwt_secret.sh

set -e

echo "=== JWT Secret Rotation Script ==="
echo "Environment: ${ENV:-production}"
echo "Strategy: Zero-downtime rotation"
echo ""

# Step 1: Generate new secret
NEW_SECRET=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
echo "✅ Generated new secret (${#NEW_SECRET} characters)"

# Step 2: Get current secret
CURRENT_SECRET=$(grep JWT_SECRET_KEY .env.production | cut -d= -f2)
echo "✅ Retrieved current secret"

# Step 3: Backup configuration
BACKUP_FILE=".env.production.backup.$(date +%Y%m%d_%H%M%S)"
cp .env.production "$BACKUP_FILE"
echo "✅ Backed up configuration to $BACKUP_FILE"

# Step 4: Update configuration (both secrets)
sed -i.tmp "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$NEW_SECRET/" .env.production
echo "JWT_SECRET_KEY_OLD=$CURRENT_SECRET" >> .env.production
rm .env.production.tmp
echo "✅ Updated .env.production with new and old secrets"

# Step 5: Restart backend
docker compose restart backend
echo "✅ Restarted backend service"

# Step 6: Wait for session timeout
TTL=${JWT_ACCESS_TOKEN_TTL_SECONDS:-3600}
echo "⏳ Waiting $TTL seconds for old sessions to expire..."
sleep "$TTL"

# Step 7: Remove old secret
sed -i.tmp '/JWT_SECRET_KEY_OLD/d' .env.production
rm .env.production.tmp
echo "✅ Removed old secret from configuration"

# Step 8: Final restart
docker compose restart backend
echo "✅ Final restart completed"

echo ""
echo "🎉 JWT secret rotation completed successfully!"
echo "New secret: ${NEW_SECRET:0:10}...${NEW_SECRET: -10}"
echo "Backup saved: $BACKUP_FILE"
```

**Usage**:
```bash
chmod +x scripts/rotate_jwt_secret.sh
./scripts/rotate_jwt_secret.sh
```

## Rotation Checklist

### Pre-Rotation

- [ ] Generate new secret key (minimum 32 characters)
- [ ] Backup current `.env.production`
- [ ] Schedule maintenance window (if using immediate rotation)
- [ ] Notify users (if using immediate rotation)
- [ ] Test rotation procedure in staging environment
- [ ] Document current secret in secure vault (1Password, LastPass)

### During Rotation

- [ ] Update environment variables with new secret
- [ ] Keep old secret (if zero-downtime rotation)
- [ ] Restart backend services
- [ ] Verify new logins work
- [ ] Monitor error logs for authentication failures
- [ ] Check health endpoint responds correctly

### Post-Rotation

- [ ] Wait for session timeout (if zero-downtime rotation)
- [ ] Remove old secret from configuration
- [ ] Final restart of services
- [ ] Test authentication end-to-end
- [ ] Update documentation with rotation date
- [ ] Archive old secret securely
- [ ] Schedule next rotation (90 days)

## Rollback Procedure

If rotation causes issues:

1. **Immediate Rollback**
   ```bash
   # Restore backup
   cp .env.production.backup.<timestamp> .env.production

   # Restart services
   docker compose restart backend

   # Verify
   curl http://localhost:8000/api/health
   ```

2. **Investigate Issue**
   ```bash
   # Check logs
   docker compose logs backend | grep -i "jwt\|auth\|token"

   # Test authentication
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   ```

3. **Fix and Retry**
   - Identify root cause
   - Fix configuration
   - Test in staging
   - Retry rotation

## Monitoring After Rotation

### Key Metrics to Watch

```bash
# Authentication failure rate
grep "401 Unauthorized" logs/routing_ml_*.log | wc -l

# New token issuance rate
grep "token issued" logs/routing_ml_*.log | wc -l

# Average session duration
# Should reset to 0 after rotation
```

### Grafana Dashboard Queries

```promql
# Failed authentication attempts (should spike temporarily)
rate(http_requests_total{endpoint="/api/auth/login",status="401"}[5m])

# Active sessions (should drop to 0 then rebuild)
routing_ml_active_sessions

# Token validation errors
rate(routing_ml_jwt_validation_errors_total[5m])
```

## Security Best Practices

1. **Never commit secrets to Git**
   - Use `.env` files (in `.gitignore`)
   - Use secret management tools (AWS, Azure, HashiCorp Vault)

2. **Use strong secrets**
   - Minimum 32 characters
   - Use `secrets.token_urlsafe()` (not `random`)
   - Avoid dictionary words

3. **Rotate regularly**
   - Production: Every 90 days
   - After suspected compromise: Immediately
   - After team member departure: Within 24 hours

4. **Limit secret access**
   - Only DevOps team should access production secrets
   - Use role-based access control (RBAC)
   - Audit secret access logs

5. **Store secrets securely**
   - Encrypted at rest
   - Encrypted in transit
   - Access logged and monitored

## Compliance Requirements

### PCI-DSS

- Rotate secrets every 90 days
- Document rotation procedure
- Maintain audit trail

### SOC 2

- Implement automated rotation
- Monitor and alert on failed rotations
- Quarterly security reviews

### GDPR

- Ensure user data protected during rotation
- Minimize downtime
- Document data protection measures

## Troubleshooting

### Issue: Users locked out after rotation

**Symptom**: All users receive 401 Unauthorized

**Solution**:
1. Check `JWT_SECRET_KEY` is set correctly
2. Verify backend restarted with new secret
3. Check for typos in `.env` file
4. Rollback if issue persists

### Issue: Some users work, others don't

**Symptom**: Intermittent authentication failures

**Cause**: Load balancer sending requests to old instances

**Solution**:
1. Check all backend instances updated
2. Restart all instances
3. Clear load balancer connection pool

### Issue: Old tokens still work

**Symptom**: Tokens signed with old secret still validate

**Cause**: `JWT_SECRET_KEY_OLD` still in configuration

**Solution**:
1. Remove `JWT_SECRET_KEY_OLD` from `.env`
2. Restart backend

## Additional Resources

- **JWT Best Practices**: https://tools.ietf.org/html/rfc8725
- **OWASP JWT Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
- **Python secrets module**: https://docs.python.org/3/library/secrets.html

## Support

For JWT rotation issues:
- Review [DIAGNOSIS_AND_IMPROVEMENT_PLAN.md](../DIAGNOSIS_AND_IMPROVEMENT_PLAN.md)
- Check authentication logs: `logs/routing_ml_*.log`
- Open GitHub issue with `[Security]` tag
- Contact security team: security@ksm.co.kr
