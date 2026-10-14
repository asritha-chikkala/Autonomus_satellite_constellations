function updated_sat = telemetry_update(sat, u, dt, is_sunlit, has_fault, cfg)
% TELEMETRY_UPDATE - Advances 6-DOF satellite state using Runge-Kutta 4 (RK4)
% and updates all subsystems (battery, health, geographic coordinates).

if nargin < 6
    cfg = config();
end

% Current 12-DOF state
x0 = [
    sat.position(:);
    sat.velocity(:);
    sat.attitude(:);
    sat.angular_velocity(:)
];

% Runge-Kutta 4th Order numerical integration
k1 = satellite_dynamics(0, x0, u, cfg);
k2 = satellite_dynamics(dt/2, x0 + 0.5 * dt * k1, u, cfg);
k3 = satellite_dynamics(dt/2, x0 + 0.5 * dt * k2, u, cfg);
k4 = satellite_dynamics(dt, x0 + dt * k3, u, cfg);

x_next = x0 + (dt / 6) * (k1 + 2*k2 + 2*k3 + k4);

% Update satellite structure
updated_sat = sat;
updated_sat.position = x_next(1:3);
updated_sat.velocity = x_next(4:6);
updated_sat.attitude = x_next(7:9);
updated_sat.angular_velocity = x_next(10:12);

% Subsystem updates
thrust_mag = norm(u(1:3));
control_effort = thrust_mag + norm(u(4:6));

updated_sat.battery = battery_model(sat.battery, thrust_mag, sat.active_links, is_sunlit, dt, cfg);
[updated_sat.health, updated_sat.risk, updated_sat.failure_prob] = health_model(...
    sat.health, updated_sat.battery, control_effort, has_fault, dt, cfg);

% Geographic spherical coordinates update
r_norm = norm(updated_sat.position);
updated_sat.altitude = r_norm - cfg.Re;
updated_sat.latitude = asind(updated_sat.position(3) / r_norm);
updated_sat.longitude = atan2d(updated_sat.position(2), updated_sat.position(1));

end
