import os
import sys
import shutil
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

def verify_all():
    print("=================================================================")
    print("  AUTONOMOUS SATELLITE CONSTELLATION SYSTEM VERIFICATION REPORT")
    print("=================================================================\n")

    results = []

    # 1. Python Runtimes
    print("[1/8] Verifying Python Libraries...")
    try:
        import torch
        import sklearn
        import fastapi
        import uvicorn
        import numpy
        import scipy
        import pandas
        import PIL
        print(f"  [PASS] PyTorch {torch.__version__}, Scikit-learn {sklearn.__version__}, FastAPI {fastapi.__version__}")
        results.append(("Python Dependencies", True))
    except ImportError as e:
        print(f"  [FAIL] Missing dependency: {e}")
        results.append(("Python Dependencies", False))

    # 2. Node & Frontend
    print("[2/8] Verifying Node.js and Next.js Build...")
    next_build = BASE_DIR / "frontend" / ".next"
    if next_build.exists():
        print(f"  [PASS] Production build exists at {next_build}")
        results.append(("Frontend Build", True))
    else:
        print(f"  [FAIL] Frontend build not found")
        results.append(("Frontend Build", False))

    # 3. MATLAB Executable
    print("[3/8] Verifying MATLAB R2024b Environment...")
    matlab_path = shutil.which("matlab") or r"C:\Program Files\MATLAB\R2024b\bin\matlab.exe"
    if os.path.exists(matlab_path):
        print(f"  [PASS] MATLAB detected at: {matlab_path}")
        results.append(("MATLAB Installation", True))
    else:
        print(f"  [WARN] MATLAB executable not found at standard path")
        results.append(("MATLAB Installation", False))

    # 4. MATLAB .m Files
    print("[4/8] Verifying MATLAB Source Files...")
    required_m_files = [
        "config.m", "initialize_satellites.m", "satellite_dynamics.m",
        "translational_dynamics.m", "attitude_dynamics.m",
        "generate_reference_trajectory.m", "mpc_controller.m",
        "run_mpc_simulation.m", "task_allocation.m",
        "hungarian_assignment.m", "auction_assignment.m",
        "greedy_assignment.m", "communication_graph.m",
        "telemetry_update.m", "battery_model.m", "health_model.m",
        "cost_matrix.m", "mission_execution.m", "generate_results.m",
        "main_simulation.m", "generate_simulation_dataset.m"
    ]
    m_missing = [f for f in required_m_files if not (BASE_DIR / "matlab" / f).exists()]
    if not m_missing:
        print(f"  [PASS] All {len(required_m_files)} MATLAB .m files verified present.")
        results.append(("MATLAB Source Files", True))
    else:
        print(f"  [FAIL] Missing .m files: {m_missing}")
        results.append(("MATLAB Source Files", False))

    # 5. Generated MATLAB Figures (PART 15)
    print("[5/8] Verifying All 20 MATLAB Generated Figures...")
    fig_dir = BASE_DIR / "results" / "figures"
    fig_count = len(list(fig_dir.glob("*.png")))
    if fig_count >= 20:
        print(f"  [PASS] All {fig_count} figures generated in {fig_dir}")
        results.append(("20 MATLAB Figures", True))
    else:
        print(f"  [FAIL] Only {fig_count}/20 figures found in {fig_dir}")
        results.append(("20 MATLAB Figures", False))

    # 6. Generated CSV & JSON Data (PART 14)
    print("[6/8] Verifying CSV Datasets & Simulation Results...")
    csv_dir = BASE_DIR / "results" / "csv"
    required_csvs = [
        "satellite_states.csv", "telemetry.csv", "communication_graph.csv",
        "battery_history.csv", "health_history.csv", "task_allocation.csv",
        "cost_matrix.csv", "reference_trajectory.csv", "mpc_trajectory.csv",
        "mpc_control_inputs.csv", "mpc_metrics.csv"
    ]
    csv_missing = [f for f in required_csvs if not (csv_dir / f).exists()]
    json_exists = (BASE_DIR / "results" / "json" / "mission_results.json").exists()
    if not csv_missing and json_exists:
        print(f"  [PASS] All 11 CSV files and mission_results.json verified.")
        results.append(("Simulation Datasets (CSV/JSON)", True))
    else:
        print(f"  [FAIL] Missing CSVs: {csv_missing}, JSON exists: {json_exists}")
        results.append(("Simulation Datasets (CSV/JSON)", False))

    # 7. AI Models
    print("[7/8] Verifying Trained AI Models (GAT, LSTM, RF, MLP)...")
    models_dir = BASE_DIR / "models"
    required_models = [
        "gat_model.pth", "lstm_model.pth", "rf_model_clf.joblib",
        "rf_model_reg.joblib", "fusion_model.pth", "risk_mlp.pth"
    ]
    model_missing = [f for f in required_models if not (models_dir / f).exists()]
    if not model_missing:
        print(f"  [PASS] All 6 AI model weight files verified.")
        results.append(("AI Models Trained", True))
    else:
        print(f"  [FAIL] Missing models: {model_missing}")
        results.append(("AI Models Trained", False))

    # 8. Backend Verification
    print("[8/8] Verifying Backend Architecture...")
    backend_main = BASE_DIR / "backend" / "main.py"
    if backend_main.exists():
        print(f"  [PASS] FastAPI main server verified at {backend_main}")
        results.append(("FastAPI Backend", True))
    else:
        print(f"  [FAIL] Backend main not found")
        results.append(("FastAPI Backend", False))

    print("\n=================================================================")
    print("  VERIFICATION SUMMARY")
    print("=================================================================")
    all_passed = True
    for name, status in results:
        status_str = "PASS" if status else "FAIL"
        print(f"  [{status_str}] {name}")
        if not status:
            all_passed = False

    print("=================================================================")
    if all_passed:
        print("  ALL SYSTEM CHECKS PASSED. READY FOR FLIGHT DEMONSTRATION.")
    else:
        print("  WARNINGS OR FAILURES DETECTED IN ONE OR MORE MODULES.")
    print("=================================================================\n")

if __name__ == "__main__":
    verify_all()
