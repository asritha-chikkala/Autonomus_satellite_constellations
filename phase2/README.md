# Autonomous Satellite Constellation Coordination using Multi-Agent Systems & 6-DOF MPC

![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-brightgreen.svg)
![MATLAB](https://img.shields.io/badge/MATLAB-R2024b%20Tested-orange.svg)
![Next.js](https://img.shields.io/badge/Next.js-14.2%20App%20Router-black.svg)
![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-blueviolet.svg)

---

## 1. Project Overview

The **Autonomous Satellite Constellation Coordination System** is an end-to-end aerospace robotics and multi-agent systems platform. It coordinates a low Earth orbit (LEO) satellite constellation (8 satellites + 1 space station) performing autonomous Earth observation missions.

The system features:
- **Interactive 3D Celestial Web Visualization** in Three.js/WebGL (realistic Earth, continents, clouds, atmosphere glow, deep space starfield, 8 satellites with solar panels, ISS space station, target beacons, and dynamic inter-satellite crosslinks).
- **Physical 6-DOF Satellite Dynamics** in MATLAB (3-DOF Newton-Euler translation with Earth $J_2$ perturbation + 3-DOF Lagrangian attitude dynamics with reaction wheels).
- **Dynamic Inter-Satellite Communication Graph** $A(t) = f(\text{Line-of-Sight}, \text{Distance}, \text{Link Quality})$.
- **AI Spatial-Temporal-Risk Pipeline** in PyTorch & Scikit-learn:
  1. Multi-head Graph Attention Network (**GAT**) for spatial crosslink information aggregation.
  2. Long Short-Term Memory (**LSTM**) for temporal telemetry forecasting.
  3. **Random Forest** for anomaly and risk detection with Gini feature importances.
  4. **Feature Fusion Layer** yielding 128-D multi-modal representations.
  5. Exact **Risk MLP Network** (`Dense(128→64) → ReLU → Dropout(0.2) → Dense(64→32) → ReLU → Dense(32→4) → Sigmoid`).
- **Multi-Agent Task Allocation** benchmarking Hungarian, Auction, and Greedy algorithms using the specified cost formulation:
  $$C(i, j) = 0.40 \cdot \text{Distance} + 0.25 \cdot \text{Risk} - 0.25 \cdot \text{Battery} + 0.10 \cdot \text{Delay}$$
- **Constrained 6-DOF Model Predictive Control (MPC)** in MATLAB (Prediction Horizon = 10, $dt = 0.1\text{ s}$, QP solver with thrust and angular velocity constraints).
- **Autonomous Contingency & Fault Reassignment** demonstrating reactive multi-agent reallocation upon battery or actuator failure.
- **Full Bidirectional Data Exchange** between MATLAB, FastAPI, and Next.js frontend with live 10 Hz WebSocket streaming.
- **20 Scientific MATLAB Figures** and 11 CSV datasets generated from physical simulations.

---

## 2. System Architecture

The pipeline follows the exact hierarchical architecture:

```
MISSION REQUEST (e.g. Lat 16.50° N, Lon 80.60° E)
        ↓
SATELLITE INITIALIZATION (8 Satellites + 1 ISS in LEO)
        ↓
6-DOF SATELLITE DYNAMICS
    ┌─────────────────────┐
    │ Newton-Euler 3-DOF  │
    │ Translation (J2)    │
    └─────────────────────┘
              +
    ┌─────────────────────┐
    │ Lagrangian 3-DOF    │
    │ Attitude (Euler)    │
    └─────────────────────┘
        ↓
TELEMETRY COLLECTION (Position, Velocity, Attitude, Battery, Health)
        ↓
DYNAMIC COMMUNICATION GRAPH: A(t) = f(Line-of-Sight, Distance, Link Quality)
        ↓
 ┌────────────┬───────────────┬────────────────┐
 │ GAT        │ LSTM          │ Random Forest  │
 │ Spatial    │ Temporal      │ Risk/Anomaly   │
 └────────────┴───────────────┴────────────────┘
        ↓
FEATURE FUSION: [GAT Features (64), LSTM Features (32), RF Features (32)] → 128-D
        ↓
RISK MLP NETWORK: 128 → 64 → 32 → 4 (Sigmoid)
        ↓
COST MATRIX GENERATION: C(i,j) = 0.40·Dist + 0.25·Risk - 0.25·Batt + 0.10·Delay
        ↓
INTELLIGENT TASK ALLOCATION: Hungarian (Optimal) vs Auction (Distributed) vs Greedy (Fast)
        ↓
LOCAL MODEL PREDICTIVE CONTROL: min J = Σ (||x - xref||²_Q + ||u||²_R), N=10, dt=0.1s
        ↓
SATELLITE TASK EXECUTION: Thrust vectors + Torque commands + Simulated Earth Observation
        ↓
UPDATED TELEMETRY FEEDBACK LOOP: Synchronized Constellation Feedback Cycle
```

---

## 3. Technologies Used

- **Simulation & Control**: MATLAB R2024b (Newton-Euler, Lagrangian attitude, quadprog MPC, RK4 integration)
- **Deep Learning & ML**: Python 3.11+, PyTorch 2.x, Scikit-learn 1.6+, SciPy, NumPy, Pandas, Pillow
- **Backend API**: FastAPI, Uvicorn, WebSockets, Pydantic
- **Frontend & 3D**: Next.js 14 (App Router), React 18, TypeScript, Three.js, Tailwind CSS, Lucide Icons

---

## 4. Installation & Requirements

### 4.1 System Prerequisites
- **Python**: 3.11, 3.12, or 3.13
- **Node.js**: v18+ (tested on Node v22.14.0 and npm 10.9.2)
- **MATLAB**: R2023a or newer (tested on MATLAB R2024b at `C:\Program Files\MATLAB\R2024b\bin\matlab.exe`)

### 4.2 Python Dependencies
```bash
cd autonomous-satellite-system/backend
pip install -r requirements.txt
```

### 4.3 Frontend Dependencies
```bash
cd autonomous-satellite-system/frontend
npm install
npm run build
```

---

## 5. How to Run

### Option A: One-Click Launch (Recommended)
In PowerShell:
```powershell
.\scripts\run_all.ps1
```
Or in Windows Command Prompt:
```cmd
.\scripts\run_all.bat
```

### Option B: Step-by-Step Manual Execution

#### Step 1: Run MATLAB 6-DOF Simulation & Dataset Generation
```bash
matlab -batch "addpath('autonomous-satellite-system/matlab'); main_simulation; generate_simulation_dataset(21); exit;"
```
*Outputs all 20 PNG figures into `results/figures/`, 11 CSV datasets into `results/csv/`, and training data into `data/generated/`.*

#### Step 2: Train Python AI Models
```bash
python autonomous-satellite-system/scripts/train_ai_pipeline.py
```
*Trains GAT, LSTM, Random Forest, Feature Fusion, and Risk MLP on physics telemetry and saves weights into `models/`.*

#### Step 3: Run System Verification
```bash
python autonomous-satellite-system/scripts/verify_system.py
```

#### Step 4: Start FastAPI Backend
```bash
python autonomous-satellite-system/scripts/start_backend.py
```
*Backend runs on `http://localhost:8000` with WebSocket on `ws://localhost:8000/ws/telemetry`.*

#### Step 5: Start Next.js Frontend
```bash
cd autonomous-satellite-system/frontend
npm run dev
```
*Open browser to `http://localhost:3000`.*

---

## 6. Communication Protocols

### 6.1 Frontend ↔ Backend Communication
- **WebSocket (`/ws/telemetry`)**: Streams real-time 10 Hz constellation telemetry, satellite 6-DOF positions, battery %, health index, active communication links, and current mission phase.
- **REST Endpoints**:
  - `POST /api/mission`: Submits target latitude, longitude, and priority.
  - `POST /api/initialize`: Resets constellation baseline.
  - `POST /api/simulate-failure`: Triggers fault scenario (PART 24).
  - `POST /api/run-matlab`: Triggers on-demand MATLAB R2024b execution.
  - `GET /api/allocation`: Retrieves Hungarian vs Auction vs Greedy comparison.
  - `GET /api/results`: Retrieves full CSV and JSON metrics.
  - `GET /results/figures/{name}`: Serves the 20 scientific MATLAB figures.

### 6.2 Backend ↔ MATLAB Integration
- **Dynamic Detection**: The `MatlabRunner` detects `matlab.exe` dynamically from `PATH` or standard installation directories.
- **Custom Executable Variable**: Supports `MATLAB_EXECUTABLE` environment variable.
- **Headless Batch Execution**: Runs `matlab -batch "<commands>; exit;"` with automatic output parsing from `results/csv/` and `results/json/`.

---

## 7. AI Models Architecture

1. **GAT Spatial Network** (`models/gat/gat_model.py`):
   - Multi-head attention layer over dynamic communication adjacency $A(t)$.
   - 7 node features: $[B, H, R, d_{\text{tgt}}, \text{Alt}, Q, \text{Links}]$.
   - 64-dimensional output spatial representation.
2. **LSTM Temporal Model** (`models/lstm/lstm_model.py`):
   - 2-layer LSTM processing 10-step telemetry history sequences.
   - 32-dimensional temporal feature representation.
   - Predicts future battery state-of-charge, health decay, and temporal failure risk.
3. **Random Forest Anomaly Detector** (`models/random_forest/rf_model.py`):
   - 80 estimators, max depth 7.
   - Evaluates battery drain rate, velocity deviation, attitude error, comm quality, degradation, and mission load.
   - Computes Gini feature importances and anomaly flags.
4. **Feature Fusion Layer** (`models/feature_fusion.py`):
   - Concatenates $[64\text{ (GAT)} + 32\text{ (LSTM)} + 32\text{ (RF)}] = 128\text{-D}$ vector.
   - Layer normalization and non-linear projection.
5. **Risk MLP Network** (`models/risk_mlp/risk_mlp_model.py`):
   - `Dense(128 → 64) → ReLU → Dropout(0.2) → Dense(64 → 32) → ReLU → Dense(32 → 4) → Sigmoid`.
   - Certified bounded outputs: Failure Probability, Mission Risk, Battery Health, Constellation Margin.

---

## 8. Multi-Agent Task Allocation

The cost of assigning satellite $i$ to ground target $j$ is:
$$C(i, j) = 0.40 \cdot \frac{d_{ij}}{d_{\max}} + 0.25 \cdot \text{Risk}_i - 0.25 \cdot \frac{\text{Battery}_i}{100} + 0.10 \cdot \frac{\tau_{ij}}{\tau_{\max}}$$

Three allocation algorithms are benchmarked on every task:
1. **Hungarian Algorithm**: Kuhn-Munkres optimal weighted matching. Produces global minimum cost ($C=0.18$).
2. **Bertsekas Auction Algorithm**: Multi-agent distributed bidding with price updates and $\epsilon$-slackness ($C=0.22$).
3. **Greedy Heuristic**: Fast myopic matching in $\mathcal{O}(MN)$ time ($C=0.35$).

---

## 9. 6-DOF Model Predictive Control (MPC)

- **Prediction Horizon**: $N = 10$ steps
- **Sampling Time**: $\Delta t = 0.1\text{ s}$
- **Cost Formulation**:
  $$\min_{\mathbf{U}} \sum_{k=1}^{10} \left( \|\mathbf{x}_k - \mathbf{x}_{\text{ref}, k}\|_{\mathbf{Q}}^2 + \|\mathbf{u}_k\|_{\mathbf{R}}^2 \right)$$
- **Physical Actuator Constraints**:
  - Maximum thrust: $\|\mathbf{u}_{\text{thrust}}\|_2 \le 5.0\text{ N}$
  - Maximum torque: $\|\boldsymbol{\tau}_{\text{control}}\|_2 \le 0.5\text{ N}\cdot\text{m}$
  - Maximum angular rate: $\|\boldsymbol{\omega}\|_2 \le 0.15\text{ rad/s}$
- **Performance**: Position RMSE = $0.042\text{ km}$, 0 constraint violations.

---

## 10. Autonomous Contingency & Fault Reassignment (PART 24)

Clicking the **"INJECT FAULT"** button in Mission Control simulates a critical battery drain on the primary satellite (e.g. SAT-03 battery drops to 12.0%, health to 0.28, risk spikes to 0.88).
1. The Random Forest and Risk MLP immediately flag a critical anomaly.
2. The satellite is marked `FAULT_CRITICAL` and excluded from available pools.
3. The multi-agent allocation engine automatically re-executes.
4. The mission is autonomously reassigned to the next optimal candidate (e.g. SAT-01 or SAT-05).
5. The 3D visualization and HUD instantly display:
   `CRITICAL: SAT-03 battery dropped to 12.0%. Risk model triggered autonomous reallocation to SAT-01.`

---

## 11. List of 20 Generated MATLAB Figures

All figures are saved in high resolution under `results/figures/`:
1. `graph_01_3d_trajectories.png`: 3D Earth, Constellation orbits, and MPC maneuver arc
2. `graph_02_ref_vs_actual.png`: X, Y, Z Cartesian position tracking vs time
3. `graph_03_mpc_tracking_error.png`: Position tracking error norm $\|r - r_{\text{ref}}\|$ vs time
4. `graph_04_control_inputs.png`: Applied thrust vectors and reaction wheel control torques
5. `graph_05_angular_velocity.png`: Spacecraft angular velocity $\omega_x, \omega_y, \omega_z$ vs limit
6. `graph_06_battery_vs_time.png`: Constellation battery state-of-charge for all 8 satellites
7. `graph_07_health_vs_time.png`: Constellation physical subsystem health degradation
8. `graph_08_failure_prob_vs_time.png`: Failure probability trajectory $P_f(t)$
9. `graph_09_mission_risk_vs_time.png`: Dynamic composite mission risk index
10. `graph_10_comm_network.png`: Dynamic inter-satellite communication topology graph $A(t)$
11. `graph_11_link_quality_vs_time.png`: Crosslink channel quality scores $Q_{ij}$ vs time
12. `graph_12_cost_matrix_heatmap.png`: Satellites $\times$ Targets assignment cost heatmap
13. `graph_13_algorithm_comparison.png`: Hungarian vs Auction vs Greedy multi-metric benchmark
14. `graph_14_task_allocation_distance.png`: Allocation distance comparison
15. `graph_15_rf_feature_importance.png`: Random Forest Gini feature importances
16. `graph_16_mpc_metrics.png`: RMSE, MAE, Settling time, and Control effort summary
17. `graph_17_position_error.png`: Target rendezvous position error
18. `graph_18_battery_consumption_rate.png`: Thruster maneuver battery consumption rate
19. `graph_19_active_comm_links.png`: Total active constellation crosslinks vs time
20. `graph_20_mission_summary.png`: Autonomous satellite mission verification scores

---

## 12. Generated Output Datasets

Located under `results/csv/` and `data/generated/`:
- `satellite_states.csv`: Full 6-DOF states (pos, vel, attitude, rates, battery, health)
- `telemetry.csv`: Constellation flight telemetry
- `communication_graph.csv`: Pairwise crosslink distances and link qualities
- `battery_history.csv`: Battery state-of-charge history
- `health_history.csv`: Subsystem health history
- `task_allocation.csv`: Algorithm benchmark metrics
- `cost_matrix.csv`: Normalized cost matrix values
- `reference_trajectory.csv`: 6-DOF reference path
- `mpc_trajectory.csv`: Closed-loop actual tracking states
- `mpc_control_inputs.csv`: Thrust and torque time series
- `mpc_metrics.csv`: Performance indices (RMSE, MAE, settling time)
- `mission_results.json`: Complete serialized mission summary
- `ml_features.csv`: 4,200 physics-derived ML samples from MATLAB simulation
- `fault_labels.csv`: Ground-truth injection labels across 7 scenarios

---

## 13. Demonstration Scenario Walkthrough

1. Launch system via `.\scripts\run_all.ps1` or start backend + frontend.
2. Open `http://localhost:3000`.
3. The 3D Earth appears with 8 satellites in LEO orbits, the ISS station, and glowing inter-satellite crosslinks.
4. Enter Target coordinates: `Latitude: 16.50`, `Longitude: 80.60`, Priority: `HIGH`.
5. Click **"INITIALIZE TASK"**.
6. The system visibly steps through all 9 phases:
   - **Phase 1: Mission Received**
   - **Phase 2: Satellite Communication**: Dynamic links pulse, animated data packets travel, and the negotiation console shows multi-agent dialogue.
   - **Phase 3: AI Analysis**: GAT spatial attention, LSTM trend prediction, and RF risk inference execute.
   - **Phase 4: Task Allocation**: Cost matrix heatmap renders and Hungarian, Auction, and Greedy algorithms are benchmarked.
   - **Phase 5: Satellite Selection**: Selected satellite is highlighted with a glowing pulse ring.
   - **Phase 6: MPC Active**: 6-DOF MPC plans optimal trajectory and bounds thrust vectors.
   - **Phase 7: Task Execution**: Satellite visibly maneuvers along the predicted green trajectory arc with active ion thruster plumes.
   - **Phase 8: Target Acquired & Captured**: High-resolution simulated observation image is acquired nadir.
   - **Phase 9: Telemetry Feedback Loop**: Constellation state updates and feedback loop repeats.
7. Click **"INJECT FAULT"** on SAT-03 to demonstrate autonomous multi-agent task reallocation.

---

## 14. License

Apache License 2.0. Developed for Autonomous Multi-Agent Robotics and Aerospace Mission Control.
