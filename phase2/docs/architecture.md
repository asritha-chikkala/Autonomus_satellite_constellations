# SYSTEM ARCHITECTURE

## Autonomous Satellite Constellation Coordination using Multi-Agent Systems & 6-DOF MPC

```
MISSION REQUEST
        ↓
SATELLITE INITIALIZATION
        ↓
6-DOF SATELLITE DYNAMICS
    ┌─────────────────────┐
    │ Newton-Euler 3-DOF  │
    │ Translation         │
    └─────────────────────┘
              +
    ┌─────────────────────┐
    │ Lagrangian 3-DOF    │
    │ Attitude            │
    └─────────────────────┘
        ↓
TELEMETRY COLLECTION
(Position, Velocity, Attitude, Battery, Health)
        ↓
DYNAMIC COMMUNICATION GRAPH
A(t) = f(Line-of-Sight, Distance, Link Quality)
        ↓
 ┌────────────┬───────────────┬────────────────┐
 │ GAT        │ LSTM          │ Random Forest  │
 │ Spatial    │ Temporal      │ Risk/Anomaly   │
 └────────────┴───────────────┴────────────────┘
        ↓
FEATURE FUSION
[GAT Features (64-D), LSTM Features (32-D), RF Features (32-D)] → 128-D
        ↓
RISK MLP NETWORK
Dense(128 → 64) → ReLU → Dropout(0.2)
Dense(64 → 32)  → ReLU
Dense(32 → 4)   → Sigmoid
Outputs:
1. Failure Probability
2. Mission Risk
3. Battery Health
4. Constellation Margin Indicator
        ↓
COST MATRIX GENERATION
C(i,j) = α·Distance + β·Risk - γ·Battery + δ·Delay
where:
α = 0.40, β = 0.25, γ = 0.25, δ = 0.10
        ↓
INTELLIGENT TASK ALLOCATION
 ┌────────────┬────────────┬────────────┐
 │ Hungarian  │ Auction    │ Greedy     │
 │ Optimal    │ Distributed│ Fast       │
 └────────────┴────────────┴────────────┘
        ↓
LOCAL MODEL PREDICTIVE CONTROL
min J = Σ (||xk - xref||²_Q + ||uk||²_R)
Horizon = 10, dt = 0.1 s
Constraints:
Thrust ≤ Umax (5.0 N)
Angular velocity ≤ Ωmax (0.15 rad/s)
        ↓
SATELLITE TASK EXECUTION
Apply thrust vectors
Apply torque commands
Update battery & subsystems
Track trajectory
        ↓
UPDATED TELEMETRY
        ↓
FEEDBACK LOOP (MACRO: GAT+LSTM+MLP+Hungarian | MICRO: Dynamics+MPC)
```

---

## Component Breakdown

### 1. Dual-Loop Coordination Hierarchy
- **Macro Loop (Global Multi-Agent System)**:
  - Dynamic communication graph evaluation: $A(t) = f(\text{LOS}, d_{ij}, Q_{ij})$.
  - Spatial feature aggregation via multi-head Graph Attention Network (GAT).
  - Multi-step telemetry sequence forecasting via LSTM.
  - Multi-criteria risk scoring and anomaly detection via Random Forest.
  - Deep risk inference via 4-layer Risk MLP.
  - Multi-agent task assignment comparing Hungarian (Kuhn-Munkres), Auction (Bertsekas), and Greedy algorithms.
- **Micro Loop (Local Spacecraft Subsystems)**:
  - 6-DOF nonlinear dynamics combining Newton-Euler orbital mechanics ($J_2$ perturbation) and Lagrangian rigid-body rotational dynamics.
  - Model Predictive Controller (MPC) running with horizon $N=10$, $\Delta t=0.1\text{ s}$, quadratic programming (QP) solver, and physical control limits.
  - Battery state-of-charge (SoC) model with solar charging and thrust consumption.
  - Subsystem health and probabilistic degradation model.

### 2. Autonomous Contingency & Fault Reassignment
When a satellite experiences an unexpected telemetry anomaly (e.g., critical battery depletion below 15% or high actuator stress), the Risk MLP and Random Forest detect the anomaly, mark the satellite unavailable, and trigger dynamic task reallocation to the next Pareto-optimal satellite in the constellation.
