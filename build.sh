#!/usr/bin/env bash
# Vercel Linux Build Script for PromptPDF
# Handles pre-deployment compilation, PyMuPDF dependency verification, and Vite static build

set -e

echo "=================================================="
echo "    PromptPDF Production Build Pipeline"
echo "=================================================="

# Ensure pip is up to date and binary wheels can be installed
echo "[1/3] Checking Python environment..."
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

$PYTHON_CMD --version

# Verify PyMuPDF and Pillow wheel compatibility
echo "[2/3] Validating Python dependencies..."
$PYTHON_CMD -m pip install --upgrade pip setuptools wheel
$PYTHON_CMD -m pip install -r api/requirements.txt

# Build the React frontend
echo "[3/3] Building Vite React frontend..."
npm ci --prefer-offline --no-audit || npm install
npm run build

echo "=================================================="
echo "   Build completed successfully -> dist ready!"
echo "=================================================="
