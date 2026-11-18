@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Iniciar-RapidOCR.ps1"
if errorlevel 1 pause
