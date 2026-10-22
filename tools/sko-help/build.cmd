@echo off
rem Builds SkoHelp.exe with the C# compiler that ships with Windows (.NET Framework 4.x).
rem No Visual Studio or SDK needed. Run from this folder:  build.cmd

setlocal
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo csc.exe not found. .NET Framework 4.x is required.
  exit /b 1
)

"%CSC%" /nologo /target:winexe /codepage:65001 /optimize+ /out:"%~dp0SkoHelp.exe" ^
  /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll ^
  /r:System.Management.dll /r:System.Web.Extensions.dll ^
  "%~dp0SkoHelp.cs"
if errorlevel 1 exit /b 1
echo Built %~dp0SkoHelp.exe
