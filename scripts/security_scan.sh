#!/bin/bash
# Docker Security Scanning with Trivy
# Weekly automated security scan for container images
# Critical vulnerabilities must be 0

set -euo pipefail

# Configuration
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_REPORT_DIR="${REPO_ROOT}/security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${SCAN_REPORT_DIR}/trivy_scan_${TIMESTAMP}.json"
HTML_REPORT="${SCAN_REPORT_DIR}/trivy_scan_${TIMESTAMP}.html"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

# Create report directory
mkdir -p "$SCAN_REPORT_DIR"

log "=========================================="
log "Docker Security Scan (Trivy)"
log "=========================================="

# Check if Trivy is installed
if ! command -v trivy &> /dev/null; then
    warn "Trivy not found. Installing..."

    # Install Trivy (Linux)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
        echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee -a /etc/apt/sources.list.d/trivy.list
        sudo apt-get update
        sudo apt-get install -y trivy
    else
        error "Please install Trivy manually: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
        exit 1
    fi
fi

# Update Trivy vulnerability database
log "Step 1: Updating Trivy database..."
trivy image --download-db-only 2>&1 || true

# Find all Dockerfiles
log "Step 2: Scanning Docker images..."

DOCKERFILES=(
    "${REPO_ROOT}/Dockerfile"
    "${REPO_ROOT}/docker/Dockerfile.backend"
    "${REPO_ROOT}/docker/Dockerfile.frontend"
)

SCAN_RESULTS=()
CRITICAL_COUNT=0
HIGH_COUNT=0
MEDIUM_COUNT=0
LOW_COUNT=0

# Scan each Dockerfile/image
for dockerfile in "${DOCKERFILES[@]}"; do
    if [[ ! -f "$dockerfile" ]]; then
        warn "Dockerfile not found: $dockerfile (skipping)"
        continue
    fi

    log "  - Scanning: $(basename $dockerfile)"

    # Build temp image name
    IMAGE_NAME="routing-ml-scan:$(basename $dockerfile .Dockerfile)"

    # Build image (if Dockerfile exists)
    if docker build -f "$dockerfile" -t "$IMAGE_NAME" "$REPO_ROOT" &> /dev/null; then
        # Scan image
        SCAN_OUTPUT=$(trivy image \
            --severity CRITICAL,HIGH,MEDIUM,LOW \
            --format json \
            --quiet \
            "$IMAGE_NAME" 2>&1 || echo '{"Results":[]}')

        # Parse results
        CRIT=$(echo "$SCAN_OUTPUT" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' 2>/dev/null || echo 0)
        HIGH=$(echo "$SCAN_OUTPUT" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="HIGH")] | length' 2>/dev/null || echo 0)
        MED=$(echo "$SCAN_OUTPUT" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="MEDIUM")] | length' 2>/dev/null || echo 0)
        LOW=$(echo "$SCAN_OUTPUT" | jq '[.Results[]?.Vulnerabilities[]? | select(.Severity=="LOW")] | length' 2>/dev/null || echo 0)

        CRITICAL_COUNT=$((CRITICAL_COUNT + CRIT))
        HIGH_COUNT=$((HIGH_COUNT + HIGH))
        MEDIUM_COUNT=$((MEDIUM_COUNT + MED))
        LOW_COUNT=$((LOW_COUNT + LOW))

        SCAN_RESULTS+=("$(basename $dockerfile): CRITICAL=$CRIT, HIGH=$HIGH, MEDIUM=$MED, LOW=$LOW")

        # Save detailed report
        echo "$SCAN_OUTPUT" >> "$REPORT_FILE"

        # Remove temp image
        docker rmi "$IMAGE_NAME" &> /dev/null || true
    else
        warn "Failed to build image from $dockerfile"
    fi
done

# Generate summary
log "=========================================="
log "Scan Summary"
log "=========================================="
info "Total Vulnerabilities:"
info "  🔴 CRITICAL: $CRITICAL_COUNT"
info "  🟠 HIGH: $HIGH_COUNT"
info "  🟡 MEDIUM: $MEDIUM_COUNT"
info "  🟢 LOW: $LOW_COUNT"
log ""

for result in "${SCAN_RESULTS[@]}"; do
    info "  $result"
done

# Check if critical vulnerabilities exist
EXIT_CODE=0
if [[ $CRITICAL_COUNT -gt 0 ]]; then
    error "❌ CRITICAL vulnerabilities found: $CRITICAL_COUNT"
    error "Please fix critical vulnerabilities immediately!"
    EXIT_CODE=1
else
    log "✅ No CRITICAL vulnerabilities found"
fi

# Generate HTML report (if vulnerabilities exist)
if [[ $((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT)) -gt 0 ]]; then
    log "Step 3: Generating HTML report..."

    cat > "$HTML_REPORT" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Security Scan Report - ${TIMESTAMP}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .summary { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .critical { color: #dc2626; font-weight: bold; }
        .high { color: #ea580c; font-weight: bold; }
        .medium { color: #ca8a04; font-weight: bold; }
        .low { color: #65a30d; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f9fafb; font-weight: 600; }
    </style>
</head>
<body>
    <h1>🔒 Security Scan Report</h1>
    <p>Generated: ${TIMESTAMP}</p>

    <div class="summary">
        <h2>Summary</h2>
        <table>
            <tr>
                <th>Severity</th>
                <th>Count</th>
            </tr>
            <tr>
                <td class="critical">🔴 CRITICAL</td>
                <td class="critical">${CRITICAL_COUNT}</td>
            </tr>
            <tr>
                <td class="high">🟠 HIGH</td>
                <td class="high">${HIGH_COUNT}</td>
            </tr>
            <tr>
                <td class="medium">🟡 MEDIUM</td>
                <td class="medium">${MEDIUM_COUNT}</td>
            </tr>
            <tr>
                <td class="low">🟢 LOW</td>
                <td class="low">${LOW_COUNT}</td>
            </tr>
        </table>
    </div>

    <div class="summary">
        <h2>Detailed Results</h2>
        <p>See JSON report: <code>${REPORT_FILE}</code></p>
    </div>
</body>
</html>
EOF

    log "HTML report saved: $HTML_REPORT"
fi

# Send Slack notification (if configured)
if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
    log "Step 4: Sending Slack notification..."

    STATUS_EMOJI="✅"
    STATUS_TEXT="Security Scan Passed"
    COLOR="good"

    if [[ $CRITICAL_COUNT -gt 0 ]]; then
        STATUS_EMOJI="🚨"
        STATUS_TEXT="CRITICAL Vulnerabilities Found"
        COLOR="danger"
    elif [[ $HIGH_COUNT -gt 0 ]]; then
        STATUS_EMOJI="⚠️"
        STATUS_TEXT="HIGH Vulnerabilities Found"
        COLOR="warning"
    fi

    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{
            \"attachments\": [{
                \"color\": \"$COLOR\",
                \"title\": \"$STATUS_EMOJI $STATUS_TEXT\",
                \"fields\": [
                    {\"title\": \"CRITICAL\", \"value\": \"$CRITICAL_COUNT\", \"short\": true},
                    {\"title\": \"HIGH\", \"value\": \"$HIGH_COUNT\", \"short\": true},
                    {\"title\": \"MEDIUM\", \"value\": \"$MEDIUM_COUNT\", \"short\": true},
                    {\"title\": \"LOW\", \"value\": \"$LOW_COUNT\", \"short\": true}
                ],
                \"footer\": \"Security Scan - ${TIMESTAMP}\"
            }]
        }" 2>/dev/null || warn "Failed to send Slack notification"
fi

log "=========================================="
log "Scan complete!"
log "  - JSON Report: $REPORT_FILE"
log "  - HTML Report: $HTML_REPORT"
log "=========================================="

exit $EXIT_CODE
