param(
    [Parameter(ValueFromPipelineByPropertyName=$true)]
    [string]$ExecutablePath = "",
    [Parameter(ValueFromPipelineByPropertyName=$true)]
    [string]$ServiceName = "RoutingMLPredictor",
    [Parameter(ValueFromPipelineByPropertyName=$true)]
    [string]$DisplayName = "Routing ML Predictor",
    [Parameter(ValueFromPipelineByPropertyName=$true)]
    [int]$Port = 8000,
    [switch]$RemoveOnly
)

$logRoot = Join-Path $env:APPDATA "RoutingML\\logs"
if (!(Test-Path $logRoot)) {
    New-Item -ItemType Directory -Path $logRoot | Out-Null
}
$logFile = Join-Path $logRoot "install_service.log"

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = (Get-Date).ToString("s")
    $entry = "[$timestamp][$Level] $Message"
    $entry | Out-File -FilePath $logFile -Encoding UTF8 -Append
    Write-Host $entry
}

function Ensure-Admin {
    $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
        throw "이 스크립트는 관리자 권한으로 실행해야 합니다."
    }
}

try {
    Ensure-Admin

    if ($RemoveOnly) {
        Write-Log "서비스 제거 플래그 감지: $ServiceName" "WARN"
        if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
            Write-Log "기존 서비스를 중지합니다." "WARN"
            Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
            sc.exe delete $ServiceName | Out-Null
            Write-Log "서비스가 제거되었습니다." "INFO"
        } else {
            Write-Log "제거할 서비스가 존재하지 않습니다." "INFO"
        }
        return
    }

    if (-not (Test-Path $ExecutablePath)) {
        throw "실행 파일을 찾을 수 없습니다: $ExecutablePath"
    }

    $binaryPath = '"' + $ExecutablePath + '"'

    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Log "기존 서비스를 중지하고 제거합니다." "WARN"
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }

    Write-Log "Windows 서비스 등록: $ServiceName ($binaryPath)" "INFO"
    $createOutput = sc.exe create $ServiceName binPath= $binaryPath DisplayName= "$DisplayName" start= auto obj= "LocalSystem"
    if ($LASTEXITCODE -ne 0) {
        throw "sc.exe create 실패: $createOutput"
    }

    sc.exe failure $ServiceName reset= 86400 actions= restart/600 | Out-Null

    if ($Port -ne 8000) {
        Write-Log "포트 변경 감지: $Port" "INFO"
    }

    Write-Log "서비스를 시작합니다." "INFO"
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 3
    $status = (Get-Service -Name $ServiceName).Status
    Write-Log "서비스 상태: $status" "INFO"

} catch {
    Write-Log $_.Exception.Message "ERROR"
    throw
}
