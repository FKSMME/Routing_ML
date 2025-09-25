param(
    [string]$DriverName = "Microsoft Access Driver (*.mdb, *.accdb)",
    [string]$LogName = "verify_odbc.log"
)

$logRoot = Join-Path $env:APPDATA "RoutingML\\logs"
if (!(Test-Path $logRoot)) {
    New-Item -ItemType Directory -Path $logRoot | Out-Null
}
$logFile = Join-Path $logRoot $LogName

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

try {
    Write-Log "ODBC 드라이버 확인 중: $DriverName"
    $driver = Get-OdbcDriver -Name $DriverName -ErrorAction SilentlyContinue
    if (-not $driver) {
        throw "Access ODBC 드라이버를 찾을 수 없습니다. 제어판 > 관리 도구 > ODBC 데이터 원본에서 설치 여부를 확인하세요."
    }

    $bitness = if ($driver.Platform -eq "32-bit") { "x86" } else { "x64" }
    Write-Log "드라이버 확인 완료 - 버전: $($driver.Version), 플랫폼: $bitness"

    $registryPath = "HKLM:SOFTWARE\ODBC\ODBCINST.INI\${DriverName}"
    if (Test-Path $registryPath) {
        $installDir = (Get-ItemProperty -Path $registryPath -Name "Driver").Driver
        Write-Log "드라이버 경로: $installDir"
    }

    Write-Log "ODBC 드라이버 검증 성공"
} catch {
    Write-Log $_.Exception.Message "ERROR"
    exit 1
}
