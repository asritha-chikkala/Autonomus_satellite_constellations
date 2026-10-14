import os
import shutil
import subprocess
import json
import pandas as pd
from pathlib import Path
from typing import Dict, Any, Optional

class MatlabRunner:
    """
    Manages MATLAB CLI / Batch execution and telemetry data exchange.
    Detects MATLAB executable dynamically or via MATLAB_EXECUTABLE environment variable.
    """
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.matlab_dir = base_dir / "matlab"
        self.results_dir = base_dir / "results"
        self.matlab_exec = self._detect_matlab()

    def _detect_matlab(self) -> Optional[str]:
        # 1. Environment variable
        env_path = os.environ.get("MATLAB_EXECUTABLE")
        if env_path and os.path.exists(env_path):
            return env_path

        # 2. Check system PATH
        which_matlab = shutil.which("matlab")
        if which_matlab:
            return which_matlab

        # 3. Check common Windows standard directories
        candidates = [
            r"C:\Program Files\MATLAB\R2024b\bin\matlab.exe",
            r"C:\Program Files\MATLAB\R2024a\bin\matlab.exe",
            r"C:\Program Files\MATLAB\R2023b\bin\matlab.exe",
            r"C:\Program Files\MATLAB\R2023a\bin\matlab.exe",
        ]
        for path in candidates:
            if os.path.exists(path):
                return path

        return None

    def is_available(self) -> bool:
        return self.matlab_exec is not None

    def execute_simulation(self, target_lat: float = 16.50, target_lon: float = 80.60, task_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.is_available():
            return {
                "success": False,
                "error": "MATLAB executable not detected. Please verify MATLAB installation or set MATLAB_EXECUTABLE environment variable.",
                "matlab_detected": False
            }

        custom_props = ""
        if task_data:
            t_id = task_data.get("id") or task_data.get("task_id")
            if t_id:
                custom_props += f"target.id = '{t_id}'; "
            t_name = task_data.get("name") or task_data.get("task_name") or task_data.get("place_name")
            if t_name:
                clean_name = str(t_name).replace("'", " ")
                custom_props += f"target.name = '{clean_name}'; "
            if task_data.get("assigned_satellite"):
                custom_props += f"target.assigned_satellite = '{task_data['assigned_satellite']}'; "
            if task_data.get("status") or task_data.get("phase"):
                st = task_data.get("status") or task_data.get("phase")
                custom_props += f"target.status = '{st}'; "
            if "battery" in task_data:
                custom_props += f"target.battery = {task_data['battery']}; "
            if "health" in task_data:
                custom_props += f"target.health = {task_data['health']}; "
            if "is_faulty" in task_data:
                custom_props += f"target.is_faulty = {1 if task_data['is_faulty'] else 0}; "
            if task_data.get("controller_type"):
                custom_props += f"target.controller_type = '{task_data['controller_type']}'; "

        cmd_script = (
            f"addpath('{str(self.matlab_dir)}'); "
            f"target.latitude = {target_lat}; target.longitude = {target_lon}; "
            f"target.altitude = 0; target.type = 'Earth Observation'; target.priority = 'HIGH'; "
            f"target.action = 'CAPTURE IMAGE'; "
            f"{custom_props}"
            f"mission_out = mission_execution(target); "
            f"generate_results(mission_out); exit;"
        )

        try:
            print(f"[MATLAB] Executing batch via {self.matlab_exec} with props: {custom_props}...")
            result = subprocess.run(
                [self.matlab_exec, "-batch", cmd_script],
                cwd=str(self.base_dir),
                capture_output=True,
                text=True,
                timeout=180
            )
            
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
                "matlab_detected": True,
                "results": self.load_results()
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "matlab_detected": True
            }

    def load_results(self) -> Dict[str, Any]:
        json_file = self.results_dir / "json" / "mission_results.json"
        summary = {}
        if json_file.exists():
            try:
                with open(json_file, "r") as f:
                    summary = json.load(f)
            except Exception as e:
                summary = {"error": f"Failed reading json: {e}"}

        # Load metrics CSV
        metrics_csv = self.results_dir / "csv" / "mpc_metrics.csv"
        metrics = {}
        if metrics_csv.exists():
            df_m = pd.read_csv(metrics_csv)
            for _, row in df_m.iterrows():
                metrics[str(row["Metric"])] = float(row["Value"])

        return {
            "summary": summary,
            "mpc_metrics": metrics,
            "figures_available": [
                f.name for f in (self.results_dir / "figures").glob("*.png")
            ]
        }
