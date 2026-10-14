import numpy as np
import math
from typing import List, Dict, Any, Tuple

class CommunicationGraphManager:
    """
    Computes dynamic inter-satellite communication graph topology:
      A(t) = f(Line-of-Sight, Distance, Link Quality)
    Also generates multi-agent negotiation telemetry dialogues.
    """
    def __init__(self, max_comm_distance: float = 3500.0, re_earth: float = 6378.137, los_buffer: float = 50.0):
        self.max_comm_distance = max_comm_distance
        self.re_effective = re_earth + los_buffer

    def compute_topology(self, satellites: List[Dict[str, Any]]) -> Dict[str, Any]:
        num_sats = len(satellites)
        adj_matrix = np.zeros((num_sats, num_sats), dtype=int)
        link_qualities = np.zeros((num_sats, num_sats), dtype=float)
        distances = np.zeros((num_sats, num_sats), dtype=float)
        active_links = []

        for i in range(num_sats):
            r_i = np.array(satellites[i]["position"])
            for j in range(i + 1, num_sats):
                r_j = np.array(satellites[j]["position"])
                d_ij = float(np.linalg.norm(r_i - r_j))
                distances[i, j] = distances[j, i] = d_ij

                # Line-of-sight sphere intersection test
                r_ij = r_j - r_i
                norm_rij_sq = float(np.dot(r_ij, r_ij))
                if norm_rij_sq > 0:
                    t_star = - float(np.dot(r_i, r_ij)) / norm_rij_sq
                else:
                    t_star = -1.0

                if 0.0 < t_star < 1.0:
                    closest_pt = r_i + t_star * r_ij
                    min_dist_to_center = float(np.linalg.norm(closest_pt))
                else:
                    min_dist_to_center = min(float(np.linalg.norm(r_i)), float(np.linalg.norm(r_j)))

                los_clear = (min_dist_to_center >= self.re_effective)

                # Link Quality evaluation
                if los_clear and (d_ij <= self.max_comm_distance):
                    dist_factor = (1.0 - (d_ij / self.max_comm_distance)) ** 1.5
                    health_factor = 0.5 * (satellites[i]["health"] + satellites[j]["health"])
                    risk_penalty = 1.0 - 0.3 * (satellites[i]["risk"] + satellites[j]["risk"])
                    
                    q_ij = float(max(0.0, min(1.0, dist_factor * health_factor * risk_penalty)))
                    link_qualities[i, j] = link_qualities[j, i] = q_ij

                    if q_ij >= 0.15:
                        adj_matrix[i, j] = adj_matrix[j, i] = 1
                        active_links.append({
                            "source": satellites[i]["id"],
                            "target": satellites[j]["id"],
                            "source_index": i,
                            "target_index": j,
                            "distance_km": round(d_ij, 1),
                            "link_quality": round(q_ij, 3)
                        })

        # Update satellite neighbor lists
        for i in range(num_sats):
            satellites[i]["active_links"] = int(np.sum(adj_matrix[i, :]))
            satellites[i]["neighbors"] = [
                satellites[j]["id"] for j in range(num_sats) if adj_matrix[i, j] == 1
            ]

        return {
            "adjacency_matrix": adj_matrix.tolist(),
            "link_qualities": link_qualities.tolist(),
            "distances": distances.tolist(),
            "active_links": active_links,
            "total_active_links": len(active_links)
        }

    def generate_negotiation_logs(self, satellites: List[Dict[str, Any]], active_links: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generates realistic algorithmic multi-agent negotiation telemetry dialogues"""
        logs = []
        for link in active_links[:6]:
            s_idx = link["source_index"]
            t_idx = link["target_index"]
            s_sat = satellites[s_idx]
            t_sat = satellites[t_idx]
            
            # Agent broadcast message
            logs.append({
                "from": s_sat["id"],
                "to": t_sat["id"],
                "content": f"STATUS_BEACON: Batt={s_sat['battery']:.1f}% | Risk={s_sat['risk']:.2f} | Dist={link['distance_km']:.0f}km | LQ={link['link_quality']:.2f}",
                "timestamp": "0.10s",
                "type": "BEACON"
            })
            
            # Multi-agent negotiation response
            if t_sat["battery"] > 60.0 and t_sat["risk"] < 0.25:
                reply = "BID_ACK: Ready for constellation task allocation. Payload operational."
                m_type = "BID_AVAILABLE"
            elif t_sat["battery"] <= 50.0 or t_sat["risk"] >= 0.30:
                reply = f"RESOURCE_WARNING: Low battery margin ({t_sat['battery']:.1f}%) or elevated risk ({t_sat['risk']:.2f}). Penalty applied."
                m_type = "HIGH_COST_ALERT"
            else:
                reply = "TELEMETRY_SYNC: Relay routing enabled. Link stability verified."
                m_type = "RELAY"
                
            logs.append({
                "from": t_sat["id"],
                "to": s_sat["id"],
                "content": reply,
                "timestamp": "0.15s",
                "type": m_type
            })
            
        return logs

    def find_shortest_route(self, src_idx: int, dst_idx: int, adj_matrix: Any, dist_matrix: Any) -> List[int]:
        """Dijkstra priority-queue shortest path routing algorithm through dynamic ISL constellation mesh"""
        import heapq
        if src_idx == dst_idx:
            return [src_idx]
        queue = [(0.0, src_idx, [src_idx])]
        visited = set()
        while queue:
            cost, current, path = heapq.heappop(queue)
            if current == dst_idx:
                return path
            if current in visited:
                continue
            visited.add(current)
            for neighbor, connected in enumerate(adj_matrix[current]):
                if connected and neighbor not in visited:
                    link_dist = dist_matrix[current][neighbor]
                    heapq.heappush(queue, (cost + link_dist, neighbor, path + [neighbor]))
        return []

    def find_multi_hop_route(self, src_id: str, dst_id: str, satellites: List[Dict[str, Any]]) -> List[str]:
        """Returns ordered list of satellite IDs along the optimal multi-hop ISL path"""
        sat_id_map = {s["id"]: idx for idx, s in enumerate(satellites)}
        if src_id not in sat_id_map or dst_id not in sat_id_map:
            return [src_id, dst_id]
        
        topo = self.compute_topology(satellites)
        adj = np.array(topo["adjacency_matrix"])
        dist = np.array(topo["distances"])
        
        idx_path = self.find_shortest_route(sat_id_map[src_id], sat_id_map[dst_id], adj, dist)
        if idx_path:
            return [satellites[i]["id"] for i in idx_path]
        return [src_id, dst_id]
