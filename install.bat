@echo off
REM Lock-file installer (Windows): installs exactly what pnpm-lock.yaml pins.
REM   install.bat           strict
REM   install.bat relock    refresh pnpm-lock.yaml
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22+ is required: https://nodejs.org & exit /b 1)
if not exist pnpm-lock.yaml (echo pnpm-lock.yaml not found & exit /b 1)
where pnpm >nul 2>nul || (call corepack enable & call corepack prepare --activate)
where pnpm >nul 2>nul || (echo Could not set up pnpm. Try: npm install -g pnpm & exit /b 1)
if /i "%1"=="relock" (
  call pnpm install --no-frozen-lockfile
) else (
  call pnpm install --frozen-lockfile
  if errorlevel 1 (echo Lock file does not match package.json. Run: install.bat relock & exit /b 1)
)
echo Done.
