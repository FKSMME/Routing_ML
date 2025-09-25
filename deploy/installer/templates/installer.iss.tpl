; Routing ML Windows Installer Template
; 생성 시 build_windows_installer.py 에서 버전/경로를 치환한다.

#define AppVersion "{APP_VERSION}"
#define PayloadDir "{PAYLOAD_DIR}"
#define OutputDir "{OUTPUT_DIR}"

[Setup]
AppId={{A56C1D69-92A8-4BE1-8F1A-35F5D977D32C}
AppName=Routing ML Predictor
AppVersion={#AppVersion}
AppPublisher=FKSM Manufacturing Intelligence
AppPublisherURL=https://intra.fksm.local/routing-ml
AppSupportURL=https://intra.fksm.local/routing-ml/docs
DefaultDirName={autopf}\FKSM\RoutingML
DefaultGroupName=Routing ML
OutputDir={#OutputDir}
OutputBaseFilename=RoutingMLInstaller_{#AppVersion}
SetupLogging=yes
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
WizardStyle=modern
UninstallDisplayIcon={app}\frontend\favicon.ico
LicenseFile={#PayloadDir}\licenses\NOTICE.txt
ChangesEnvironment=yes
CloseApplications=force
RestartApplications=no

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
Source: "{#PayloadDir}\backend\RoutingMLBackend.exe"; DestDir: "{app}\backend"; Flags: ignoreversion
Source: "{#PayloadDir}\frontend\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\config\*"; DestDir: "{app}\config"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\models\*"; DestDir: "{app}\models"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\docs\*"; DestDir: "{app}\docs"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\licenses\*"; DestDir: "{app}\licenses"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Routing ML\Routing ML Workbench"; Filename: "{app}\frontend\index.html"; WorkingDir: "{app}\frontend"
Name: "{autoprograms}\Routing ML\Start Predictor Service"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File \"{app}\\scripts\\install_service.ps1\" -ExecutablePath \"{app}\\backend\\RoutingMLBackend.exe\" -ServiceName \"RoutingMLPredictor\" -DisplayName \"Routing ML Predictor\" -Port 8000"; Flags: runhidden
Name: "{autodesktop}\Routing ML Workbench"; Filename: "{app}\frontend\index.html"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "바탕화면에 바로가기 생성"; GroupDescription: "추가 작업"; Flags: unchecked

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File \"{app}\\scripts\\install_service.ps1\" -ExecutablePath \"{app}\\backend\\RoutingMLBackend.exe\" -ServiceName \"RoutingMLPredictor\" -DisplayName \"Routing ML Predictor\" -Port 8000"; StatusMsg: "예측 서비스를 Windows 서비스로 등록 중"; Flags: runhidden
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File \"{app}\\scripts\\post_install_test.ps1\" -ServiceName \"RoutingMLPredictor\" -Port 8000"; StatusMsg: "설치 후 진단을 실행 중"; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File \"{app}\\scripts\\install_service.ps1\" -ServiceName \"RoutingMLPredictor\" -RemoveOnly"; RunOnceId: "RemoveRoutingMLService"; Flags: runhidden

[Code]
procedure InitializeWizard;
begin
  WizardForm.WelcomeLabel1.Caption := 'Routing ML 설치 마법사';
  WizardForm.WelcomeLabel2.Caption := '사내망 Windows 환경에서 Routing ML 예측 서비스를 설치합니다.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    MsgBox('설치가 완료되었습니다. 서비스 로그는 %APPDATA%\\RoutingML\\logs 에 저장됩니다.', mbInformation, MB_OK);
  end;
end;
