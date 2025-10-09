# Docker Deployment Guide

## Overview

This guide explains how to deploy the Routing ML system using Docker and Docker Compose. The containerized deployment provides:

- **Isolation**: Consistent environment across development/staging/production
- **Portability**: Run anywhere Docker is available (Linux, Windows, macOS, cloud)
- **Scalability**: Easy horizontal scaling with orchestrators (Kubernetes, Docker Swarm)
- **Reproducibility**: Identical builds from Dockerfiles

## Architecture

The Routing ML system consists of 3 containerized services:

```
┌─────────────────────────────────────────────────────────┐
│                   Docker Network                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Backend    │  │  Frontend    │  │  Frontend    │  │
│  │  (FastAPI)  │  │  Prediction  │  │  Training    │  │
│  │  Port 8000  │  │  Port 5173   │  │  Port 5174   │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│         │                │                  │           │
│         └────────────────┴──────────────────┘           │
└─────────────────────────────────────────────────────────┘
         │
    ┌────┴─────┐
    │  Volumes │
    ├──────────┤
    │  models/ │  (shared ML models)
    │  logs/   │  (application logs)
    │  data/   │  (SQLite databases)
    └──────────┘
```

## Quick Start

### Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/FKSMME/Routing_ML.git
cd Routing_ML

# Create .env file from template
cp .env.example .env

# Generate secure JWT secret
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(32))" >> .env

# Edit .env with your database credentials
nano .env
```

### 2. Build and Start Services

```bash
# Build all images (first time)
docker compose build

# Start all services in detached mode
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps
```

### 3. Verify Deployment

```bash
# Backend health check
curl http://localhost:8000/api/health

# Expected output:
# {"status":"healthy","version":"4.0.0"}

# Frontend (Prediction)
open http://localhost:5173

# Frontend (Training)
open http://localhost:5174
```

## Service Configuration

### Backend Service

**Image**: `routing-ml-backend`
**Port**: `8000`
**Environment Variables**:

```yaml
environment:
  # Security
  - JWT_SECRET_KEY=${JWT_SECRET_KEY}
  - LOG_LEVEL=INFO

  # Database (SQLite for local, MSSQL for production)
  - DB_TYPE=SQLITE
  - RSL_DATABASE_URL=sqlite:///./data/rsl.db
  - ROUTING_GROUPS_DATABASE_URL=sqlite:///./data/routing_groups.db

  # MSSQL Production (uncomment when needed)
  # - DB_TYPE=MSSQL
  # - MSSQL_SERVER=your-server.example.com,1433
  # - MSSQL_DATABASE=RoutingML
  # - MSSQL_USER=routing_ml_app
  # - MSSQL_PASSWORD=${MSSQL_PASSWORD}
  # - MSSQL_ENCRYPT=False
  # - MSSQL_TRUST_CERTIFICATE=True
```

**Volumes**:
- `./models:/app/models` - ML model artifacts
- `./logs:/app/logs` - Application logs
- `./data/db:/app/data/db` - SQLite databases

### Frontend Services

**Prediction Frontend**:
- **Image**: `routing-ml-frontend-prediction`
- **Port**: `5173` (mapped to internal `80`)
- **Build Args**: `VITE_API_URL=http://localhost:8000`

**Training Frontend**:
- **Image**: `routing-ml-frontend-training`
- **Port**: `5174` (mapped to internal `80`)
- **Build Args**: `VITE_API_URL=http://localhost:8000`

## Production Deployment

### 1. Security Hardening

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      # Use secrets manager
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}  # From AWS Secrets Manager
      - MSSQL_PASSWORD=${MSSQL_PASSWORD}  # From Azure Key Vault

      # Production settings
      - LOG_LEVEL=WARNING
      - JWT_COOKIE_SECURE=true
      - ALLOWED_ORIGINS=https://routing-ml.ksm.co.kr

    # Production restart policy
    restart: always

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### 2. MSSQL Production Configuration

```bash
# .env.production
DB_TYPE=MSSQL
MSSQL_SERVER=production-db.ksm.co.kr,1433
MSSQL_DATABASE=RoutingML_Prod
MSSQL_USER=routing_ml_app
MSSQL_PASSWORD=<use-secrets-manager>
MSSQL_ENCRYPT=True
MSSQL_TRUST_CERTIFICATE=False
```

### 3. SSL/TLS with Nginx Reverse Proxy

```yaml
# docker-compose.prod.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend-prediction
      - frontend-training
    networks:
      - routing-ml-network
    restart: always
```

**nginx.conf**:
```nginx
upstream backend {
    server backend:8000;
}

server {
    listen 443 ssl http2;
    server_name api.routing-ml.ksm.co.kr;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Health Checks and Monitoring

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  frontend-prediction:
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

## Common Operations

### Build Specific Service

```bash
# Rebuild backend only
docker compose build backend

# Rebuild without cache
docker compose build --no-cache backend
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Last 100 lines
docker compose logs --tail=100 backend
```

### Scale Services

```bash
# Scale backend to 3 instances (requires load balancer)
docker compose up -d --scale backend=3
```

### Update Running Services

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime with rolling update)
docker compose up -d --build --force-recreate
```

### Database Migrations

```bash
# Run migrations in backend container
docker compose exec backend python -m alembic upgrade head

# Seed test data
docker compose exec backend python scripts/seed_test_data.py
```

### Backup Data

```bash
# Backup SQLite databases
docker compose exec backend tar -czf /app/backup.tar.gz /app/data/

# Copy backup to host
docker cp routing-ml-backend:/app/backup.tar.gz ./backups/

# Backup with timestamp
timestamp=$(date +%Y%m%d_%H%M%S)
docker cp routing-ml-backend:/app/data/rsl.db ./backups/rsl_${timestamp}.db
```

### Restore Data

```bash
# Copy backup to container
docker cp ./backups/rsl_20250109.db routing-ml-backend:/app/data/rsl.db

# Restart backend
docker compose restart backend
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs backend

# Inspect container
docker compose ps
docker inspect routing-ml-backend

# Check port conflicts
netstat -tuln | grep 8000
```

### Out of Memory

```bash
# Check resource usage
docker stats

# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory: 8GB
```

### Database Connection Errors

```bash
# Test MSSQL connection from backend container
docker compose exec backend python -c "
import pyodbc
conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=your-server,1433;DATABASE=RoutingML;UID=user;PWD=pass')
print('✅ Connected')
"

# Check environment variables
docker compose exec backend env | grep MSSQL
```

### Build Failures

```bash
# Clean build cache
docker system prune -a

# Rebuild from scratch
docker compose build --no-cache

# Check Dockerfile syntax
docker build -f Dockerfile.backend .
```

### Network Issues

```bash
# Inspect network
docker network inspect routing_ml_routing-ml-network

# Test inter-service communication
docker compose exec frontend-prediction curl http://backend:8000/api/health
```

## Performance Optimization

### 1. Multi-Stage Builds

Already implemented in Dockerfiles to minimize image size:

```dockerfile
# Build stage (not in final image)
FROM python:3.11 as builder
RUN pip install ...

# Production stage
FROM python:3.11-slim
COPY --from=builder ...
```

### 2. Layer Caching

Order Dockerfile commands to maximize cache hits:

```dockerfile
# ✅ Good (dependencies cached)
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ ./backend/

# ❌ Bad (cache invalidated frequently)
COPY . .
RUN pip install -r requirements.txt
```

### 3. Image Size Reduction

```bash
# Check image size
docker images | grep routing-ml

# Expected sizes:
# routing-ml-backend:          ~800MB
# routing-ml-frontend:         ~150MB
```

Optimization tips:
- Use `.dockerignore` to exclude unnecessary files
- Use `python:3.11-slim` instead of `python:3.11` (saves 400MB)
- Clean up apt cache: `rm -rf /var/lib/apt/lists/*`
- Use multi-stage builds

### 4. Volume Performance

```yaml
volumes:
  # ✅ Named volume (better performance)
  - models:/app/models

  # ⚠️  Bind mount (slower on Mac/Windows)
  - ./models:/app/models
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build images
        run: docker compose build

      - name: Run tests
        run: docker compose run backend pytest

      - name: Push to registry
        run: |
          docker tag routing-ml-backend:latest ghcr.io/fksmme/routing-ml-backend:${{ github.sha }}
          docker push ghcr.io/fksmme/routing-ml-backend:${{ github.sha }}

      - name: Deploy to production
        run: |
          ssh deploy@production.ksm.co.kr \
            "cd /opt/routing-ml && docker compose pull && docker compose up -d"
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy

build:
  stage: build
  script:
    - docker compose build
    - docker compose push

test:
  stage: test
  script:
    - docker compose run backend pytest

deploy:
  stage: deploy
  script:
    - docker compose pull
    - docker compose up -d
  only:
    - main
```

## Cloud Deployment

### AWS ECS (Elastic Container Service)

```bash
# Install AWS CLI and ecs-cli
pip install awscli
curl -Lo /usr/local/bin/ecs-cli https://amazon-ecs-cli.s3.amazonaws.com/ecs-cli-linux-amd64-latest

# Create ECS cluster
ecs-cli up --cluster routing-ml-cluster --region ap-northeast-2

# Deploy services
ecs-cli compose --file docker-compose.yml service up
```

### Azure Container Instances

```bash
# Login to Azure
az login

# Create resource group
az group create --name routing-ml-rg --location koreacentral

# Deploy containers
az container create \
  --resource-group routing-ml-rg \
  --name routing-ml \
  --image ghcr.io/fksmme/routing-ml-backend:latest \
  --ports 8000 \
  --environment-variables JWT_SECRET_KEY=$JWT_SECRET_KEY
```

### Google Cloud Run

```bash
# Build and push image
gcloud builds submit --tag gcr.io/project-id/routing-ml-backend

# Deploy to Cloud Run
gcloud run deploy routing-ml-backend \
  --image gcr.io/project-id/routing-ml-backend \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated
```

## Additional Resources

- **Docker Documentation**: https://docs.docker.com/
- **Docker Compose Reference**: https://docs.docker.com/compose/compose-file/
- **Best Practices**: https://docs.docker.com/develop/dev-best-practices/
- **Security**: https://docs.docker.com/engine/security/

## Support

For deployment issues:
- Review [DIAGNOSIS_AND_IMPROVEMENT_PLAN.md](../DIAGNOSIS_AND_IMPROVEMENT_PLAN.md)
- Check Docker logs: `docker compose logs -f`
- Open GitHub issue with `[Docker]` tag
- Contact DevOps team: devops@ksm.co.kr
