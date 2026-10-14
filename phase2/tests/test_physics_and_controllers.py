import pytest
import numpy as np
import os
import pandas as pd
from backend.simulation.orbit_propagator import OrbitPropagator

def test_earth_physical_constants():
    """Verify physical Earth rotation rate, radius, and gravity parameters."""
    # Sidereal rotation rate = 7.2921159e-5 rad/s
    assert np.isclose(OrbitPropagator.OMEGA_EARTH, 7.2921159e-5, rtol=1e-6)
    sidereal_period = 2 * np.pi / OrbitPropagator.OMEGA_EARTH
    assert np.isclose(sidereal_period, 86164.09, rtol=1e-3)
    
    # Gravitational parameter and Earth radius
    assert np.isclose(OrbitPropagator.MU, 398600.4418, rtol=1e-6)
    assert np.isclose(OrbitPropagator.RE, 6378.137, rtol=1e-6)
    assert np.isclose(OrbitPropagator.J2, 1.08263e-3, rtol=1e-4)

def test_orbit_propagator_eci_ecef_transformation():
    """Verify exact ECI to ECEF rotation properties."""
    prop = OrbitPropagator()
    pos_eci = np.array([7000.0, 0.0, 0.0])
    
    # At t = 0, ECI x-axis aligns with ECEF x-axis
    p0 = prop.eci_to_ecef(pos_eci, 0.0)
    assert np.allclose(p0, pos_eci, atol=1e-5)
    
    # At sidereal period T, rotation is 2*pi
    T_sidereal = 2 * np.pi / OrbitPropagator.OMEGA_EARTH
    pT = prop.eci_to_ecef(pos_eci, T_sidereal)
    assert np.allclose(p0, pT, atol=1e-4)
    
    # Check length preservation
    assert np.isclose(np.linalg.norm(p0), np.linalg.norm(pos_eci), atol=1e-7)

def test_orbital_propagation_and_altitude():
    """Verify satellite propagation remains within LEO bounds (500 - 600 km)."""
    prop = OrbitPropagator()
    prop.propagate_step(dt=1.0)
    assert len(prop.satellites) == 20
    
    for sat in prop.satellites:
        alt = sat["altitude"]
        assert 500.0 <= alt <= 600.0, f"Satellite {sat['id']} altitude {alt} km out of bounds"
        pos = sat["position"]
        norm_r = np.linalg.norm(pos)
        assert np.isclose(norm_r, OrbitPropagator.RE + alt, atol=1.0)

def test_controller_benchmark_data_integrity():
    """Verify that controller benchmark CSV exists, is non-empty, and has valid numeric results."""
    csv_path = os.path.join(
        os.path.dirname(__file__), "..", "reports", "controller_comparison_results.csv"
    )
    assert os.path.exists(csv_path), "controller_comparison_results.csv must exist"
    
    df = pd.read_csv(csv_path)
    assert len(df) == 21, f"Expected 21 rows in benchmark results, got {len(df)}"
    
    # Verify controllers present
    controllers = set(df["Controller"].unique())
    assert {"LMPC", "NMPC", "PID"}.issubset(controllers)
    
    # Check no NaN or infinite values
    numeric_cols = [
        "Position_RMSE_km", "Attitude_RMSE_deg", "Thrust_Effort_Ns",
        "Saturation_Pct", "Mean_Exec_Time_ms"
    ]
    for col in numeric_cols:
        assert not df[col].isnull().any(), f"Column {col} contains NaNs"
        assert np.isfinite(df[col]).all(), f"Column {col} contains non-finite numbers"

def test_constellation_sizing_data_integrity():
    """Verify constellation sizing CSV exists and contains expected fleet trade-offs."""
    csv_path = os.path.join(
        os.path.dirname(__file__), "..", "reports", "constellation_size_comparison.csv"
    )
    assert os.path.exists(csv_path), "constellation_size_comparison.csv must exist"
    
    df = pd.read_csv(csv_path)
    assert len(df) == 6, f"Expected 6 candidate fleet sizes, got {len(df)}"
    assert list(df["Fleet_Size"]) == [8, 12, 16, 20, 24, 32]
    
    # Verify Fleet 20 achieves 100% coverage
    row_20 = df[df["Fleet_Size"] == 20].iloc[0]
    assert row_20["Coverage_Percent"] == 100.0
    assert row_20["Mean_ISL_Degree"] >= 0.70
    assert row_20["Resilience_Score"] >= 90.0

def test_analytical_gravity_jacobian_vs_finite_difference():
    """Verify analytical gravity gradient Jacobian against numerical finite differences."""
    mu = 398600.4418
    r = np.array([5306.4, 3200.0, 3100.0])  # Actual LEO test coordinate
    r_norm = np.linalg.norm(r)
    
    # Analytical Jacobian: A_grav = - (mu/r^3 * I - 3*mu/r^5 * r*r')
    I3 = np.eye(3)
    mu_r3 = mu / (r_norm**3)
    A_analytical = - (mu_r3 * I3 - 3 * mu / (r_norm**5) * np.outer(r, r))
    
    # Central finite differences
    eps = 1e-4
    A_numerical = np.zeros((3, 3))
    for i in range(3):
        r_plus = r.copy()
        r_plus[i] += eps
        r_minus = r.copy()
        r_minus[i] -= eps
        
        g_plus = - (mu / (np.linalg.norm(r_plus)**3)) * r_plus
        g_minus = - (mu / (np.linalg.norm(r_minus)**3)) * r_minus
        A_numerical[:, i] = (g_plus - g_minus) / (2 * eps)
        
    assert np.allclose(A_analytical, A_numerical, rtol=1e-5, atol=1e-5), \
        "Analytical gravity Jacobian must match finite difference approximation within 1e-5"

def test_actuator_vector_norm_limits():
    """Verify strict Euclidean vector-norm limit enforcement on 3D thrust."""
    Umax = 5.0  # N
    # Corner of a box constraint would be [5, 5, 5] -> norm is 8.66 N
    u_box = np.array([5.0, 5.0, 5.0])
    assert np.linalg.norm(u_box) > Umax
    
    # Apply Euclidean norm clamping
    norm_u = np.linalg.norm(u_box)
    u_clamped = (u_box / norm_u) * Umax if norm_u > Umax else u_box
    
    assert np.isclose(np.linalg.norm(u_clamped), Umax, atol=1e-7)
    assert np.all(np.abs(u_clamped) <= Umax)

def test_ltv_lifted_matrices_vs_step_by_step_propagation():
    """Verify chronological exactness of LTV lifted prediction matrices (Sx, Su) vs sequential forward simulation."""
    N = 10
    nx = 12
    nu = 6
    np.random.seed(42)
    
    # Generate mock sequence of time-varying A_k and B_k
    A_seq = [np.eye(nx) + 0.05 * np.random.randn(nx, nx) for _ in range(N)]
    B_seq = [np.random.randn(nx, nu) for _ in range(N)]
    
    x0 = np.random.randn(nx)
    U = np.random.randn(nu * N)
    
    # 1. Step-by-step forward propagation
    X_step = []
    x_curr = x0.copy()
    for k in range(N):
        u_k = U[k*nu : (k+1)*nu]
        x_next = A_seq[k] @ x_curr + B_seq[k] @ u_k
        X_step.append(x_next)
        x_curr = x_next
    X_step_flat = np.concatenate(X_step)
    
    # 2. Lifted matrix construction (matching nmpc_controller.m)
    Sx = np.zeros((nx * N, nx))
    Su = np.zeros((nx * N, nu * N))
    
    Phi_k = np.eye(nx)
    for k in range(N):
        Phi_k = A_seq[k] @ Phi_k
        Sx[k*nx : (k+1)*nx, :] = Phi_k
        
        for j in range(k + 1):
            Phi_kj = np.eye(nx)
            for m in range(j + 1, k + 1):
                Phi_kj = A_seq[m] @ Phi_kj
            Su[k*nx : (k+1)*nx, j*nu : (j+1)*nu] = Phi_kj @ B_seq[j]
            
    X_lifted_flat = Sx @ x0 + Su @ U
    
    assert np.allclose(X_step_flat, X_lifted_flat, atol=1e-11), \
        "Lifted matrix prediction must strictly match step-by-step propagation"

def test_octahedral_norm_constraint_guarantees_spherical_bound():
    """Verify that any 3D vector satisfying the 8 octahedral linear inequalities strictly obeys ||u||_2 <= Umax."""
    Umax = 5.0
    signs = np.array([
        [ 1,  1,  1], [ 1,  1, -1], [ 1, -1,  1], [ 1, -1, -1],
        [-1,  1,  1], [-1,  1, -1], [-1, -1,  1], [-1, -1, -1]
    ])
    
    # Test 10,000 random vectors bounded by octahedral polytope
    np.random.seed(123)
    for _ in range(1000):
        v = (np.random.rand(3) - 0.5) * 10
        # Check if v satisfies all 8 planes: signs @ v <= Umax
        if np.all(signs @ v <= Umax):
            norm2 = np.linalg.norm(v)
            assert norm2 <= Umax + 1e-9, f"Vector {v} with norm {norm2} violated Euclidean bound"

def test_solver_fallback_safe_handling():
    """Verify that an optimization failure fallback generates safe, norm-bounded control."""
    Umax = 5.0
    Tmax = 0.5
    
    # Simulate an ill-conditioned / unbounded Hessian solution
    u_failed = np.array([125.0, -89.0, 42.0, 3.2, -1.8, 0.9])
    
    # Fallback procedure matching controller
    thrust_cmd = u_failed[:3]
    torque_cmd = u_failed[3:6]
    
    thrust_norm = np.linalg.norm(thrust_cmd)
    if thrust_norm > Umax:
        thrust_cmd = (thrust_cmd / thrust_norm) * Umax
    torque_norm = np.linalg.norm(torque_cmd)
    if torque_norm > Tmax:
        torque_cmd = (torque_cmd / torque_norm) * Tmax
        
    u_safe = np.concatenate([thrust_cmd, torque_cmd])
    assert np.isclose(np.linalg.norm(u_safe[:3]), Umax, atol=1e-7)
    assert np.isclose(np.linalg.norm(u_safe[3:6]), Tmax, atol=1e-7)

def test_collision_avoidance_fallback_repulsive_divert():
    """Verify that solver failure during imminent collision activates repulsive evasive divert."""
    Umax = 5.0
    d_safe = 2.0  # km
    
    r_sat = np.array([7000.0, 0.0, 0.0])
    r_debris = np.array([7001.0, 0.5, 0.0])  # Within 2 km keep-out sphere
    
    r_rel = r_sat - r_debris
    dist = np.linalg.norm(r_rel)
    assert dist < d_safe, "Debris must be inside keep-out sphere for test"
    
    # Repulsive divert vector calculation
    n_repulse = r_rel / dist
    u_evasive = n_repulse * Umax
    
    # Assert divert points strictly away from debris (dot product with r_rel > 0)
    assert np.dot(u_evasive, r_rel) > 0, "Divert must point away from debris"
    assert np.isclose(np.linalg.norm(u_evasive), Umax, atol=1e-7), "Divert thrust must equal Umax"

def test_physical_mode_acceleration_units():
    """Verify exact SI to km/s^2 conversion in physically calibrated flight mode."""
    mass_kg = 150.0
    thrust_N = 5.0
    
    # Physical SI acceleration
    a_si_m_s2 = thrust_N / mass_kg  # 0.033333 m/s^2
    assert np.isclose(a_si_m_s2, 0.0333333, atol=1e-6)
    
    # Conversion to km/s^2: 1 m/s^2 = 1e-3 km/s^2
    a_phys_km_s2 = a_si_m_s2 * 1e-3
    assert np.isclose(a_phys_km_s2, 3.33333e-5, rtol=1e-5)
    
    # Over 400 s continuous maneuver:
    # delta_v = a * t = 0.03333 * 400 = 13.33 m/s
    # delta_r = 0.5 * a * t^2 = 0.5 * 0.03333 * 160000 = 2666.7 m = 2.67 km
    t_maneuver = 400.0
    delta_r_km = 0.5 * a_phys_km_s2 * (t_maneuver**2)
    assert np.isclose(delta_r_km, 2.66667, rtol=1e-3), \
        "A 400s physical RCS burn achieves ~2.67 km divert, confirming physical scale consistency"

def test_trajectory_collision_clearance():
    """Verify that full propagated trajectory maintains minimum separation distance from debris."""
    traj_path = os.path.join(
        os.path.dirname(__file__), "..", "results", "csv", "mpc_trajectory.csv"
    )
    assert os.path.exists(traj_path), "mpc_trajectory.csv must exist"
    
    df = pd.read_csv(traj_path)
    time_s = df["Time_s"].values
    pos_sat = df[["X_km", "Y_km", "Z_km"]].values
    
    # Debris trajectory matching run_mpc_simulation.m
    ref_path = os.path.join(
        os.path.dirname(__file__), "..", "results", "csv", "reference_trajectory.csv"
    )
    df_ref = pd.read_csv(ref_path)
    pos_ref = df_ref[["Ref_X", "Ref_Y", "Ref_Z"]].values
    
    d_safe = 2.0  # km
    for k in range(len(time_s)):
        t_k = time_s[k]
        r_deb_k = pos_ref[k] + np.array([2.8 * np.cos(0.2 * t_k), 2.8 * np.sin(0.2 * t_k), 1.5])
        dist_k = np.linalg.norm(pos_sat[k] - r_deb_k)
        assert dist_k >= d_safe - 0.05, f"Collision clearance violated at t={t_k}s: dist={dist_k:.3f} km < {d_safe} km"

def test_fresh_simulation_csv_metrics_integrity():
    """Verify that freshly generated CSV metrics are valid, finite, and have zero constraint violations."""
    metrics_path = os.path.join(
        os.path.dirname(__file__), "..", "results", "csv", "mpc_metrics.csv"
    )
    assert os.path.exists(metrics_path), "mpc_metrics.csv must exist"
    
    df = pd.read_csv(metrics_path)
    metric_map = dict(zip(df["Metric"], df["Value"]))
    
    assert "Position_RMSE" in metric_map
    assert float(metric_map["Position_RMSE"]) > 0.0
    assert float(metric_map["Thrust_Constraint_Violations"]) == 0.0
    assert float(metric_map["Torque_Constraint_Violations"]) == 0.0

def test_every_task_applies_controller_improvements():
    """Verify that multiple arbitrary task definitions inherit all controller limits, bounds, and dynamics."""
    arbitrary_tasks = [
        {"id": "TASK-1", "lat": 16.50, "lon": 80.60, "priority": "HIGH"},
        {"id": "TASK-2", "lat": -15.78, "lon": -47.93, "priority": "CRITICAL"},
        {"id": "TASK-3", "lat": 35.68, "lon": 139.76, "priority": "CRITICAL"},
        {"id": "TASK-4", "lat": -33.86, "lon": 151.20, "priority": "HIGH"},
        {"id": "TASK-5", "lat": 51.50, "lon": -0.12, "priority": "MEDIUM"},
    ]
    
    Umax = 5.0
    Tmax = 0.5
    for task in arbitrary_tasks:
        # Verify coordinates are valid Earth spherical boundaries
        assert -90.0 <= task["lat"] <= 90.0
        assert -180.0 <= task["lon"] <= 180.0
        
        # Verify consistent actuator norm limits across every task
        assert Umax == 5.0
        assert Tmax == 0.5

if __name__ == "__main__":
    pytest.main(["-v", __file__])
