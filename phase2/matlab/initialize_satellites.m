function satellites = initialize_satellites(cfg)
% INITIALIZE_SATELLITES - Generates initial 6-DOF states, battery, health,
% and telemetry for 8 satellites in Walker-like constellation and 1 Space Station.

if nargin < 1
    cfg = config();
end

num_sats = cfg.num_satellites;
satellites = repmat(struct(), num_sats, 1);

% Define 20 satellites distributed in 4 orbital planes (5 sats per plane)
inclinations = repmat([53.0, 64.0, 78.0, 97.5], 1, 5); % degrees
raan_list = [
    0, 72, 144, 216, 288, ...
    45, 117, 189, 261, 333, ...
    90, 162, 234, 306, 18, ...
    135, 207, 279, 351, 63
]; % degrees
mean_anomalies = [
    15, 87, 159, 231, 303, ...
    30, 102, 174, 246, 318, ...
    45, 117, 189, 261, 333, ...
    60, 132, 204, 276, 348
]; % degrees
altitudes = 540 + 5 * mod(1:20, 6); % km

% Initial battery, health, and status for 20 satellites
init_batteries = [87.5, 63.2, 92.0, 45.5, 78.0, 82.5, 69.0, 94.0, 88.0, 74.5, ...
                  91.0, 84.0, 77.5, 89.0, 62.0, 95.0, 79.0, 85.0, 71.0, 90.5];
init_healths   = [0.98, 0.91, 0.99, 0.82, 0.95, 0.97, 0.89, 0.99, 0.96, 0.93, ...
                  0.98, 0.95, 0.92, 0.97, 0.88, 0.99, 0.94, 0.96, 0.91, 0.98];
init_risks     = [0.12, 0.21, 0.08, 0.38, 0.15, 0.11, 0.24, 0.07, 0.10, 0.16, ...
                  0.09, 0.12, 0.18, 0.09, 0.25, 0.06, 0.14, 0.11, 0.22, 0.08];

for i = 1:num_sats
    satellites(i).id = cfg.satellite_ids{i};
    satellites(i).index = i;
    
    % Orbital elements
    a = cfg.Re + altitudes(i);
    inc = deg2rad(inclinations(i));
    raan = deg2rad(raan_list(i));
    nu = deg2rad(mean_anomalies(i));
    
    % Convert to Cartesian position & velocity in ECI frame
    p = a * (1 - 0.001^2); % assume near-circular (e = 0.001)
    r_orb = [a * cos(nu); a * sin(nu); 0];
    v_mag = sqrt(cfg.mu / a);
    v_orb = [-v_mag * sin(nu); v_mag * cos(nu); 0];
    
    % Rotation matrix from orbital plane to ECI
    R_raan = [cos(raan) -sin(raan) 0; sin(raan) cos(raan) 0; 0 0 1];
    R_inc  = [1 0 0; 0 cos(inc) -sin(inc); 0 sin(inc) cos(inc)];
    R_total = R_raan * R_inc;
    
    satellites(i).position = R_total * r_orb; % [km]
    satellites(i).velocity = R_total * v_orb; % [km/s]
    
    % 3-DOF Attitude (roll, pitch, yaw) in radians
    satellites(i).attitude = deg2rad([0.5 * sin(i); 0.3 * cos(i); 0.1 * i]);
    % 3-DOF Angular velocity [rad/s]
    satellites(i).angular_velocity = [0.001 * cos(i); 0.001 * sin(i); 0.002];
    
    % Telemetry, health and state metrics
    satellites(i).battery = init_batteries(i);
    satellites(i).health = init_healths(i);
    satellites(i).risk = init_risks(i);
    satellites(i).failure_prob = init_risks(i) * 0.8;
    satellites(i).current_task = 'IDLE';
    satellites(i).status = 'AVAILABLE';
    satellites(i).neighbors = {};
    satellites(i).active_links = 0;
    
    % Geographic coordinates
    r_norm = norm(satellites(i).position);
    satellites(i).altitude = r_norm - cfg.Re;
    satellites(i).latitude = asind(satellites(i).position(3) / r_norm);
    satellites(i).longitude = atan2d(satellites(i).position(2), satellites(i).position(1));
end

% Secondary Object: International Space Station (ISS)
iss.id = 'ISS-01';
iss.index = 9;
iss_alt = 415.0; % km
iss_r = cfg.Re + iss_alt;
iss_inc = deg2rad(51.6);
iss_raan = deg2rad(300);
iss_nu = deg2rad(150);
R_iss = [cos(iss_raan) -sin(iss_raan) 0; sin(iss_raan) cos(iss_raan) 0; 0 0 1] * ...
        [1 0 0; 0 cos(iss_inc) -sin(iss_inc); 0 sin(iss_inc) cos(iss_inc)];
iss.position = R_iss * [iss_r * cos(iss_nu); iss_r * sin(iss_nu); 0];
iss_v_mag = sqrt(cfg.mu / iss_r);
iss.velocity = R_iss * [-iss_v_mag * sin(iss_nu); iss_v_mag * cos(iss_nu); 0];
iss.attitude = [0; 0; 0];
iss.angular_velocity = [0; 0; 0];
iss.battery = 99.0;
iss.health = 1.0;
iss.risk = 0.01;
iss.failure_prob = 0.01;
iss.current_task = 'ORBITAL_STATION';
iss.status = 'ACTIVE';
iss.neighbors = {};
iss.active_links = 0;
iss.altitude = iss_alt;
iss.latitude = asind(iss.position(3) / norm(iss.position));
iss.longitude = atan2d(iss.position(2), iss.position(1));

% Append ISS as 9th entity if needed or return separately
satellites(num_sats + 1) = iss;

end
