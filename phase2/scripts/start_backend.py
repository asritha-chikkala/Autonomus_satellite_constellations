import sys
import os
from pathlib import Path
import uvicorn

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))
sys.path.append(str(BASE_DIR / "backend"))

if __name__ == "__main__":
    print("Starting Autonomous Satellite Mission Control Backend on http://localhost:8000 ...")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
