; Balakar one-click installer (NSIS 3). Build:  makensis -DVERSION=1.0.0 installer/balakar.nsi
; Per-user install, no admin prompt. Silent mode for CI/IT:
;   Balakar-Setup.exe /S /MODEL=small /GPU=0 /NLLB=0 [/D=C:\path]   (D= must be last)
Unicode true
!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define APP "Balakar"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\Balakar"
!define RUNKEY "Software\Microsoft\Windows\CurrentVersion\Run"

!include MUI2.nsh
!include nsDialogs.nsh
!include LogicLib.nsh
!include FileFunc.nsh

Name "${APP} ${VERSION}"
OutFile "..\dist\Balakar-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Balakar"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
BrandingText "Balakar - open source, runs on your PC"
VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Balakar"
VIAddVersionKey "FileDescription" "Balakar installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "MIT License"

Var hBase
Var hSmall
Var hMedium
Var hTurbo
Var hGpu
Var hNllb
Var Model
Var Gpu
Var Nllb

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Install Balakar"
!define MUI_WELCOMEPAGE_TEXT "Balakar adds captions to After Effects in 20 South Asian and Middle Eastern languages.$\r$\n$\r$\nEverything runs on this PC. No account, no API key, nothing is uploaded.$\r$\n$\r$\nSetup downloads Python, the AI libraries, ffmpeg and a speech model once (needs internet and a few GB of disk space)."
!define MUI_FINISHPAGE_TITLE "Balakar is ready"
!define MUI_FINISHPAGE_TEXT "Restart After Effects, then open Window > Extensions > Balakar.$\r$\n$\r$\nThe engine starts automatically when you sign in to Windows."

!insertmacro MUI_PAGE_WELCOME
Page custom OptionsPage OptionsLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  StrCpy $Model "small"
  StrCpy $Gpu 0
  StrCpy $Nllb 0
  nsExec::ExecToStack 'nvidia-smi -L'
  Pop $0
  Pop $1
  ${If} $0 == 0
    StrCpy $Gpu 1
  ${EndIf}
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/MODEL=" $R1
  ${IfNot} ${Errors}
    ${If} $R1 == "base"
    ${OrIf} $R1 == "small"
    ${OrIf} $R1 == "medium"
    ${OrIf} $R1 == "turbo"
      StrCpy $Model $R1
    ${EndIf}
  ${EndIf}
  ClearErrors
  ${GetOptions} $R0 "/GPU=" $R1
  ${IfNot} ${Errors}
    StrCpy $Gpu $R1
  ${EndIf}
  ClearErrors
  ${GetOptions} $R0 "/NLLB=" $R1
  ${IfNot} ${Errors}
    StrCpy $Nllb $R1
  ${EndIf}
FunctionEnd

Function OptionsPage
  !insertmacro MUI_HEADER_TEXT "Choose your speech model" "Downloaded once. After that Balakar works offline."
  nsDialogs::Create 1018
  Pop $0
  ${NSD_CreateLabel} 0 0 100% 24u "Bigger models are more accurate for Hindi, Urdu, Tamil and other languages, but need a stronger PC."
  Pop $0
  ${NSD_CreateFirstRadioButton} 0 28u 100% 12u "Base - 0.15 GB - fastest, lowest accuracy"
  Pop $hBase
  ${NSD_CreateAdditionalRadioButton} 0 42u 100% 12u "Small - 0.5 GB - good accuracy on any PC (recommended)"
  Pop $hSmall
  ${NSD_CreateAdditionalRadioButton} 0 56u 100% 12u "Medium - 1.5 GB - better accuracy, slower on CPU"
  Pop $hMedium
  ${NSD_CreateAdditionalRadioButton} 0 70u 100% 12u "Large v3 turbo - 1.6 GB - best accuracy, wants a recent GPU"
  Pop $hTurbo
  ${If} $Model == "base"
    ${NSD_Check} $hBase
  ${ElseIf} $Model == "medium"
    ${NSD_Check} $hMedium
  ${ElseIf} $Model == "turbo"
    ${NSD_Check} $hTurbo
  ${Else}
    ${NSD_Check} $hSmall
  ${EndIf}
  ${NSD_CreateCheckBox} 0 92u 100% 12u "NVIDIA GPU speed-up (adds about 2.5 GB, needs an NVIDIA graphics card)"
  Pop $hGpu
  ${If} $Gpu == 1
    ${NSD_Check} $hGpu
  ${EndIf}
  ${NSD_CreateCheckBox} 0 106u 100% 12u "Offline translation to 70+ languages (adds about 2.5 GB)"
  Pop $hNllb
  ${If} $Nllb == 1
    ${NSD_Check} $hNllb
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function OptionsLeave
  ${NSD_GetState} $hBase $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Model "base"
  ${EndIf}
  ${NSD_GetState} $hSmall $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Model "small"
  ${EndIf}
  ${NSD_GetState} $hMedium $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Model "medium"
  ${EndIf}
  ${NSD_GetState} $hTurbo $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Model "turbo"
  ${EndIf}
  ${NSD_GetState} $hGpu $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Gpu 1
  ${Else}
    StrCpy $Gpu 0
  ${EndIf}
  ${NSD_GetState} $hNllb $0
  ${If} $0 == ${BST_CHECKED}
    StrCpy $Nllb 1
  ${Else}
    StrCpy $Nllb 0
  ${EndIf}
FunctionEnd

Section "Install"
  SetOutPath "$INSTDIR"
  File "setup.ps1"
  File "balakar-engine.vbs"
  File "stop-engine.ps1"
  File "..\LICENSE"
  SetOutPath "$INSTDIR\engine"
  File /r /x __pycache__ /x "*.pyc" /x config.json "..\engine\captionkit"
  File "..\engine\requirements.txt"
  SetOutPath "$INSTDIR\extension"
  File /r /x __pycache__ "..\extension\*.*"

  ; uninstaller + shortcuts first, so a failed download can still be cleaned up
  WriteUninstaller "$INSTDIR\uninstall.exe"
  CreateDirectory "$SMPROGRAMS\Balakar"
  CreateShortcut "$SMPROGRAMS\Balakar\Start Engine.lnk" "$WINDIR\System32\wscript.exe" '"$INSTDIR\balakar-engine.vbs"'
  CreateShortcut "$SMPROGRAMS\Balakar\Stop Engine.lnk" "powershell.exe" '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\stop-engine.ps1"'
  CreateShortcut "$SMPROGRAMS\Balakar\Uninstall Balakar.lnk" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "${RUNKEY}" "Balakar" '"$WINDIR\System32\wscript.exe" "$INSTDIR\balakar-engine.vbs"'
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "Balakar"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Balakar contributors"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1

  DetailPrint "Model: $Model   GPU: $Gpu   Translation model: $Nllb"
  DetailPrint "Running setup. This downloads several GB and can take 10-30 minutes..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\setup.ps1" -InstallDir "$INSTDIR" -Model $Model -Gpu $Gpu -Translation $Nllb'
  Pop $0
  ${If} $0 != 0
    SetErrorLevel 2
    ${IfNot} ${Silent}
      MessageBox MB_ICONSTOP "Setup could not finish (check your internet connection and free disk space).$\r$\n$\r$\nLog: $INSTDIR\setup.log$\r$\nRun the installer again to retry; finished steps are skipped."
    ${EndIf}
    Abort "Setup failed - see $INSTDIR\setup.log"
  ${EndIf}
SectionEnd

Section "Uninstall"
  IfFileExists "$INSTDIR\balakar-engine.vbs" +2 0
    Abort "Refusing to delete a folder that is not a Balakar install."
  nsExec::Exec 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INSTDIR\stop-engine.ps1"'
  Pop $0
  Sleep 800
  RMDir /r "$APPDATA\Adobe\CEP\extensions\com.balakar.captions"
  RMDir /r "$SMPROGRAMS\Balakar"
  RMDir /r "$PROFILE\.captionkit"
  DeleteRegValue HKCU "${RUNKEY}" "Balakar"
  DeleteRegKey HKCU "${UNKEY}"
  RMDir /r "$INSTDIR"
SectionEnd
