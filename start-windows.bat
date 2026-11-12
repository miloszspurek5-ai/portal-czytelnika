@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Wpisz swoj tajny klucz (ten sam w aplikacji Biblioteka LSW)
set "SYNC_KEY=lsw"
set "PORT=8787"

echo.
echo  Start portalu Biblioteki LSW...
echo  Folder: %CD%
echo  Port:   %PORT%
echo.

where node >nul 2>nul
if errorlevel 1 goto NONODE

node server.js
if errorlevel 1 (
  echo.
  echo  Serwer zakonczyl sie z bledem.
  pause
)
goto END

:NONODE
echo  ========================================
echo   Nie znaleziono polecenia "node" w PATH.
echo  ========================================
echo.
echo  Aplikacja Biblioteka LSW ma wlasny Node w srodku,
echo  ale portal potrzebuje OSOBNO zainstalowanego Node.js.
echo.
echo  1. Wejdz na https://nodejs.org
echo  2. Pobierz wersje LTS (Windows Installer .msi)
echo  3. Zainstaluj z domyslnymi opcjami
echo  4. ZAMKNIJ to okno CMD i otworz NOWE
echo  5. Uruchom ten plik ponownie: start-windows.bat
echo.
echo  Sprawdzenie po instalacji - w NOWYM CMD wpisz:
echo    node -v
echo  Powinno pokazac np. v22.x.x
echo.
pause
goto END

:END
