# MATLAB SIMULATION MANUAL

## Files in `matlab/`
- `config.m`: Physical parameters, $J_2$, constellation orbital elements, MPC weights, cost weights.
- `initialize_satellites.m`: Generates 8 Walker-constellation satellites + ISS station.
- `translational_dynamics.m`: 3-DOF Newton-Euler translation with J2 perturbation and thrust.
- `attitude_dynamics.m`: 3-DOF Lagrangian rigid body attitude dynamics.
- `satellite_dynamics.m`: Combines 6-DOF translation and attitude ($x \in \mathbb{R}^{12}, u \in \mathbb{R}^6$).
- `communication_graph.m`: Inter-satellite crosslinks $A(t) = f(\text{LOS}, d, Q)$.
- `cost_matrix.m`: Weighted cost formulation $C(i, j) = 0.40 \cdot D + 0.25 \cdot R - 0.25 \cdot B + 0.10 \cdot \tau$.
- `hungarian_assignment.m`: Kuhn-Munkres optimal assignment solver.
- `auction_assignment.m`: Bertsekas distributed auction algorithm.
- `greedy_assignment.m`: Greedy task allocation heuristic.
- `task_allocation.m`: Benchmarks all three algorithms.
- `generate_reference_trajectory.m`: Generates smooth minimum-jerk reference profile.
- `mpc_controller.m`: Quadratic programming (QP) Model Predictive Controller with $N=10$, $dt=0.1\text{ s}$.
- `run_mpc_simulation.m`: Closed-loop simulation and tracking metrics calculation.
- `battery_model.m`: Battery SoC dynamics with solar charging and thruster drain.
- `health_model.m`: Subsystem degradation and failure probability model.
- `telemetry_update.m`: Advances state via 4th-order Runge-Kutta (RK4).
- `generate_results.m`: Exports 11 CSV files, JSON summary, and renders all 20 MATLAB figures.
- `main_simulation.m`: Top-level simulation orchestrator.
- `generate_simulation_dataset.m`: Generates 4,200 physics-based ML training samples across 7 scenarios.

## Execution Command
```matlab
addpath('matlab');
main_simulation;
```
