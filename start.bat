@echo off
cd /d "%~dp0"
echo Starting EPaper Companion...
echo Open http://localhost:5173 in your browser
echo.
npx vite --host
pause
