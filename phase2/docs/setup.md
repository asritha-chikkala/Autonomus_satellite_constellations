# SETUP & INSTALLATION GUIDE

## 1. Quick Setup
Run the automated verification and setup scripts:
```powershell
python scripts\verify_system.py
```

## 2. Dependencies
- Python 3.11+ with PyTorch, Scikit-learn, FastAPI, Uvicorn, SciPy, NumPy, Pandas, Pillow
- Node.js v18+ with Next.js 14 and Three.js
- MATLAB R2023a+ (tested on R2024b)

## 3. Launching
- Backend: `python scripts\start_backend.py` (Port 8000)
- Frontend: `cd frontend && npm run dev` (Port 3000)
- Combined: `.\scripts\run_all.ps1`
