@echo off
echo ==============================================
echo  Starting EcoRide Share (BLR Airport Utility) 
echo ==============================================

REM 1. Python venv setup
if not exist "venv" (
    echo [1/3] Creating Python virtual environment...
    python -m venv venv
)

echo [2/3] Activating virtual environment & checking dependencies...
call venv\Scripts\activate
pip install -q -r requirements.txt

REM 2. Node modules setup
if not exist "node_modules" (
    echo [3/3] Installing Node.js frontend dependencies...
    call npm install
)

echo.
echo ==========================================================
echo  Servers starting...
echo  Frontend App:  http://localhost:5173
echo  Backend API:   http://localhost:8000 (Docs: /docs)
echo ==========================================================
echo Press Ctrl+C to stop both servers at any time.
echo.

call npm run dev

