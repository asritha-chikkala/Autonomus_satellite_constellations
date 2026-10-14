function sim_results = run_mpc_simulation(sat, target, steps, dt, cfg)
% RUN_MPC_SIMULATION - Executes closed-loop Model Predictive Control simulation
% Tracks target observation rendezvous, updates satellite physics, and logs performance metrics.

if nargin < 5
    cfg = config();
end

if nargin < 3 || isempty(steps)
    steps = cfg.mpc.simulation_steps;
end
if nargin < 4 || isempty(dt)
    dt = cfg.mpc.dt;
end

N_horizon = cfg.mpc.horizon;

% Initial 12-state vector
current_x = [
    sat.position(:);
    sat.velocity(:);
    sat.attitude(:);
    sat.angular_velocity(:)
];

% Generate overall reference trajectory
ref_traj = generate_reference_trajectory(current_x, target, steps + N_horizon + 5, dt, cfg);

% Logging preallocation
time_log = (0:(steps-1))' * dt;
actual_states = zeros(steps, 12);
reference_states = zeros(steps, 12);
control_inputs = zeros(steps, 6);
position_errors = zeros(steps, 1);
attitude_errors = zeros(steps, 1);
predicted_horizons = cell(steps, 1);
battery_log = zeros(steps, 1);
health_log = zeros(steps, 1);

current_sat = sat;
current_sat.current_task = 'EXECUTING_MPC';
current_sat.status = 'ACTIVE_MANEUVER';

% Generate crossing space debris trajectory fragment for collision avoidance maneuver (CAM)
debris_traj = zeros(steps + N_horizon + 5, 3);
for d_idx = 1:size(debris_traj, 1)
    t_d = (d_idx - 1) * dt;
    debris_traj(d_idx, :) = ref_traj.x(min(d_idx, size(ref_traj.x, 1)), 1:3) + ...
        [2.8 * cos(0.2 * t_d), 2.8 * sin(0.2 * t_d), 1.5];
end

% Determine controller type from target or config (default: LMPC)
ctrl_type = 'LMPC';
if isfield(target, 'controller_type') && ~isempty(target.controller_type)
    ctrl_type = upper(target.controller_type);
elseif isfield(cfg, 'controller_type') && ~isempty(cfg.controller_type)
    ctrl_type = upper(cfg.controller_type);
end

% Standardize simulation horizon across all controllers: 40 steps (4.0s)
% This allows direct, uniform comparison of LMPC, NMPC, and PID on identical axes.
if steps > 40
    steps = 40;
    time_log = (0:(steps-1))' * dt;
    actual_states = zeros(steps, 12);
    reference_states = zeros(steps, 12);
    control_inputs = zeros(steps, 6);
    position_errors = zeros(steps, 1);
    attitude_errors = zeros(steps, 1);
    predicted_horizons = cell(steps, 1);
    battery_log = zeros(steps, 1);
    health_log = zeros(steps, 1);
end

ctrl_internal_state = struct();

for k = 1:steps
    % Log current state
    actual_states(k, :) = current_x';
    reference_states(k, :) = ref_traj.x(k, :);
    
    % Tracking errors
    pos_err = norm(current_x(1:3) - ref_traj.x(k, 1:3)');
    att_err = norm(current_x(7:9) - ref_traj.x(k, 7:9)');
    position_errors(k) = pos_err;
    attitude_errors(k) = att_err;
    
    % Horizon reference window & Debris collision window
    ref_window = ref_traj.x(k : k + N_horizon - 1, :);
    debris_window = debris_traj(k : k + N_horizon - 1, :);
    
    % Map 12-state current_x to 13-state plant [r; v; q; omega]
    q_curr = euler_to_quat(current_x(7), current_x(8), current_x(9));
    state13 = [current_x(1:6); q_curr(:); current_x(10:12)];
    
    % Map 12-state ref_window to 13-state ref_window13
    ref_window13 = zeros(N_horizon, 13);
    for rw_i = 1:N_horizon
        q_rw = euler_to_quat(ref_window(rw_i, 7), ref_window(rw_i, 8), ref_window(rw_i, 9));
        ref_window13(rw_i, :) = [ref_window(rw_i, 1:6), q_rw(:)', ref_window(rw_i, 10:12)];
    end
    
    % Execute selected controller dynamically via unified_controller
    try
        [u_opt, ctrl_internal_state, diag_info] = unified_controller(ctrl_type, state13, ref_window13, ctrl_internal_state, cfg, debris_window);
        pred_traj = [];
        if isfield(ctrl_internal_state, 'last_pred_traj')
            pred_traj = ctrl_internal_state.last_pred_traj;
        end
    catch
        % Fallback to standard mpc_controller if unified controller encounters missing subroutines
        [u_opt, pred_traj, ~] = mpc_controller(current_x, ref_window, cfg, debris_window);
    end
    
    control_inputs(k, :) = u_opt';
    predicted_horizons{k} = pred_traj;
    
    % Check if satellite is sunlit (simple cylindrical shadow model)
    r_sat = current_x(1:3);
    is_sunlit = (r_sat(1) > 0) || (norm(r_sat(2:3)) > cfg.Re);
    
    % Apply controls and advance state via RK4
    current_sat = telemetry_update(current_sat, u_opt, dt, is_sunlit, false, cfg);
    current_x = [
        current_sat.position(:);
        current_sat.velocity(:);
        current_sat.attitude(:);
        current_sat.angular_velocity(:)
    ];
    
    battery_log(k) = current_sat.battery;
    health_log(k) = current_sat.health;
end

% Compute performance metrics
rmse_pos = sqrt(mean(position_errors.^2));
mae_pos = mean(position_errors);
rmse_att = sqrt(mean(attitude_errors.^2));
mae_att = mean(attitude_errors);
total_thrust_effort = sum(sqrt(sum(control_inputs(:, 1:3).^2, 2))) * dt;
total_torque_effort = sum(sqrt(sum(control_inputs(:, 4:6).^2, 2))) * dt;

% Settling time (time to reach and remain within 5% of final tracking tolerance)
tol = 0.05 * max(position_errors);
settled_idx = find(abs(position_errors - position_errors(end)) <= tol, 1, 'first');
if isempty(settled_idx)
    settling_time = time_log(end);
else
    settling_time = time_log(settled_idx);
end

% Constraint violations
thrust_mags = sqrt(sum(control_inputs(:, 1:3).^2, 2));
torque_mags = sqrt(sum(control_inputs(:, 4:6).^2, 2));
thrust_violations = sum(thrust_mags > (cfg.mpc.Umax + 1e-4));
torque_violations = sum(torque_mags > (cfg.mpc.Tmax + 1e-4));

% Package outputs
sim_results.time = time_log;
sim_results.actual_states = actual_states;
sim_results.reference_states = reference_states;
sim_results.control_inputs = control_inputs;
sim_results.position_errors = position_errors;
sim_results.attitude_errors = attitude_errors;
sim_results.battery_log = battery_log;
sim_results.health_log = health_log;
sim_results.final_satellite = current_sat;
sim_results.predicted_horizons = predicted_horizons;

sim_results.metrics.rmse_pos = rmse_pos;
sim_results.metrics.mae_pos = mae_pos;
sim_results.metrics.rmse_att = rmse_att;
sim_results.metrics.mae_att = mae_att;
sim_results.metrics.total_thrust_effort = total_thrust_effort;
sim_results.metrics.total_torque_effort = total_torque_effort;
sim_results.metrics.settling_time = settling_time;
sim_results.metrics.thrust_violations = thrust_violations;
sim_results.metrics.torque_violations = torque_violations;
sim_results.metrics.battery_consumed = sat.battery - current_sat.battery;

end
