; MCS Server Dashboard v5.0.0 - Inno Setup Script
; Creates Windows installer package
; Requires: Inno Setup 6.x or later

#define MyAppName "MCS Server Dashboard"
#define MyAppVersion "5.0.0"
#define MyAppPublisher "Routing ML Team"
#define MyAppURL "https://github.com/your-repo"
#define MyAppExeName "MCS_Server_Dashboard.exe"
#define MyAppDescription "Modern server monitoring dashboard for MCS"

[Setup]
; App information
AppId={{A5F8D3C2-9B1E-4A7F-8D6C-2E9F4A8B5C3D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
AppComments={#MyAppDescription}

; Default installation directory
DefaultDirName={autopf}\MCS Server Dashboard
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

; Output settings
OutputDir=dist\installer
OutputBaseFilename=MCS_Server_Dashboard_v5.0.0_Setup
SetupIconFile=

; Compression
Compression=lzma2/max
SolidCompression=yes
LZMAUseSeparateProcess=yes
LZMANumBlockThreads=4

; Visual style (modern)
WizardStyle=modern
WizardImageFile=
WizardSmallImageFile=

; Privileges
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

; Other settings
DisableWelcomePage=no
DisableDirPage=no
DisableReadyPage=no
DisableFinishedPage=no
AllowNoIcons=yes
LicenseFile=
InfoBeforeFile=
InfoAfterFile=
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName} {#MyAppVersion}

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "quicklaunchicon"; Description: "{cm:CreateQuickLaunchIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Main application files from PyInstaller COLLECT output
Source: "dist\MCS_Server_Dashboard_v5.0.0\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; Documentation
Source: "VERSION.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "DASHBOARD_V5_RELEASE_NOTES.md"; DestDir: "{app}\docs"; Flags: ignoreversion

[Icons]
; Start menu shortcuts
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Release Notes"; Filename: "{app}\docs\DASHBOARD_V5_RELEASE_NOTES.md"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; Desktop shortcut
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

; Quick launch shortcut
Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; Option to run after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up any user-created files
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\cache"

[Code]
// Custom installation logic can be added here

function InitializeSetup(): Boolean;
begin
  Result := True;
  // Add version check or other pre-install logic here
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Post-installation tasks
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := True;
  // Add pre-uninstall logic here
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    // Post-uninstallation cleanup
  end;
end;
