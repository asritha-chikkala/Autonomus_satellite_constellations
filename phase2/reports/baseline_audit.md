# Baseline Project Audit Document: Autonomous Satellite Systems
**Date:** 2026-10-10  
**Authors:** Senior Aerospace Control Engineer, Orbital Mechanics Specialist, System Architecture Auditor  

---

## 1. Executive Summary & Verification State
An exhaustive codebase audit was conducted across MATLAB astrodynamics & control engines, Python FastAPI backend, PyTorch AI inference models, and Next.js / Three.js digital-twin visualizer.

### Executability Matrix:
- **MATLAB R2024b:** Fully installed and operational with Optimization Toolbox (`fmincon.m` and `quadprog.m` confirmed at `C:\Program Files\MATLAB\R2024b\toolbox\optim\optim\`).
- **Python 3.13.3:** Operational with PyTorch, FastAPI, NumPy, Pandas, Scikit-learn, and WebSockets.
- **AI Models:** PyTorch models (`gat_model.pth`, `lstm_model.pth`, `risk_mlp.pth`, `rf_model_clf.joblib`) are present and executed live via `models/feature_fusion.py` in `mission_manager.py`.
- **Controllers:** Currently only Linear MPC is implemented (`matlab/mpc_controller.m`). NMPC and PID are missing.

---

## 2. Confirmed Deficiencies & Physics/Mathematical Discrepancies

| ID | Module / Component | Severity | Confirmed Issue | Corrective Action Required |
|:---|:---|:---|:---|:---|
| **AUD-01** | `frontend/components/EarthViewer3D.tsx` | **CRITICAL** | **Earth Rotation Decoupled from Physics:** Globe rotates using arbitrary animation increment `rotY += 0.00018` and `earthRot = elapsedTime * 0.0007` rather than Earth's true sidereal rotation rate $\omega_\oplus = 7.2921159 \times 10^{-5}\text{ rad/s}$ ($23\text{h } 56\text{m } 4.09\text{s}$). | Tie rotation strictly to simulation time $t_{sim}$ and simulation speed multiplier. |
| **AUD-02** | `frontend/components/EarthViewer3D.tsx` | **CRITICAL** | **Orbital Motion Visualization Decoupled from Physics:** In animation loop, satellites orbit using hardcoded `elapsedTime * 0.012` rather than displaying actual propagated ECI positions from backend / physical integrator. | Bind satellite mesh positions strictly to actual propagated Cartesian coordinates $(X,Y,Z)$ in ECI frame. |
| **AUD-03** | `backend/simulation/orbit_propagator.py` | **HIGH** | **Inertial-to-ECEF / Ground Target Disconnect:** Ground coordinates (latitude/longitude) of orbiting satellites use instantaneous atan2 of ECI coordinates without subtracting Earth rotation angle $\theta_{GST}(t) = \theta_0 + \omega_\oplus t$. | Implement rigorous ECI $\leftrightarrow$ ECEF transformation matrix $R_z(\omega_\oplus t)$ for true sub-satellite ground track calculation. |
| **AUD-04** | `backend/main.py` | **MEDIUM** | **Simulation Clock Inconsistency:** Background orbit loop runs at 10 Hz with `dt_effective = 0.2 * SIM_SPEED`, but lacks continuous time synchronization broadcast (`sim_time`, `wall_time`). | Expose `sim_time`, `wall_time`, and proper discrete integration steps. |
| **AUD-05** | `matlab/mpc_controller.m` & `attitude_dynamics.m` | **CRITICAL** | **State Dimension & Attitude Parameterization Mismatch:** Plant uses Euler angles with singularity risk near pitch $\pm 90^\circ$ and ignores quaternion kinematics. Controller treats attitude as 3 Euler angles instead of a mathematically justified reduced attitude error vector $\mathbf{e}_q = 2 \mathbf{q}_{err,1:3}$. | Formulate exact 13-state plant ($\mathbf{r}, \mathbf{v}, \mathbf{q}, \boldsymbol{\omega}$) and 12-state reduced error controller ($\delta\mathbf{r}, \delta\mathbf{v}, \delta\boldsymbol{\theta}, \delta\boldsymbol{\omega}$) with quaternion normalization. |
| **AUD-06** | `matlab/mpc_controller.m` | **HIGH** | **LMPC Linearization & CAM Hyperplane:** Linearized $B$ matrix uses scalar conversions $10^{-3}$ and assumes identity coupling. Collision Avoidance Maneuver (CAM) constraint linearizes keep-out sphere around nominal reference rather than current state. Infeasible fallback returns clipped unconstrained solve without certified feasibility flag. | Refine affine state-space formulation, enforce QP status logging, distinguish solver status from fallback, and log computation time. |
| **AUD-07** | `matlab/` | **CRITICAL** | **Missing NMPC and PID Controllers:** No Nonlinear MPC (`fmincon` using full 6-DOF nonlinear differential equations) or tuned PID baseline exists in the repository. | Implement real 6-DOF NMPC with `fmincon` and systematic PID with anti-windup and vector saturation. |
| **AUD-08** | Constellation Sizing | **MEDIUM** | **Constellation Justification Missing:** 20-satellite Walker Delta constellation is hardcoded without quantitative coverage, revisit time, or communication availability trade-off analysis across fleet sizes (8, 12, 16, 20, 24, 32). | Implement parametric constellation simulation benchmark across fleet sizes (8 to 32 sats) measuring revisit time, coverage gaps, and routing overhead. |

---

## 3. Required Test Suite
1. `test_physics.py` / `test_orbital_dynamics.m`: Verify Earth rotation rate against sidereal period ($T_\oplus \approx 86164.09\text{ s}$), two-body energy and angular momentum conservation, and ECI-ECEF ground track consistency.
2. `test_controllers.m`: Benchmark LMPC, NMPC, and PID on identical nonlinear plant under 8 required mission scenarios (nominal, initial error, attitude error, external disturbance, model mismatch, actuator saturation, debris collision avoidance, Monte Carlo).
3. `test_constellation_sizing.py` / `.m`: Quantitative coverage and revisit evaluation across 8, 12, 16, 20, 24, and 32 satellite fleets.
