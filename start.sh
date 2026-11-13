#!/bin/bash
set -e

echo "=============================================="
echo " Starting EcoRide Share (BLR Airport Utility) "
echo "=============================================="

# 1. Python Virtual Environment Setup
if [ ! -d "venv" ]; then
    echo "[1/3] Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "[2/3] Activating virtual environment & checking dependencies..."
source venv/bin/activate
pip install -q -r requirements.txt

# 2. Node Dependencies Setup
if [ ! -d "node_modules" ]; then
    echo "[3/3] Installing Node.js frontend dependencies..."
    npm install
fi

echo ""
echo "=========================================================="
echo " Servers starting..."
echo " Frontend App:  http://localhost:5173"
echo " Backend API:   http://localhost:8000 (Docs: /docs)"
echo "=========================================================="
echo "Press Ctrl+C to stop both servers at any time."
echo ""

npm run dev

