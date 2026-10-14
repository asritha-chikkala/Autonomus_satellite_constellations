function [C, details] = cost_matrix(satellites, targets, cfg)
% COST_MATRIX - Computes the assignment cost matrix for Satellites x Targets
%
% Architecture Formula:
%   C(i,j) = alpha * Distance + beta * Risk - gamma * Battery + delta * Delay
%
% Weights:
%   alpha = 0.40, beta = 0.25, gamma = 0.25, delta = 0.10

if nargin < 3
    cfg = config();
end

num_sats = length(satellites);
num_targets = length(targets);

C = zeros(num_sats, num_targets);
details = repmat(struct(), num_sats, num_targets);

% Convert targets (lat, lon, alt) to Cartesian coordinates (ECI frame approx)
target_positions = zeros(3, num_targets);
for j = 1:num_targets
    t_lat = deg2rad(targets(j).latitude);
    t_lon = deg2rad(targets(j).longitude);
    t_alt = 0.0;
    if isfield(targets(j), 'altitude')
        t_alt = targets(j).altitude;
    end
    r_target = (cfg.Re + t_alt);
    target_positions(:, j) = [
        r_target * cos(t_lat) * cos(t_lon);
        r_target * cos(t_lat) * sin(t_lon);
        r_target * sin(t_lat)
    ];
end

% Raw values extraction for normalization
dist_raw  = zeros(num_sats, num_targets);
risk_raw  = zeros(num_sats, 1);
batt_raw  = zeros(num_sats, 1);
delay_raw = zeros(num_sats, num_targets);

for i = 1:num_sats
    r_sat = satellites(i).position;
    v_sat = satellites(i).velocity;
    risk_raw(i) = satellites(i).risk;
    batt_raw(i) = satellites(i).battery / 100.0; % [0, 1]
    
    for j = 1:num_targets
        r_tgt = target_positions(:, j);
        d = norm(r_sat - r_tgt);
        dist_raw(i, j) = d;
        
        % Approximate orbital angle difference and time-to-overflight (delay)
        unit_sat = r_sat / norm(r_sat);
        unit_tgt = r_tgt / norm(r_tgt);
        angle_diff = acos(max(-1.0, min(1.0, dot(unit_sat, unit_tgt))));
        
        % Estimated delay [seconds] to align ground track
        ang_speed = norm(v_sat) / norm(r_sat); % rad/s
        delay_est = angle_diff / max(1e-4, ang_speed);
        delay_raw(i, j) = delay_est;
    end
end

% Normalization constants (max values)
max_dist = max(max(dist_raw(:)), 1.0);
max_delay = max(max(delay_raw(:)), 1.0);

for i = 1:num_sats
    for j = 1:num_targets
        d_norm = dist_raw(i, j) / max_dist;
        r_norm = max(0.0, min(1.0, risk_raw(i)));
        b_norm = max(0.0, min(1.0, batt_raw(i)));
        tau_norm = delay_raw(i, j) / max_delay;
        
        % Exact required formulation:
        cost_val = cfg.alpha * d_norm + ...
                   cfg.beta  * r_norm - ...
                   cfg.gamma * b_norm + ...
                   cfg.delta * tau_norm;
                   
        % Offset by +gamma so costs remain positive for Hungarian/Auction algorithms
        cost_non_negative = cost_val + cfg.gamma;
        
        % Penalty for unhealthy or low battery satellites
        if satellites(i).battery < 15.0 || satellites(i).health < 0.3
            cost_non_negative = cost_non_negative + 10.0; % Prohibitive penalty
        end
        
        C(i, j) = cost_non_negative;
        
        details(i, j).satellite_id = satellites(i).id;
        details(i, j).target_index = j;
        details(i, j).distance_km = dist_raw(i, j);
        details(i, j).risk = r_norm;
        details(i, j).battery = b_norm * 100.0;
        details(i, j).delay_sec = delay_raw(i, j);
        details(i, j).total_cost = cost_non_negative;
    end
end

end
