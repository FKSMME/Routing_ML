#!/bin/bash

###############################################################################
# Access Database 백업 스크립트
# 용도: 매일 자정 Access DB를 백업하여 데이터 손실 방지
# 실행: crontab -e 추가 -> 0 0 * * * /workspaces/Routing_ML_4/scripts/backup_access_db.sh
###############################################################################

# 설정
SOURCE_DB="/mnt/data/routing_data/ROUTING AUTO TEST.accdb"
BACKUP_DIR="/mnt/backup"
RETENTION_DAYS=7
LOG_FILE="/var/log/routing-ml/backup.log"

# 날짜 형식
DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# 로그 함수
log() {
    echo "[$TIMESTAMP] $1" | tee -a "$LOG_FILE"
}

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

# 로그 파일 디렉토리 생성
mkdir -p "$(dirname "$LOG_FILE")"

log "=== Access DB 백업 시작 ==="

# 원본 파일 존재 확인
if [ ! -f "$SOURCE_DB" ]; then
    log "❌ ERROR: 원본 DB 파일을 찾을 수 없습니다: $SOURCE_DB"
    exit 1
fi

# 파일 크기 확인
FILE_SIZE=$(du -h "$SOURCE_DB" | cut -f1)
log "원본 DB 크기: $FILE_SIZE"

# 백업 파일명
BACKUP_FILE="$BACKUP_DIR/routing_db_$DATE.accdb"

# 백업 수행
log "백업 중: $SOURCE_DB -> $BACKUP_FILE"
cp "$SOURCE_DB" "$BACKUP_FILE"

# 백업 성공 여부 확인
if [ $? -eq 0 ]; then
    log "✅ 백업 성공: $BACKUP_FILE"

    # 백업 파일 크기 확인
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "백업 파일 크기: $BACKUP_SIZE"
else
    log "❌ ERROR: 백업 실패"
    exit 1
fi

# 오래된 백업 삭제 (7일 이전)
log "오래된 백업 파일 정리 중 (${RETENTION_DAYS}일 이상)..."
find "$BACKUP_DIR" -name "routing_db_*.accdb" -type f -mtime +$RETENTION_DAYS -delete

# 남은 백업 파일 목록
REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "routing_db_*.accdb" -type f | wc -l)
log "현재 보관 중인 백업 파일 수: $REMAINING_BACKUPS"

# 디스크 사용량 확인
DISK_USAGE=$(df -h "$BACKUP_DIR" | tail -1 | awk '{print $5}')
log "백업 디렉토리 디스크 사용량: $DISK_USAGE"

# 디스크 사용량 경고 (80% 이상)
if [ "${DISK_USAGE%\%}" -ge 80 ]; then
    log "⚠️  WARNING: 디스크 사용량이 80%를 초과했습니다!"
fi

log "=== Access DB 백업 완료 ==="
echo ""
