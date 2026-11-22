@echo off
cd /d "%~dp0"
py -3 --version >nul 2>nul
if %errorlevel%==0 (py -3 server.py 8710 & goto end)
python --version >nul 2>nul
if %errorlevel%==0 (python server.py 8710 & goto end)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
:end
pause
