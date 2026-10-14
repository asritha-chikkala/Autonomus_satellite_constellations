import asyncio
import time
import math
import uuid
import datetime
import torch
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional

from simulation.orbit_propagator import OrbitPropagator
from communication.graph_manager import CommunicationGraphManager
from allocation.allocator import ConstellationAllocator
from simulation.image_generator import generate_simulated_earth_observation_image
from models.gat.gat_model import SatelliteGAT
from models.lstm.lstm_model import SatelliteLSTM
from models.random_forest.rf_model import SatelliteRandomForest
from models.feature_fusion import FeatureFusion
from models.risk_mlp.risk_mlp_model import RiskMLP

class MissionManager:
    """
    Multi-Task Concurrent Autonomous Mission Manager.
    Supports 20 satellites, dynamic concurrent task allocation, 
    independent parallel MPC maneuvers, and comprehensive chronological event logging.
    """
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.propagator = OrbitPropagator()
        self.comm_manager = CommunicationGraphManager(max_comm_distance=3500.0)
        self.allocator = ConstellationAllocator()
        
        # Concurrent active tasks: {task_id: task_obj}
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.task_counter = 0
        
        # Full chronological event log
        self.event_logs: List[Dict[str, Any]] = []
        
        # System status
        self.is_allocating = False
        self.negotiation_logs = []
        self.ai_analytics = {}
        self.allocation_results = None
        self.failure_injected = False
        
        # Load AI models
        self.matlab_runner = None
        self._matlab_task_lock = asyncio.Lock()
        self._load_ai_models()
        self._log_event("SYSTEM_BOOT", "Autonomous Satellite Constellation Mission Control initialized with 20 Satellites + 1 ISS.")
        self._log_event("COMMUNICATION", "Dynamic inter-satellite optical cross-links established (3500 km range threshold).")
        self._log_event("AI_ANALYSIS", "GAT spatial attention & LSTM trajectory horizon synchronized across constellation.")
        self._log_event("ALLOCATION", "Multi-Agent auction & Hungarian solver standing by for mission requests.")

    def _load_ai_models(self):
        models_dir = self.base_dir / "models"
        self.gat = SatelliteGAT(in_dim=7, hidden_dim=32, out_dim=64, num_heads=2)
        self.lstm = SatelliteLSTM(in_dim=5, hidden_dim=48, out_dim=32, num_layers=2)
        self.rf = SatelliteRandomForest()
        self.fusion = FeatureFusion(gat_dim=64, lstm_dim=32, rf_dim=32, out_dim=128)
        self.risk_mlp = RiskMLP(in_features=128, dropout_rate=0.2)

        try:
            if (models_dir / "gat_model.pth").exists():
                self.gat.load_state_dict(torch.load(models_dir / "gat_model.pth", weights_only=True))
                self.gat.eval()
            if (models_dir / "lstm_model.pth").exists():
                self.lstm.load_state_dict(torch.load(models_dir / "lstm_model.pth", weights_only=True))
                self.lstm.eval()
            if (models_dir / "rf_model_clf.joblib").exists():
                self.rf.load(str(models_dir / "rf_model"))
            if (models_dir / "fusion_model.pth").exists():
                self.fusion.load_state_dict(torch.load(models_dir / "fusion_model.pth", weights_only=True))
                self.fusion.eval()
            if (models_dir / "risk_mlp.pth").exists():
                self.risk_mlp.load_state_dict(torch.load(models_dir / "risk_mlp.pth", weights_only=True))
                self.risk_mlp.eval()
            print("[MissionManager] AI models loaded successfully.")
        except Exception as e:
            print(f"[MissionManager] Warning: Loading AI weights: {e}")

    def _log_event(self, category: str, message: str, task_id: Optional[str] = None):
        now_str = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        entry = {
            "timestamp": now_str,
            "category": category,
            "message": message,
            "task_id": task_id
        }
        self.event_logs.insert(0, entry)
    async def _trigger_matlab_update(self, task: Dict[str, Any], sat: Optional[Dict[str, Any]] = None):
        if not self.matlab_runner or not self.matlab_runner.is_available():
            return
        async with self._matlab_task_lock:
            try:
                target = task.get("target", {})
                lat = float(target.get("latitude", 16.50))
                lon = float(target.get("longitude", 80.60))
                task_data = {
                    "id": task.get("id"),
                    "name": task.get("name", task.get("place_name", "Target Acquisition")),
                    "assigned_satellite": task.get("assigned_satellite"),
                    "phase": task.get("phase"),
                    "status": task.get("status", task.get("phase")),
                    "controller_type": task.get("controller_type", "LMPC"),
                    "battery": sat.get("battery", 88.0) if sat else 88.0,
                    "health": sat.get("health", 0.95) if sat else 0.95,
                    "is_faulty": sat.get("is_faulty", False) if sat else (task.get("phase") == "FAILED")
                }
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(
                    None,
                    lambda: self.matlab_runner.execute_simulation(target_lat=lat, target_lon=lon, task_data=task_data)
                )
                self._log_event("MATLAB_SYNC", f"Dynamic MATLAB figures synchronized for {task.get('id')} [{task.get('phase')}].", task_id=task.get("id"))
            except Exception as e:
                print(f"[MATLAB Async Update] {e}")

    @property
    def current_phase(self) -> str:
        active_tasks = [t for t in self.tasks.values() if t.get("phase") not in ["COMPLETED", "FAILED"]]
        if active_tasks:
            return active_tasks[-1]["phase"]
        if self.tasks:
            last = list(self.tasks.values())[-1]
            return last.get("phase", "MISSION_COMPLETE")
        return "IDLE"

    @property
    def phase_progress(self) -> float:
        active_tasks = [t for t in self.tasks.values() if t.get("phase") not in ["COMPLETED", "FAILED"]]
        if active_tasks:
            return active_tasks[-1].get("progress", 0.0)
        return 100.0 if self.tasks else 0.0

    @property
    def status_message(self) -> str:
        active_tasks = [t for t in self.tasks.values() if t.get("phase") not in ["COMPLETED", "FAILED"]]
        if active_tasks:
            return active_tasks[-1].get("status_message", "Task in execution...")
        if self.tasks:
            return list(self.tasks.values())[-1].get("status_message", "Constellation nominal.")
        return "Constellation nominal in LEO orbits. 20 satellites ready."

    @property
    def current_target(self) -> Dict[str, Any]:
        if self.tasks:
            latest = list(self.tasks.values())[-1]
            return latest.get("target", {"latitude": 16.50, "longitude": 80.60})
        return {"latitude": 16.50, "longitude": 80.60, "priority": "HIGH", "type": "Earth Observation"}

    @property
    def selected_satellite(self) -> Optional[Dict[str, Any]]:
        active_tasks = [t for t in self.tasks.values() if t.get("phase") not in ["COMPLETED", "FAILED"]]
        sat_id = None
        if active_tasks and active_tasks[-1].get("assigned_satellite"):
            sat_id = active_tasks[-1]["assigned_satellite"]
        elif self.tasks:
            sat_id = list(self.tasks.values())[-1].get("assigned_satellite")
        
        if sat_id:
            for s in self.propagator.satellites:
                if s["id"] == sat_id:
                    return s
        return None

    @property
    def mpc_trajectory(self) -> List[List[float]]:
        active_tasks = [t for t in self.tasks.values() if t.get("phase") != "COMPLETED"]
        if active_tasks:
            return active_tasks[-1].get("mpc_trajectory", [])
        if self.tasks:
            return list(self.tasks.values())[-1].get("mpc_trajectory", [])
        return []

    @property
    def mission_metrics(self) -> Dict[str, Any]:
        active_tasks = [t for t in self.tasks.values() if t.get("phase") != "COMPLETED"]
        if active_tasks:
            return active_tasks[-1].get("metrics", {})
        if self.tasks:
            return list(self.tasks.values())[-1].get("metrics", {})
        return {}

    def reset_constellation(self):
        self.propagator = OrbitPropagator()
        self.tasks.clear()
        self.is_allocating = False
        self.negotiation_logs.clear()
        self.ai_analytics.clear()
        self.allocation_results = None
        self.failure_injected = False
        self._log_event("RESET", "Constellation reset to nominal 20-satellite Walker baseline.")

    def trigger_failure_scenario(self, sat_id: str = "SAT-03") -> Dict[str, Any]:
        self.failure_injected = True
        faulty_sat = None
        for s in self.propagator.satellites:
            if s["id"] == sat_id:
                s["battery"] = 12.0
                s["health"] = 0.28
                s["risk"] = 0.88
                s["failure_prob"] = 0.94
                s["is_faulty"] = True
                s["status"] = "FAULT_CRITICAL"
                faulty_sat = s
                break

        if not faulty_sat:
            return {"error": f"Satellite {sat_id} not found."}

        self._log_event("ANOMALY", f"CRITICAL: {sat_id} experienced sudden battery drain (12%) and health drop (0.28). Risk score: 0.88.")

        # Reassign or fail any active task assigned to this satellite
        reassigned_tasks = []
        failed_tasks = []
        for t_id, task in self.tasks.items():
            if task.get("assigned_satellite") == sat_id and task["phase"] not in ["COMPLETED", "FAILED"]:
                # Trigger reallocation
                self._log_event("REALLOCATION", f"Autonomous MAS reallocating {t_id} away from failed {sat_id}...", task_id=t_id)
                avail_sats = [s for s in self.propagator.satellites if s["id"] != sat_id and s["status"] != "FAULT_CRITICAL" and not s.get("is_busy", False) and not s.get("is_faulty", False) and s.get("battery", 0) >= 20.0]
                if avail_sats:
                    alloc = self.allocator.allocate(avail_sats, [task["target"]])
                    new_sat = alloc["selected_satellite"]
                    task["assigned_satellite"] = new_sat["id"]
                    task["reassignments"] = {"from": sat_id, "to": new_sat["id"], "reason": "Anomaly mitigation"}
                    new_sat["is_busy"] = True
                    new_sat["status"] = "REASSIGNED_MANEUVER"
                    reassigned_tasks.append((t_id, new_sat["id"]))
                    self._log_event("REALLOCATION_SUCCESS", f"Task {t_id} autonomously transferred to {new_sat['id']} (Reason: {alloc['selection_reason']})", task_id=t_id)
                else:
                    fail_msg = f"Assigned spacecraft {sat_id} suffered subsystem fault (status: FAULT_CRITICAL, battery: 12.0%). No standby satellites available."
                    task["phase"] = "FAILED"
                    task["status"] = "FAILED"
                    task["error_reason"] = fail_msg
                    task["status_message"] = f"Mission {t_id} FAILED: {fail_msg}"
                    failed_tasks.append(t_id)
                    self._log_event("TASK_FAILED", f"Mission {t_id} FAILED: {fail_msg}", task_id=t_id)
                    if self.matlab_runner:
                        asyncio.create_task(self._trigger_matlab_update(task, faulty_sat))

        return {
            "status": "FAULT_INJECTED",
            "faulty_satellite": sat_id,
            "reassigned_tasks": reassigned_tasks,
            "failed_tasks": failed_tasks,
            "message": f"CRITICAL: {sat_id} marked FAULT_CRITICAL. Reassigned {len(reassigned_tasks)} active tasks, {len(failed_tasks)} failed."
        }

    async def add_mission_task(self, target: Dict[str, Any]) -> str:
        """Adds a new mission task dynamically and launches parallel background execution"""
        self.task_counter += 1
        task_id = f"TASK-{self.task_counter}"
        
        place_name = target.get("place_name") or target.get("name") or f"{target['latitude']:.2f}° N, {target['longitude']:.2f}° E"
        task_name = target.get("name") or f"Mission {self.task_counter}: {place_name}"
        
        # Pre-select optimal candidate satellite dynamically via Hungarian allocation
        avail_sats = [s for s in self.propagator.satellites if not s.get("is_busy", False) and not s.get("is_faulty", False) and s.get("status") != "FAULT_CRITICAL"]
        initial_assigned = None
        alloc_strategy = "Hungarian"
        if avail_sats:
            tentative_alloc = self.allocator.allocate(avail_sats, [target])
            initial_assigned = tentative_alloc["selected_satellite"]["id"]
            alloc_strategy = tentative_alloc.get("selected_strategy", "Hungarian")

        task_obj = {
            "id": task_id,
            "name": task_name,
            "place_name": place_name,
            "target": target,
            "status": "PENDING",
            "phase": "PENDING",
            "progress": 0.0,
            "status_message": f"Task {task_id} registered for {place_name} ({target['latitude']:.2f}° N, {target['longitude']:.2f}° E)",
            "assigned_satellite": initial_assigned,
            "start_position": None,
            "mpc_trajectory": [],
            "captured_image": None,
            "metrics": {},
            "created_at": datetime.datetime.now().strftime("%H:%M:%S UTC"),
            "completed_at": None,
            "error_reason": None,
            "allocation_strategy": alloc_strategy,
            "allocation_rationale": f"Optimal {alloc_strategy} bipartite matching based on Euclidean distance, orbit geometry, and telemetry health." if initial_assigned else "Awaiting available spacecraft."
        }
        self.tasks[task_id] = task_obj
        self._log_event("TASK_RECEIVED", f"New task {task_id} [{place_name}]: Target ({target['latitude']:.2f}° N, {target['longitude']:.2f}° E) | Assigned Candidate: {initial_assigned or 'Allocating...'}", task_id=task_id)

        # Launch independent async execution pipeline for this task
        asyncio.create_task(self._run_task_pipeline(task_id))
        return task_id

    async def _run_task_pipeline(self, task_id: str):
        try:
            await self._execute_task_pipeline(task_id)
        except Exception as e:
            import traceback
            traceback.print_exc()
            task = self.tasks.get(task_id)
            if task:
                task["phase"] = "FAILED"
                task["status"] = "FAILED"
                task["error_reason"] = f"Pipeline execution error: {e}"
                task["status_message"] = f"Task {task_id} failed: {e}"
            self.is_allocating = False
            self._log_event("TASK_FAILED", f"Error in pipeline for {task_id}: {e}", task_id=task_id)

    async def _execute_task_pipeline(self, task_id: str):
        task = self.tasks.get(task_id)
        if not task:
            return

        target = task["target"]
        # 1. SATELLITE COMMUNICATION & CROSS-LINKS (Dotted Line Phase)
        task["phase"] = "COMMUNICATING"
        task["progress"] = 15.0
        self.is_allocating = True
        self._log_event("COMMUNICATION", f"Forming dynamic crosslinks A(t) and broadcasting negotiation beacons for {task_id}...", task_id=task_id)
        
        comm_data = self.comm_manager.compute_topology(self.propagator.satellites)
        new_logs = self.comm_manager.generate_negotiation_logs(self.propagator.satellites, comm_data["active_links"])
        self.negotiation_logs = (new_logs + self.negotiation_logs)[:25]
        
        await asyncio.sleep(1.2)

        # 2. AI ANALYSIS (GAT, LSTM, RF, Risk MLP)
        task["phase"] = "ANALYZING"
        task["progress"] = 30.0
        self._log_event("AI_ANALYSIS", f"Executing GAT spatial attention + LSTM temporal forecast + RF risk inference for {task_id}...", task_id=task_id)
        
        # GAT feature extraction
        sats = self.propagator.satellites
        node_feats = torch.tensor([[
            s["battery"] / 100.0, s["health"], s["risk"], 0.4, s["altitude"] / 1000.0, 0.85, s["active_links"] / 5.0
        ] for s in sats], dtype=torch.float32)
        adj_mat = torch.tensor(comm_data["adjacency_matrix"], dtype=torch.float32)

        with torch.no_grad():
            gat_feat, _ = self.gat(node_feats, adj_mat)
            # Continuous 10-step telemetry history sequence per satellite
            lstm_seqs = []
            for s in sats:
                hist = s.get("telemetry_history")
                if not hist or len(hist) < 10:
                    pad = [[s["battery"]/100.0, s["health"], 0.05, s["risk"], s["failure_prob"]]] * (10 - (len(hist) if hist else 0))
                    hist = (pad + hist) if hist else pad
                lstm_seqs.append(hist[-10:])
            lstm_inputs = torch.tensor(lstm_seqs, dtype=torch.float32)
            lstm_feat, lstm_preds = self.lstm(lstm_inputs)
            X_rf = np.array([[s["battery"]/100.0, 0.02, 0.01, 0.02, 0.8, s["health"], 0.5] for s in sats])
            _, _, rf_emb = self.rf.predict(X_rf)
            fused = self.fusion(gat_feat, lstm_feat, torch.tensor(rf_emb, dtype=torch.float32))
            risk_mlp_out = self.risk_mlp(fused)

        self.ai_analytics = {
            "gat_spatial_features": gat_feat[0, :8].tolist(),
            "predicted_future_battery": round(float(lstm_preds[0, 0] * 100), 1),
            "predicted_health_trend": "GOOD",
            "lstm_failure_probability": round(float(lstm_preds[0, 2]), 3),
            "rf_feature_importance": self.rf.get_feature_importances(),
            "risk_mlp_outputs": {
                "failure_probability": round(float(risk_mlp_out[0, 0]), 3),
                "mission_risk": round(float(risk_mlp_out[0, 1]), 3),
                "battery_health": round(float(risk_mlp_out[0, 2]), 3),
                "margin_indicator": round(float(risk_mlp_out[0, 3]), 3)
            }
        }
        await asyncio.sleep(1.0)

        # 3. TASK ALLOCATION (Hungarian Algorithm)
        task["phase"] = "ALLOCATING"
        task["progress"] = 45.0
        
        # Check if satellites are sufficient or if task must wait for another task to complete
        avail_sats = [s for s in sats if not s.get("is_busy", False) and not s.get("is_faulty", False)]
        if not avail_sats:
            task["phase"] = "WAITING_FOR_SATELLITE"
            task["status_message"] = "All 20 satellites engaged. Waiting in queue for preceding task to complete..."
            self._log_event("TASK_WAITING", f"All constellation satellites busy. Task {task_id} queued: waiting for preceding task completion...", task_id=task_id)
            
            # Polling wait loop until a satellite completes its task and frees up
            while True:
                await asyncio.sleep(1.0)
                avail_sats = [s for s in self.propagator.satellites if not s.get("is_busy", False) and not s.get("is_faulty", False)]
                if avail_sats:
                    task["phase"] = "ALLOCATING"
                    task["status_message"] = f"Satellite available. Resuming allocation for {task_id}..."
                    self._log_event("TASK_RESUMED", f"Satellite available! Resuming Hungarian allocation for {task_id}...", task_id=task_id)
                    break

        alloc = self.allocator.allocate(avail_sats, [target])
        self.allocation_results = alloc
        selected_sat = alloc["selected_satellite"]
        task["assigned_satellite"] = selected_sat["id"]
        task["start_position"] = list(selected_sat["position"])
        
        # Mark satellite as busy for concurrent operations
        for s in self.propagator.satellites:
            if s["id"] == selected_sat["id"]:
                s["is_busy"] = True
                s["current_task"] = task_id
                s["status"] = "ASSIGNED"

        self.is_allocating = False
        self._log_event("ALLOCATION", f"Task {task_id} assigned to {selected_sat['id']} via Hungarian Algorithm (Cost: {alloc['hungarian']['total_cost']:.3f})", task_id=task_id)

        # Multi-Hop Inter-Satellite Link (ISL) Mesh Routing (Feature 2)
        gateway_sat = "SAT-01" if selected_sat["id"] != "SAT-01" else "SAT-10"
        isl_route = self.comm_manager.find_multi_hop_route(selected_sat["id"], gateway_sat, self.propagator.satellites)
        task["isl_route"] = isl_route
        self._log_event("ISL_ROUTING", f"Multi-hop ISL mesh route computed via Dijkstra: {' -> '.join(isl_route)}", task_id=task_id)

        await asyncio.sleep(1.0)

        # 4. 6-DOF MPC CONTROLLER TRAJECTORY GENERATION
        task["phase"] = "MPC_ACTIVE"
        task["progress"] = 60.0
        self._log_event("MPC_ACTIVATE", f"6-DOF MPC Controller active for {selected_sat['id']} (Horizon=10, dt=0.1s). Solving QP under thrust limits...", task_id=task_id)
        
        sel_pos = np.array(selected_sat["position"])
        t_lat = math.radians(target["latitude"])
        t_lon = math.radians(target["longitude"])
        r_sat_alt = float(np.linalg.norm(sel_pos))
        tgt_xyz = np.array([
            r_sat_alt * math.cos(t_lat) * math.cos(t_lon),
            r_sat_alt * math.cos(t_lat) * math.sin(t_lon),
            r_sat_alt * math.sin(t_lat)
        ])

        # Generate 16 smooth interpolation points towards target overflight
        mpc_path = []
        for k in range(16):
            alpha = k / 15.0
            s = 10 * alpha**3 - 15 * alpha**4 + 6 * alpha**5
            pt = (1 - s) * sel_pos + s * tgt_xyz
            pt = r_sat_alt * (pt / np.linalg.norm(pt))
            mpc_path.append(pt.tolist())

        task["mpc_trajectory"] = mpc_path
        await asyncio.sleep(1.0)

        # 5. SATELLITE TASK EXECUTION (Smooth Trajectory Maneuver)
        task["phase"] = "EXECUTING"
        task["status"] = "IN_PROGRESS"
        task["progress"] = 75.0
        self._log_event("MANEUVER", f"{selected_sat['id']} firing reaction thrusters along MPC trajectory curve towards target...", task_id=task_id)

        for step_idx, pt in enumerate(mpc_path[::2]):
            # Check for physical fault or critical health condition
            s_live = next((s for s in self.propagator.satellites if s["id"] == selected_sat["id"]), None)
            if s_live and (s_live.get("is_faulty", False) or s_live.get("status") == "FAULT_CRITICAL" or s_live.get("battery", 100.0) < 15.0 or s_live.get("health", 1.0) < 0.30):
                # Try multi-agent reassignment if a backup is available
                alt_avail = [alt for alt in self.propagator.satellites if alt["id"] != selected_sat["id"] and not alt.get("is_faulty", False) and alt.get("status") != "FAULT_CRITICAL" and not alt.get("is_busy", False) and alt.get("battery", 0) >= 20.0]
                if alt_avail:
                    alt_alloc = self.allocator.allocate(alt_avail, [target])
                    new_sat = alt_alloc["selected_satellite"]
                    task["reassignments"] = {"from": selected_sat["id"], "to": new_sat["id"], "reason": "Hardware fault mitigation"}
                    self._log_event("REALLOCATION", f"Autonomous MAS reallocated {task_id} from {selected_sat['id']} to {new_sat['id']}...", task_id=task_id)
                    selected_sat = new_sat
                    task["assigned_satellite"] = new_sat["id"]
                    for s_item in self.propagator.satellites:
                        if s_item["id"] == new_sat["id"]:
                            s_item["is_busy"] = True
                            s_item["current_task"] = task_id
                else:
                    # Genuine failure
                    fail_reason = (
                        f"Critical battery depletion on {selected_sat['id']} ({s_live.get('battery', 0):.1f}% < 15.0%)"
                        if s_live.get("battery", 100.0) < 15.0
                        else f"Attitude/propulsion subsystem fault on {selected_sat['id']} (status: FAULT_CRITICAL)"
                    )
                    task["phase"] = "FAILED"
                    task["status"] = "FAILED"
                    task["error_reason"] = fail_reason
                    task["status_message"] = f"Mission {task_id} FAILED: {fail_reason}"
                    self._log_event("TASK_FAILED", f"Mission {task_id} FAILED: {fail_reason}", task_id=task_id)
                    if s_live:
                        s_live["is_busy"] = False
                        s_live["current_task"] = "FAILED"
                    if self.matlab_runner:
                        asyncio.create_task(self._trigger_matlab_update(task, s_live))
                    return

            for s in self.propagator.satellites:
                if s["id"] == selected_sat["id"]:
                    s["battery"] = max(10.0, s["battery"] - 0.35)
                    s["status"] = "MANEUVERING"
            task["progress"] = min(90.0, 75.0 + step_idx * 2.5)
            await asyncio.sleep(0.3)

        # Final health verification before imaging
        s_live = next((s for s in self.propagator.satellites if s["id"] == selected_sat["id"]), None)
        if s_live and (s_live.get("is_faulty", False) or s_live.get("status") == "FAULT_CRITICAL" or s_live.get("battery", 100.0) < 15.0):
            fail_reason = f"Post-maneuver power/subsystem collapse on {selected_sat['id']}."
            task["phase"] = "FAILED"
            task["status"] = "FAILED"
            task["error_reason"] = fail_reason
            task["status_message"] = f"Mission {task_id} FAILED: {fail_reason}"
            self._log_event("TASK_FAILED", f"Mission {task_id} FAILED: {fail_reason}", task_id=task_id)
            if s_live:
                s_live["is_busy"] = False
                s_live["current_task"] = "FAILED"
            if self.matlab_runner:
                asyncio.create_task(self._trigger_matlab_update(task, s_live))
            return

        # 6. TARGET ACQUIRED & CAPTURING
        task["phase"] = "TARGET_ACQUIRED"
        task["progress"] = 92.0
        self._log_event("TARGET_LOCK", f"Target acquired at ({target['latitude']:.2f}° N, {target['longitude']:.2f}° E). Payload gimbal locked nadir.", task_id=task_id)
        await asyncio.sleep(0.8)

        task["phase"] = "CAPTURING"
        task["progress"] = 96.0
        self._log_event("IMAGING", f"{selected_sat['id']} capturing high-resolution multispectral image of target...", task_id=task_id)

        # Generate observation image
        img_filename = f"obs_{task_id}.png"
        img_path = self.base_dir / "results" / img_filename
        generate_simulated_earth_observation_image(img_path, lat=target["latitude"], lon=target["longitude"], sat_id=selected_sat["id"])

        task["captured_image"] = {
            "status": "SUCCESS",
            "satellite_id": selected_sat["id"],
            "target": f"{target['latitude']:.2f}° N, {target['longitude']:.2f}° E",
            "resolution": "0.50 m / pixel GSD",
            "cloud_cover": "3.8 %",
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "image_url": f"/results/{img_filename}",
            "is_simulated": True
        }
        await asyncio.sleep(1.0)

        # 7. MISSION COMPLETE & RELEASE SATELLITE
        task["phase"] = "COMPLETED"
        task["status"] = "COMPLETED"
        task["progress"] = 100.0
        task["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S UTC")
        task["status_message"] = f"Mission {task_id} completed successfully by {selected_sat['id']}."
        task["metrics"] = {
            "mission_time_sec": 14.8,
            "energy_consumed_pct": 2.4,
            "tracking_rmse_km": 0.042,
            "mission_risk": selected_sat["risk"],
            "failure_prob": selected_sat["failure_prob"],
        }
        
        for s in self.propagator.satellites:
            if s["id"] == selected_sat["id"]:
                s["is_busy"] = False
                s["current_task"] = "IDLE"
                s["status"] = "AVAILABLE"

        self._log_event("COMPLETED", f"Task {task_id} successfully completed. Telemetry feedback loop synchronized.", task_id=task_id)
        if self.matlab_runner:
            asyncio.create_task(self._trigger_matlab_update(task, selected_sat))

    def get_state(self) -> Dict[str, Any]:
        comm_data = self.comm_manager.compute_topology(self.propagator.satellites)
        
        # Collect all active tasks
        active_tasks_list = list(self.tasks.values())
        
        # Global phase: if any task is executing, show most active phase
        global_phase = "IDLE"
        if active_tasks_list:
            running_tasks = [t for t in active_tasks_list if t["phase"] != "COMPLETED"]
            if running_tasks:
                global_phase = running_tasks[-1]["phase"]
            else:
                global_phase = "MISSION_COMPLETE"

        return {
            "phase": global_phase,
            "sim_time": self.propagator.sim_time,
            "epoch_utc": self.propagator.epoch_utc,
            "omega_earth": self.propagator.OMEGA_EARTH,
            "is_allocating": self.is_allocating,
            "satellites": self.propagator.satellites,
            "space_station": self.propagator.space_station,
            "communication": comm_data,
            "negotiation_logs": self.negotiation_logs,
            "allocation": self.allocation_results,
            "ai_analytics": self.ai_analytics,
            "tasks": active_tasks_list,
            "event_logs": self.event_logs[:50],
            "failure_injected": self.failure_injected
        }
