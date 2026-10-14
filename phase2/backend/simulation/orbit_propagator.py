import numpy as np
import math
from typing import List, Dict, Any

class OrbitPropagator:
    """
    6-DOF Orbit Propagator & Subsystem Simulator.
    Simulates Keplerian orbital mechanics, Earth J2 perturbation,
    battery SoC degradation/recharge, and health/risk dynamics.
    """
    MU = 398600.4418  # km^3 / s^2
    RE = 6378.137     # km
    J2 = 1.08263e-3
    OMEGA_EARTH = 7.2921159e-5 # rad/s

    def __init__(self):
        self.sim_time = 0.0 # Elapsed simulation seconds
        self.epoch_utc = "2026-10-10T12:00:00Z" # Reference epoch
        self.satellites = self._create_initial_constellation()
        self.space_station = self._create_space_station()

    def _create_initial_constellation(self) -> List[Dict[str, Any]]:
        num_sats = 20
        inclinations = [53.0, 64.0, 78.0, 97.5] * 5
        raan_list = [0.0, 72.0, 144.0, 216.0, 288.0, 45.0, 117.0, 189.0, 261.0, 333.0,
                     90.0, 162.0, 234.0, 306.0, 18.0, 135.0, 207.0, 279.0, 351.0, 63.0]
        mean_anom = [15.0, 87.0, 159.0, 231.0, 303.0, 30.0, 102.0, 174.0, 246.0, 318.0,
                     45.0, 117.0, 189.0, 261.0, 333.0, 60.0, 132.0, 204.0, 276.0, 348.0]
        altitudes = [540.0 + 5.0 * (i % 6) for i in range(num_sats)]
        
        init_batt = [87.5, 63.2, 92.0, 45.5, 78.0, 82.5, 69.0, 94.0, 88.0, 74.5,
                     91.0, 84.0, 77.5, 89.0, 62.0, 95.0, 79.0, 85.0, 71.0, 90.5]
        init_health = [0.98, 0.91, 0.99, 0.82, 0.95, 0.97, 0.89, 0.99, 0.96, 0.93,
                       0.98, 0.95, 0.92, 0.97, 0.88, 0.99, 0.94, 0.96, 0.91, 0.98]
        init_risk = [0.12, 0.21, 0.08, 0.38, 0.15, 0.11, 0.24, 0.07, 0.10, 0.16,
                     0.09, 0.12, 0.18, 0.09, 0.25, 0.06, 0.14, 0.11, 0.22, 0.08]

        sats = []
        for i in range(num_sats):
            sat_id = f"SAT-{i+1:02d}"
            a = self.RE + altitudes[i]
            inc = math.radians(inclinations[i])
            raan = math.radians(raan_list[i])
            nu = math.radians(mean_anom[i])
            
            # Position & velocity in orbital plane
            r_orb = np.array([a * math.cos(nu), a * math.sin(nu), 0.0])
            v_mag = math.sqrt(self.MU / a)
            v_orb = np.array([-v_mag * math.sin(nu), v_mag * math.cos(nu), 0.0])
            
            # Rotation matrices to ECI
            R_raan = np.array([
                [math.cos(raan), -math.sin(raan), 0],
                [math.sin(raan),  math.cos(raan), 0],
                [0, 0, 1]
            ])
            R_inc = np.array([
                [1, 0, 0],
                [0, math.cos(inc), -math.sin(inc)],
                [0, math.sin(inc),  math.cos(inc)]
            ])
            R_tot = R_raan @ R_inc
            
            pos = R_tot @ r_orb
            vel = R_tot @ v_orb
            
            r_norm = np.linalg.norm(pos)
            lat = math.degrees(math.asin(pos[2] / r_norm))
            lon = math.degrees(math.atan2(pos[1], pos[0]))
            
            sat = {
                "id": sat_id,
                "index": i + 1,
                "position": pos.tolist(),
                "velocity": vel.tolist(),
                "altitude": float(r_norm - self.RE),
                "latitude": float(lat),
                "longitude": float(lon),
                "attitude": [0.01 * math.sin(i), 0.02 * math.cos(i), 0.05 * i],
                "angular_velocity": [0.001, -0.002, 0.001],
                "battery": float(init_batt[i]),
                "health": float(init_health[i]),
                "risk": float(init_risk[i]),
                "failure_prob": float(init_risk[i] * 0.8),
                "current_task": "IDLE",
                "status": "AVAILABLE",
                "active_links": 0,
                "neighbors": [],
                "is_faulty": False,
                "in_eclipse": False,
                "power_state": "SOLAR_CHARGING",
                "telemetry_history": [
                    [float(max(5.0, init_batt[i] - 0.02 * (9 - k)) / 100.0),
                     float(init_health[i]),
                     0.05,
                     float(init_risk[i]),
                     float(init_risk[i] * 0.8)]
                    for k in range(10)
                ]
            }
            sats.append(sat)
            
        return sats

    def _create_space_station(self) -> Dict[str, Any]:
        iss_alt = 415.0
        iss_r = self.RE + iss_alt
        iss_inc = math.radians(51.6)
        iss_raan = math.radians(300.0)
        iss_nu = math.radians(150.0)
        
        r_orb = np.array([iss_r * math.cos(iss_nu), iss_r * math.sin(iss_nu), 0.0])
        v_mag = math.sqrt(self.MU / iss_r)
        v_orb = np.array([-v_mag * math.sin(iss_nu), v_mag * math.cos(iss_nu), 0.0])
        
        R_tot = np.array([
            [math.cos(iss_raan), -math.sin(iss_raan), 0],
            [math.sin(iss_raan),  math.cos(iss_raan), 0],
            [0, 0, 1]
        ]) @ np.array([
            [1, 0, 0],
            [0, math.cos(iss_inc), -math.sin(iss_inc)],
            [0, math.sin(iss_inc),  math.cos(iss_inc)]
        ])
        
        pos = R_tot @ r_orb
        vel = R_tot @ v_orb
        r_norm = np.linalg.norm(pos)
        
        return {
            "id": "ISS-01",
            "name": "International Space Station",
            "position": pos.tolist(),
            "velocity": vel.tolist(),
            "altitude": iss_alt,
            "latitude": float(math.degrees(math.asin(pos[2] / r_norm))),
            "longitude": float(math.degrees(math.atan2(pos[1], pos[0]))),
            "battery": 99.5,
            "health": 1.0,
            "risk": 0.01,
            "current_task": "ORBITAL_STATION",
            "status": "ACTIVE_INFRASTRUCTURE"
        }

    def is_in_eclipse(self, pos: np.ndarray, sun_vec: np.ndarray = np.array([1.0, 0.0, 0.0])) -> bool:
        """Determines whether satellite is in Earth's cylindrical umbral shadow cylinder"""
        proj = float(np.dot(pos, sun_vec))
        if proj >= 0:
            return False  # Sunlit hemisphere
        perp_dist = float(np.linalg.norm(pos - proj * sun_vec))
        return perp_dist < self.RE  # Inside Earth shadow


    def eci_to_ecef(self, pos_eci: np.ndarray, t_sec: float) -> np.ndarray:
        """Transforms ECI coordinates to ECEF accounting for Earth sidereal rotation"""
        theta = (self.OMEGA_EARTH * t_sec) % (2.0 * math.pi)
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        # R_z(theta)
        return np.array([
            cos_t * pos_eci[0] + sin_t * pos_eci[1],
            -sin_t * pos_eci[0] + cos_t * pos_eci[1],
            pos_eci[2]
        ])

    def ecef_to_latlon(self, pos_ecef: np.ndarray) -> tuple[float, float, float]:
        """Calculates geocentric latitude, longitude [-180, 180] deg, and altitude [km]"""
        r_norm = float(np.linalg.norm(pos_ecef))
        lat = math.degrees(math.asin(max(-1.0, min(1.0, pos_ecef[2] / r_norm))))
        lon = math.degrees(math.atan2(pos_ecef[1], pos_ecef[0]))
        alt = r_norm - self.RE
        return lat, lon, alt

    def propagate_step(self, dt: float = 0.5):
        """Propagate all satellites by dt seconds using 3-DOF Newton-Euler dynamics with J2 and ECEF ground track"""
        self.sim_time += dt
        for sat in self.satellites:
            pos = np.array(sat["position"])
            vel = np.array(sat["velocity"])
            
            r_norm = np.linalg.norm(pos)
            # Keplerian gravity
            a_grav = - (self.MU / (r_norm**3)) * pos
            
            # J2 perturbation
            z2_r2 = (pos[2] / r_norm)**2
            factor_j2 = 1.5 * self.J2 * (self.MU * self.RE**2) / (r_norm**5)
            a_j2 = factor_j2 * np.array([
                pos[0] * (5 * z2_r2 - 1),
                pos[1] * (5 * z2_r2 - 1),
                pos[2] * (5 * z2_r2 - 3)
            ])
            
            a_tot = a_grav + a_j2
            
            # Velocity Verlet / Euler integration
            new_vel = vel + a_tot * dt
            new_pos = pos + new_vel * dt
            
            # True ECEF ground coordinates
            pos_ecef = self.eci_to_ecef(new_pos, self.sim_time)
            lat, lon, alt = self.ecef_to_latlon(pos_ecef)
            
            sat["position"] = new_pos.tolist()
            sat["position_ecef"] = pos_ecef.tolist()
            sat["velocity"] = new_vel.tolist()
            sat["altitude"] = float(alt)
            sat["latitude"] = float(lat)
            sat["longitude"] = float(lon)
            
            # Astrodynamics Sun-Occultation & Solar Power Cycling (Umbra/Penumbra)
            in_eclipse = self.is_in_eclipse(new_pos)
            sat["in_eclipse"] = in_eclipse
            if in_eclipse:
                sat["power_state"] = "ECLIPSE_DISCHARGING"
                discharge_rate = 0.25 if sat["is_faulty"] else 0.05
                sat["battery"] = float(max(5.0, sat["battery"] - discharge_rate * dt))
            else:
                sat["power_state"] = "SOLAR_CHARGING"
                charge_rate = 0.08
                sat["battery"] = float(min(100.0, sat["battery"] + charge_rate * dt))

            if sat["is_faulty"]:
                sat["health"] = max(0.1, sat["health"] - 0.01 * dt)
                sat["risk"] = min(0.99, sat["risk"] + 0.02 * dt)
                sat["failure_prob"] = min(0.99, 1.0 / (1.0 + math.exp(-8.0 * (sat["risk"] - 0.45))))
            else:
                sat["health"] = max(0.2, sat["health"] - 0.00002 * dt)

            # Record continuous temporal telemetry history for LSTM time-series forecast
            delta_batt = discharge_rate if in_eclipse else -charge_rate
            hist_entry = [
                float(sat["battery"] / 100.0),
                float(sat["health"]),
                float(delta_batt),
                float(sat["risk"]),
                float(sat["failure_prob"])
            ]
            if "telemetry_history" not in sat or not isinstance(sat["telemetry_history"], list):
                sat["telemetry_history"] = []
            sat["telemetry_history"].append(hist_entry)
            if len(sat["telemetry_history"]) > 10:
                sat["telemetry_history"].pop(0)

        # Propagate space station
        iss_pos = np.array(self.space_station["position"])
        iss_vel = np.array(self.space_station["velocity"])
        r_norm = np.linalg.norm(iss_pos)
        a_iss = - (self.MU / (r_norm**3)) * iss_pos
        new_iss_vel = iss_vel + a_iss * dt
        new_iss_pos = iss_pos + new_iss_vel * dt
        
        iss_ecef = self.eci_to_ecef(new_iss_pos, self.sim_time)
        iss_lat, iss_lon, iss_alt = self.ecef_to_latlon(iss_ecef)
        
        self.space_station["position"] = new_iss_pos.tolist()
        self.space_station["position_ecef"] = iss_ecef.tolist()
        self.space_station["velocity"] = new_iss_vel.tolist()
        self.space_station["altitude"] = float(iss_alt)
        self.space_station["latitude"] = float(iss_lat)
        self.space_station["longitude"] = float(iss_lon)
