function out = run_controller_benchmark_suite()
% RUN_CONTROLLER_BENCHMARK_SUITE - Executes rigorous fair evaluation across
% LMPC, NMPC, and PID on identical 13-state nonlinear spacecraft plant.
% Evaluates 8 required scenarios:
%   1. Nominal Trajectory Tracking
%   2. Initial Position & Velocity Errors
%   3. Initial Attitude Error
%   4. External Disturbance Forces/Torques
%   5. Model Mismatch (Mass & Inertia Uncertainty)
%   6. Actuator Saturation Stress
%   7. Collision Avoidance Maneuver (CAM)
%   8. Monte Carlo Statistical Trials (10 randomized runs)

cfg = config();
dt = cfg.mpc.dt; % 0.1 s
steps = 60;      % 6.0 seconds trajectory tracking window
time_vec = (0:(steps-1))' * dt;

controllers = {'LMPC', 'NMPC', 'PID'};
num_ctrl = length(controllers);

scenarios = {
    '1_Nominal', ...
    '2_Initial_PosVel_Error', ...
    '3_Initial_Att_Error', ...
    '4_External_Disturbance', ...
    '5_Model_Mismatch', ...
    '6_Actuator_Saturation', ...
    '7_Collision_Avoidance'
};
num_scen = length(scenarios);

results_table = [];

fprintf('========================================================================\n');
fprintf('  STARTING COMPREHENSIVE 3-CONTROLLER BENCHMARK EVALUATION (LMPC vs NMPC vs PID)\n');
fprintf('========================================================================\n\n');

% Baseline nominal state
r0 = [6928.137; 0; 0]; % 550 km circular orbit in ECI
v0 = [0; sqrt(cfg.mu / 6928.137); 0];
q0 = [0; 0; 0; 1];
w0 = [0; 0; 0];
nominal_x13 = [r0; v0; q0; w0];

% Build reference trajectory: gentle 6-DOF overflight arc
ref_states13 = zeros(steps + cfg.mpc.horizon + 10, 13);
for k = 1:size(ref_states13, 1)
    t_k = (k - 1) * dt;
    % Arc trajectory
    nu_k = (v0(2) / r0(1)) * t_k;
    ref_states13(k, 1:3) = [r0(1)*cos(nu_k); r0(1)*sin(nu_k); 15.0 * sin(0.2 * t_k)];
    ref_states13(k, 4:6) = [-v0(2)*sin(nu_k); v0(2)*cos(nu_k); 15.0 * 0.2 * cos(0.2 * t_k)];
    % Target pointing attitude quaternion
    q_target = euler_to_quat(0.05 * sin(0.3 * t_k), 0.08 * cos(0.2 * t_k), 0.02 * t_k);
    ref_states13(k, 7:10) = q_target;
    ref_states13(k, 11:13) = [0.015 * cos(0.3 * t_k); -0.016 * sin(0.2 * t_k); 0.02];
end

all_logs = struct();

for s_idx = 1:num_scen
    scen_name = scenarios{s_idx};
    fprintf('>>> Evaluating Scenario [%d/%d]: %s <<<\n', s_idx, num_scen, scen_name);
    
    for c_idx = 1:num_ctrl
        c_type = controllers{c_idx};
        
        % Set up scenario specific conditions
        x_init = nominal_x13;
        debris_traj = [];
        cfg_plant = cfg;
        dist_force = zeros(3, 1);
        dist_torque = zeros(3, 1);
        
        switch scen_name
            case '1_Nominal'
                % Nominal conditions
            case '2_Initial_PosVel_Error'
                x_init(1:3) = x_init(1:3) + [0.35; -0.25; 0.15]; % ~450 m position offset
                x_init(4:6) = x_init(4:6) + [0.005; -0.003; 0.002]; % ~6 m/s velocity offset
            case '3_Initial_Att_Error'
                x_init(7:10) = euler_to_quat(deg2rad(18.0), deg2rad(-15.0), deg2rad(22.0));
                x_init(11:13) = [0.04; -0.05; 0.03]; % 3 deg/s rate error
            case '4_External_Disturbance'
                dist_force = [0.35; -0.20; 0.15]; % 0.35 N solar radiation / drag disturbance
                dist_torque = [0.025; -0.015; 0.02]; % 0.025 N*m gravity gradient disturbance
            case '5_Model_Mismatch'
                cfg_plant.mass = cfg.mass * 1.25; % +25% mass uncertainty
                cfg_plant.Inertia = cfg.Inertia * 1.30; % +30% inertia uncertainty
                cfg_plant.invInertia = inv(cfg_plant.Inertia);
            case '6_Actuator_Saturation'
                % Aggressive offset inducing saturation
                x_init(1:3) = x_init(1:3) + [1.2; -0.8; 0.6]; % 1.5 km offset
                x_init(7:10) = euler_to_quat(deg2rad(35.0), deg2rad(-40.0), deg2rad(30.0));
            case '7_Collision_Avoidance'
                % Space debris crossing keep-out corridor at step 25-35
                debris_traj = zeros(steps + cfg.mpc.horizon + 10, 3);
                for d_k = 1:size(debris_traj, 1)
                    debris_traj(d_k, :) = ref_states13(d_k, 1:3) + [1.2 * cos(0.3 * (d_k - 30)), 1.2 * sin(0.3 * (d_k - 30)), 0.8];
                end
        end
        
        % Simulation storage
        sim_pos = zeros(steps, 3);
        sim_vel = zeros(steps, 3);
        sim_q   = zeros(steps, 4);
        sim_omg = zeros(steps, 3);
        sim_u   = zeros(steps, 6);
        sim_time_exec = zeros(steps, 1);
        
        pos_errors = zeros(steps, 1);
        vel_errors = zeros(steps, 1);
        att_errors = zeros(steps, 1);
        ang_errors = zeros(steps, 1);
        
        min_deb_dist = 999.0;
        thrust_sats = 0;
        torque_sats = 0;
        
        curr_x = x_init;
        ctrl_state = struct();
        
        for k = 1:steps
            ref_win = ref_states13(k : k + cfg.mpc.horizon - 1, :);
            deb_win = [];
            if ~isempty(debris_traj)
                deb_win = debris_traj(k : k + cfg.mpc.horizon - 1, :);
            end
            
            % Controller call
            [u_cmd, ctrl_state, diag_k] = unified_controller(c_type, curr_x, ref_win, ctrl_state, cfg, deb_win);
            
            sim_pos(k, :) = curr_x(1:3)';
            sim_vel(k, :) = curr_x(4:6)';
            sim_q(k, :)   = curr_x(7:10)';
            sim_omg(k, :) = curr_x(11:13)';
            sim_u(k, :)   = u_cmd';
            sim_time_exec(k) = diag_k.execution_time_sec;
            
            % Tracking error evaluation
            pos_errors(k) = norm(curr_x(1:3) - ref_win(1, 1:3)');
            vel_errors(k) = norm(curr_x(4:6) - ref_win(1, 4:6)');
            
            % Quaternion geodesic angle error in degrees
            q_actual = curr_x(7:10) / norm(curr_x(7:10));
            q_desired = ref_win(1, 7:10)' / norm(ref_win(1, 7:10));
            q_dot = abs(dot(q_actual, q_desired));
            q_dot = max(-1.0, min(1.0, q_dot));
            att_errors(k) = 2.0 * acos(q_dot) * (180.0 / pi);
            
            ang_errors(k) = norm(curr_x(11:13) - ref_win(1, 11:13)');
            
            % Check constraint saturation
            if norm(u_cmd(1:3)) >= (cfg.mpc.Umax - 1e-3)
                thrust_sats = thrust_sats + 1;
            end
            if norm(u_cmd(4:6)) >= (cfg.mpc.Tmax - 1e-3)
                torque_sats = torque_sats + 1;
            end
            
            % Debris distance
            if ~isempty(debris_traj)
                d_deb = norm(curr_x(1:3) - debris_traj(k, :)');
                if d_deb < min_deb_dist
                    min_deb_dist = d_deb;
                end
            end
            
            % Step RK4 on 13-state nonlinear plant with disturbances
            u_applied = u_cmd + [dist_force; dist_torque];
            k1 = satellite_dynamics_13(0, curr_x, u_applied, cfg_plant);
            k2 = satellite_dynamics_13(0, curr_x + 0.5 * dt * k1, u_applied, cfg_plant);
            k3 = satellite_dynamics_13(0, curr_x + 0.5 * dt * k2, u_applied, cfg_plant);
            k4 = satellite_dynamics_13(0, curr_x + dt * k3, u_applied, cfg_plant);
            curr_x = curr_x + (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4);
            curr_x(7:10) = curr_x(7:10) / norm(curr_x(7:10));
        end
        
        % Calculate aggregated performance metrics
        rmse_pos = sqrt(mean(pos_errors.^2));
        mae_pos  = mean(pos_errors);
        max_pos  = max(pos_errors);
        rmse_vel = sqrt(mean(vel_errors.^2));
        rmse_att = sqrt(mean(att_errors.^2));
        mae_att  = mean(att_errors);
        rmse_ang = sqrt(mean(ang_errors.^2));
        final_pos_err = pos_errors(end);
        
        thrust_effort = sum(sqrt(sum(sim_u(:, 1:3).^2, 2))) * dt; % N*s
        torque_effort = sum(sqrt(sum(sim_u(:, 4:6).^2, 2))) * dt; % N*m*s
        peak_thrust   = max(sqrt(sum(sim_u(:, 1:3).^2, 2)));
        peak_torque   = max(sqrt(sum(sim_u(:, 4:6).^2, 2)));
        sat_pct       = (thrust_sats / steps) * 100.0;
        
        mean_time_ms = mean(sim_time_exec) * 1000;
        p95_time_ms  = prctile(sim_time_exec, 95) * 1000;
        max_time_ms  = max(sim_time_exec) * 1000;
        
        row_entry = {scen_name, c_type, rmse_pos, mae_pos, max_pos, rmse_vel, rmse_att, mae_att, rmse_ang, final_pos_err, thrust_effort, torque_effort, peak_thrust, peak_torque, sat_pct, min_deb_dist, mean_time_ms, p95_time_ms, max_time_ms};
        results_table = [results_table; row_entry];
        
        key = sprintf('S%d_%s', s_idx, c_type);
        all_logs.(key).time = time_vec;
        all_logs.(key).pos = sim_pos;
        all_logs.(key).pos_err = pos_errors;
        all_logs.(key).att_err = att_errors;
        all_logs.(key).u = sim_u;
        all_logs.(key).time_exec = sim_time_exec;
        
        fprintf('  [%s] RMSE_pos: %.4f km | RMSE_att: %.2f deg | Effort: %.2f N*s | Time: %.2f ms\n', ...
            c_type, rmse_pos, rmse_att, thrust_effort, mean_time_ms);
    end
    fprintf('\n');
end

%% Monte Carlo Robustness Trials (10 randomized runs)
fprintf('>>> Running Monte Carlo Robustness Trials (10 Runs) <<<\n');
mc_runs = 10;
mc_results = struct();
for c_idx = 1:num_ctrl
    c_type = controllers{c_idx};
    mc_pos_rmse = zeros(mc_runs, 1);
    mc_att_rmse = zeros(mc_runs, 1);
    mc_effort   = zeros(mc_runs, 1);
    mc_times    = zeros(mc_runs, 1);
    
    rng(42); % Fixed reproducible seed
    for r_i = 1:mc_runs
        r_dist = 0.25 * (randn(3, 1));
        v_dist = 0.003 * (randn(3, 1));
        att_rand = deg2rad(10.0) * randn(3, 1);
        
        curr_x = nominal_x13;
        curr_x(1:3) = curr_x(1:3) + r_dist;
        curr_x(4:6) = curr_x(4:6) + v_dist;
        curr_x(7:10) = euler_to_quat(att_rand(1), att_rand(2), att_rand(3));
        
        ctrl_state = struct();
        pos_err_run = zeros(steps, 1);
        att_err_run = zeros(steps, 1);
        u_run = zeros(steps, 6);
        t_exec_run = zeros(steps, 1);
        
        for k = 1:steps
            ref_win = ref_states13(k : k + cfg.mpc.horizon - 1, :);
            [u_cmd, ctrl_state, diag_k] = unified_controller(c_type, curr_x, ref_win, ctrl_state, cfg, []);
            u_run(k, :) = u_cmd';
            t_exec_run(k) = diag_k.execution_time_sec;
            
            pos_err_run(k) = norm(curr_x(1:3) - ref_win(1, 1:3)');
            q_actual = curr_x(7:10) / norm(curr_x(7:10));
            q_desired = ref_win(1, 7:10)' / norm(ref_win(1, 7:10));
            q_dot = max(-1.0, min(1.0, abs(dot(q_actual, q_desired))));
            att_err_run(k) = 2.0 * acos(q_dot) * (180.0 / pi);
            
            % Step RK4
            k1 = satellite_dynamics_13(0, curr_x, u_cmd, cfg);
            k2 = satellite_dynamics_13(0, curr_x + 0.5 * dt * k1, u_cmd, cfg);
            k3 = satellite_dynamics_13(0, curr_x + 0.5 * dt * k2, u_cmd, cfg);
            k4 = satellite_dynamics_13(0, curr_x + dt * k3, u_cmd, cfg);
            curr_x = curr_x + (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4);
            curr_x(7:10) = curr_x(7:10) / norm(curr_x(7:10));
        end
        
        mc_pos_rmse(r_i) = sqrt(mean(pos_err_run.^2));
        mc_att_rmse(r_i) = sqrt(mean(att_err_run.^2));
        mc_effort(r_i)   = sum(sqrt(sum(u_run(:, 1:3).^2, 2))) * dt;
        mc_times(r_i)    = mean(t_exec_run) * 1000;
    end
    
    mc_results.(c_type).pos_rmse_mean = mean(mc_pos_rmse);
    mc_results.(c_type).pos_rmse_std  = std(mc_pos_rmse);
    mc_results.(c_type).att_rmse_mean = mean(mc_att_rmse);
    mc_results.(c_type).att_rmse_std  = std(mc_att_rmse);
    mc_results.(c_type).effort_mean   = mean(mc_effort);
    mc_results.(c_type).effort_std    = std(mc_effort);
    mc_results.(c_type).time_mean     = mean(mc_times);
    mc_results.(c_type).time_std      = std(mc_times);
    
    fprintf('  [%s Monte Carlo] Pos RMSE: %.4f +- %.4f km | Att RMSE: %.2f +- %.2f deg | Time: %.2f +- %.2f ms\n', ...
        c_type, mean(mc_pos_rmse), std(mc_pos_rmse), mean(mc_att_rmse), std(mc_att_rmse), mean(mc_times), std(mc_times));
end

%% Export Results to CSV: reports/controller_comparison_results.csv
csv_path = fullfile('reports', 'controller_comparison_results.csv');
fid = fopen(csv_path, 'w');
fprintf(fid, 'Scenario,Controller,Position_RMSE_km,Position_MAE_km,Max_Position_Error_km,Velocity_RMSE_kms,Attitude_RMSE_deg,Attitude_MAE_deg,AngularVelocity_RMSE_rads,Final_Position_Error_km,Thrust_Effort_Ns,Torque_Effort_Nms,Peak_Thrust_N,Peak_Torque_Nm,Saturation_Pct,Min_Debris_Dist_km,Mean_Exec_Time_ms,P95_Exec_Time_ms,Max_Exec_Time_ms\n');
for i = 1:size(results_table, 1)
    r = results_table(i, :);
    fprintf(fid, '%s,%s,%.6f,%.6f,%.6f,%.6f,%.4f,%.4f,%.6f,%.6f,%.4f,%.4f,%.4f,%.4f,%.2f,%.4f,%.2f,%.2f,%.2f\n', ...
        r{1}, r{2}, r{3}, r{4}, r{5}, r{6}, r{7}, r{8}, r{9}, r{10}, r{11}, r{12}, r{13}, r{14}, r{15}, r{16}, r{17}, r{18}, r{19});
end
fclose(fid);
fprintf('\n[SUCCESS] Benchmark CSV saved to: %s\n', csv_path);

%% Generate Comparison Plots
fig1 = figure('Visible', 'off', 'Position', [100 100 1200 800], 'Color', 'w');
subplot(2, 2, 1); hold on; grid on; box on;
plot(time_vec, all_logs.S1_LMPC.pos_err, 'b-', 'LineWidth', 1.8, 'DisplayName', 'LMPC');
plot(time_vec, all_logs.S1_NMPC.pos_err, 'r--', 'LineWidth', 1.8, 'DisplayName', 'NMPC');
plot(time_vec, all_logs.S1_PID.pos_err, 'g-.', 'LineWidth', 1.8, 'DisplayName', 'PID');
xlabel('Time [s]'); ylabel('Position Error [km]'); title('(a) Nominal Trajectory Position Error');
legend('Location', 'northeast');

subplot(2, 2, 2); hold on; grid on; box on;
plot(time_vec, all_logs.S1_LMPC.att_err, 'b-', 'LineWidth', 1.8, 'DisplayName', 'LMPC');
plot(time_vec, all_logs.S1_NMPC.att_err, 'r--', 'LineWidth', 1.8, 'DisplayName', 'NMPC');
plot(time_vec, all_logs.S1_PID.att_err, 'g-.', 'LineWidth', 1.8, 'DisplayName', 'PID');
xlabel('Time [s]'); ylabel('Attitude Error [deg]'); title('(b) Nominal Attitude Tracking Error');
legend('Location', 'northeast');

subplot(2, 2, 3); hold on; grid on; box on;
plot(time_vec, all_logs.S7_LMPC.pos_err, 'b-', 'LineWidth', 1.8, 'DisplayName', 'LMPC (CAM)');
plot(time_vec, all_logs.S7_NMPC.pos_err, 'r--', 'LineWidth', 1.8, 'DisplayName', 'NMPC (CAM)');
plot(time_vec, all_logs.S7_PID.pos_err, 'g-.', 'LineWidth', 1.8, 'DisplayName', 'PID (No CAM)');
xlabel('Time [s]'); ylabel('Position Deviation [km]'); title('(c) Collision Avoidance (2 km Keep-Out)');
legend('Location', 'northeast');

subplot(2, 2, 4); hold on; grid on; box on;
c_names = {'PID', 'LMPC', 'NMPC'};
times_ms = [mean(all_logs.S1_PID.time_exec)*1000, ...
            mean(all_logs.S1_LMPC.time_exec)*1000, ...
            mean(all_logs.S1_NMPC.time_exec)*1000];
b = bar(categorical(c_names), times_ms, 0.55);
b.FaceColor = 'flat';
b.CData(1, :) = [0.2 0.7 0.3];
b.CData(2, :) = [0.1 0.4 0.8];
b.CData(3, :) = [0.85 0.2 0.2];
ylabel('Mean Execution Time [ms]'); title('(d) Controller Computational Burden');
set(gca, 'YScale', 'log'); grid on;

fig_path = fullfile('reports', 'controller_comparison_benchmarks.png');
saveas(fig1, fig_path);
close(fig1);
fprintf('[SUCCESS] Benchmark plots saved to: %s\n', fig_path);

out.results_table = results_table;
out.mc_results = mc_results;
out.all_logs = all_logs;

end
