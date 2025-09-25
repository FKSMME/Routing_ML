param(
    [string]$ServiceName = "RoutingMLPredictor",
    [int]$Port = 8000,
    [int]$TimeoutSeconds = 180,
    [string]$LogName = "post_install_test.log"
)

$logRoot = Join-Path $env:APPDATA "RoutingML\\logs"
if (!(Test-Path $logRoot)) {
    New-Item -ItemType Directory -Path $logRoot | Out-Null
}
$logFile = Join-Path $logRoot $LogName

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $entry = "[{0}][{1}] {2}" -f ((Get-Date).ToString("s")), $Level, $Message
    $entry | Out-File -FilePath $logFile -Encoding UTF8 -Append
    Write-Host $entry
}

function Wait-Service {
    param([string]$Name, [int]$Timeout)
    $deadline = (Get-Date).AddSeconds($Timeout)
    while ((Get-Date) -lt $deadline) {
        $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq 'Running') {
            return $true
        }
        Start-Sleep -Seconds 3
    }
    return $false
}

try {
    Write-Log "서비스 상태 확인: $ServiceName"
    if (-not (Wait-Service -Name $ServiceName -Timeout $TimeoutSeconds)) {
        throw "서비스가 제한 시간 내에 시작되지 않았습니다."
    }

    $healthUrl = "http://localhost:$Port/api/health"
    Write-Log "헬스 체크 요청: $healthUrl"
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 30
    if ($response.StatusCode -ne 200) {
        throw "헬스 체크 실패: 상태 코드 $($response.StatusCode)"
    }

    Write-Log "헬스 체크 성공"

    $configPath = Join-Path $env:APPDATA "RoutingML\\config\\workflow_settings.json"
    if (Test-Path $configPath) {
        Write-Log "설정 파일 확인: $configPath"
    } else {
        Write-Log "설정 파일이 존재하지 않습니다. 템플릿을 복사하거나 UI에서 SAVE 하세요." "WARN"
    }

    Write-Log "TensorBoard Projector 디렉터리 확인"
    $projectorDir = Join-Path $env:APPDATA "RoutingML\\models\\tb_projector"
    if (Test-Path $projectorDir) {
        $files = Get-ChildItem $projectorDir -Filter "*.tsv" -ErrorAction SilentlyContinue
        if ($files) {
            Write-Log "Projector 파일 수: $($files.Count)"
        } else {
            Write-Log "Projector 파일이 없습니다. 학습을 먼저 실행하세요." "WARN"
        }
    } else {
        Write-Log "Projector 디렉터리가 없습니다." "WARN"
    }

    Write-Log "설치 후 진단 완료"
} catch {
    Write-Log $_.Exception.Message "ERROR"
    exit 1
}
