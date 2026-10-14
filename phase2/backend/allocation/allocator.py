import time
import math
import numpy as np
from scipy.optimize import linear_sum_assignment
from typing import List, Dict, Any, Tuple

class ConstellationAllocator:
    """
    Multi-Agent Task Allocation Engine.
    Implements:
      1. Architecture Cost Matrix: C(i,j) = alpha*Distance + beta*Risk - gamma*Battery + delta*Delay
         with alpha=0.40, beta=0.25, gamma=0.25, delta=0.10.
      2. Hungarian Algorithm (Optimal Kuhn-Munkres)
      3. Auction Algorithm (Distributed Bertsekas)
      4. Greedy Algorithm (Fast heuristic)
    """
    def __init__(self, alpha: float = 0.40, beta: float = 0.25, gamma: float = 0.25, delta: float = 0.10):
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.delta = delta
        self.re_earth = 6378.137

    def compute_cost_matrix(self, satellites: List[Dict[str, Any]], targets: List[Dict[str, Any]]) -> Tuple[np.ndarray, List[List[Dict[str, Any]]]]:
        num_sats = len(satellites)
        num_targets = len(targets)
        
        # Convert targets to Cartesian coordinates
        target_positions = []
        for t in targets:
            t_lat = math.radians(t.get("latitude", 0.0))
            t_lon = math.radians(t.get("longitude", 0.0))
            t_alt = t.get("altitude", 0.0)
            r_tgt = self.re_earth + t_alt
            x = r_tgt * math.cos(t_lat) * math.cos(t_lon)
            y = r_tgt * math.cos(t_lat) * math.sin(t_lon)
            z = r_tgt * math.sin(t_lat)
            target_positions.append(np.array([x, y, z]))

        dist_raw = np.zeros((num_sats, num_targets))
        delay_raw = np.zeros((num_sats, num_targets))
        
        for i in range(num_sats):
            r_sat = np.array(satellites[i]["position"])
            v_sat = np.array(satellites[i]["velocity"])
            v_mag = np.linalg.norm(v_sat)
            r_mag = np.linalg.norm(r_sat)
            ang_spd = max(1e-4, v_mag / r_mag)
            
            for j in range(num_targets):
                r_tgt = target_positions[j]
                d = float(np.linalg.norm(r_sat - r_tgt))
                dist_raw[i, j] = d
                
                # Approximate angle difference to observation zenith
                dot_prod = max(-1.0, min(1.0, float(np.dot(r_sat / r_mag, r_tgt / np.linalg.norm(r_tgt)))))
                angle_diff = math.acos(dot_prod)
                delay_raw[i, j] = angle_diff / ang_spd

        max_dist = max(float(np.max(dist_raw)), 1.0)
        max_delay = max(float(np.max(delay_raw)), 1.0)

        C = np.zeros((num_sats, num_targets))
        details = []

        for i in range(num_sats):
            row_details = []
            b_norm = satellites[i]["battery"] / 100.0
            r_norm = max(0.0, min(1.0, satellites[i]["risk"]))
            is_unhealthy = (satellites[i]["battery"] < 18.0) or (satellites[i]["health"] < 0.35) or satellites[i].get("is_faulty", False)
            
            for j in range(num_targets):
                d_norm = dist_raw[i, j] / max_dist
                tau_norm = delay_raw[i, j] / max_delay
                
                # Required Cost Matrix Formula:
                cost_val = (self.alpha * d_norm + 
                            self.beta  * r_norm - 
                            self.gamma * b_norm + 
                            self.delta * tau_norm)
                            
                cost_pos = cost_val + self.gamma
                if is_unhealthy:
                    cost_pos += 15.0 # Unavailability penalty
                    
                C[i, j] = round(cost_pos, 4)
                
                row_details.append({
                    "satellite_id": satellites[i]["id"],
                    "target_index": j + 1,
                    "distance_km": round(dist_raw[i, j], 1),
                    "normalized_distance": round(d_norm, 3),
                    "risk": round(r_norm, 3),
                    "battery": round(satellites[i]["battery"], 1),
                    "delay_sec": round(delay_raw[i, j], 1),
                    "total_cost": round(cost_pos, 4)
                })
            details.append(row_details)

        return C, details

    def run_hungarian(self, C: np.ndarray) -> Tuple[List[int], float, float]:
        t0 = time.perf_counter()
        row_ind, col_ind = linear_sum_assignment(C)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        
        # Sort assignment by target columns (col_ind = 0, 1, ...)
        assignment = [0] * C.shape[1]
        total_cost = 0.0
        for r, c in zip(row_ind, col_ind):
            if c < C.shape[1]:
                assignment[c] = int(r)
                total_cost += C[r, c]
        return assignment, float(round(total_cost, 4)), float(round(elapsed_ms, 3))

    def run_auction(self, C: np.ndarray, epsilon: float = 0.005) -> Tuple[List[int], float, float]:
        t0 = time.perf_counter()
        num_sats, num_targets = C.shape
        max_c = float(np.max(C))
        values = max_c - C
        
        prices = np.zeros(num_targets)
        target_owner = np.zeros(num_targets, dtype=int) - 1
        sat_assigned = np.zeros(num_sats, dtype=int) - 1
        
        max_iter = 400
        for _ in range(max_iter):
            unassigned = np.where(sat_assigned == -1)[0]
            if len(unassigned) == 0:
                break
            i = unassigned[0]
            net_vals = values[i, :] - prices
            sorted_idx = np.argsort(-net_vals)
            best_j = sorted_idx[0]
            best_v = net_vals[best_j]
            second_v = net_vals[sorted_idx[1]] if len(sorted_idx) > 1 else 0.0
            bid_inc = (best_v - second_v) + epsilon
            
            prev = target_owner[best_j]
            if prev != -1:
                sat_assigned[prev] = -1
            target_owner[best_j] = i
            sat_assigned[i] = best_j
            prices[best_j] += bid_inc

        elapsed_ms = (time.perf_counter() - t0) * 1000
        assignment = target_owner.tolist()
        total_cost = sum(C[assignment[j], j] for j in range(num_targets))
        return assignment, float(round(total_cost, 4)), float(round(elapsed_ms, 3))

    def run_greedy(self, C: np.ndarray) -> Tuple[List[int], float, float]:
        t0 = time.perf_counter()
        num_sats, num_targets = C.shape
        assignment = []
        used_sats = set()
        total_cost = 0.0

        for j in range(num_targets):
            best_sat = -1
            best_val = float('inf')
            for i in range(num_sats):
                if i not in used_sats and C[i, j] < best_val:
                    best_val = C[i, j]
                    best_sat = i
            if best_sat == -1: # fallback
                best_sat = int(np.argmin(C[:, j]))
            assignment.append(best_sat)
            used_sats.add(best_sat)
            total_cost += C[best_sat, j]

        elapsed_ms = (time.perf_counter() - t0) * 1000
        return assignment, float(round(total_cost, 4)), float(round(elapsed_ms, 3))

    def allocate(self, satellites: List[Dict[str, Any]], targets: List[Dict[str, Any]]) -> Dict[str, Any]:
        C, details = self.compute_cost_matrix(satellites, targets)
        
        h_assign, h_cost, h_time = self.run_hungarian(C)
        a_assign, a_cost, a_time = self.run_auction(C)
        g_assign, g_cost, g_time = self.run_greedy(C)

        num_targets = len(targets)
        def calc_metrics(assign, cost, t_ms):
            tot_dist = sum(details[assign[j]][j]["distance_km"] for j in range(num_targets))
            avg_batt = np.mean([satellites[assign[j]]["battery"] for j in range(num_targets)])
            avg_risk = np.mean([satellites[assign[j]]["risk"] for j in range(num_targets)])
            energy = tot_dist * 0.0005 + (100 - avg_batt) * 0.05
            success_rate = float(np.mean([max(60.0, 100.0 * (1.0 - satellites[assign[j]]["failure_prob"])) for j in range(num_targets)]))
            return {
                "assignment": assign,
                "assigned_satellite_id": satellites[assign[0]]["id"],
                "total_cost": round(cost, 4),
                "exec_time_ms": round(t_ms, 3),
                "distance_km": round(tot_dist, 1),
                "energy_usage": round(energy, 2),
                "success_rate": round(success_rate, 1)
            }

        m_hungarian = calc_metrics(h_assign, h_cost, h_time)
        m_auction = calc_metrics(a_assign, a_cost, a_time)
        m_greedy = calc_metrics(g_assign, g_cost, g_time)

        # Select Hungarian by default as lowest optimal cost
        selected_sat_idx = h_assign[0]
        selected_satellite = satellites[selected_sat_idx]

        return {
            "cost_matrix": C.tolist(),
            "cost_details": details,
            "selected_satellite": selected_satellite,
            "selected_strategy": "Hungarian",
            "selection_reason": "Lowest global allocation cost and guaranteed Pareto-optimal bipartite matching",
            "hungarian": m_hungarian,
            "auction": m_auction,
            "greedy": m_greedy
        }
