function generate_simulation_dataset(num_runs, cfg)
% GENERATE_SIMULATION_DATASET - Generates physical dataset from 6-DOF simulation
% Simulates Normal + 6 Fault Scenarios:
%   0: Normal
%   1: Battery Fault (High drain rate)
%   2: Attitude Fault (Reaction wheel jitter / high error)
%   3: Velocity Fault (Thruster overspeed / orbital deviation)
%   4: Communication Fault (Transceiver degradation / packet loss)
%   5: Actuator Fault (Thrust saturation / reduced effectiveness)
%   6: Satellite Failure (Progressive multi-subsystem degradation)

if nargin < 2
    cfg = config();
end
if nargin < 1
    num_runs = 70; % 10 runs per scenario across 7 scenarios
end

if ~exist(cfg.data_dir, 'dir')
    mkdir(cfg.data_dir);
end

fprintf('=== GENERATING PHYSICS-BASED ML TRAINING DATASET (%d RUNS) ===\n', num_runs);

scenarios = {'NORMAL', 'BATTERY_FAULT', 'ATTITUDE_FAULT', 'VELOCITY_FAULT', ...
             'COMM_FAULT', 'ACTUATOR_FAULT', 'SATELLITE_FAILURE'};
scenario_ids = [0, 1, 2, 3, 4, 5, 6];

telemetry_file = fullfile(cfg.data_dir, 'satellite_telemetry.csv');
comm_file = fullfile(cfg.data_dir, 'communication_graph.csv');
fault_file = fullfile(cfg.data_dir, 'fault_labels.csv');
ml_feat_file = fullfile(cfg.data_dir, 'ml_features.csv');

t_fid = fopen(telemetry_file, 'w');
fprintf(t_fid, 'run_id,step,sat_id,x,y,z,vx,vy,vz,roll,pitch,yaw,omega_x,omega_y,omega_z,battery,health,risk,failure_prob,active_links,avg_link_quality\n');

c_fid = fopen(comm_file, 'w');
fprintf(c_fid, 'run_id,step,source_id,target_id,connected,link_quality,distance\n');

f_fid = fopen(fault_file, 'w');
fprintf(f_fid, 'run_id,sat_id,fault_type,fault_code,anomaly_flag\n');

m_fid = fopen(ml_feat_file, 'w');
fprintf(m_fid, 'battery,battery_drain,velocity_error,attitude_error,comm_quality,health_index,mission_load,anomaly_flag,risk_score,failure_prob\n');

sim_steps = 25; % 25 steps per run
dt = 0.5;

run_counter = 0;
num_sats = cfg.num_satellites;

for s_idx = 1:length(scenarios)
    scenario_name = scenarios{s_idx};
    scenario_code = scenario_ids(s_idx);
    runs_per_scen = ceil(num_runs / length(scenarios));
    
    fprintf('  Simulating Scenario %d/7: %s (%d runs)...\n', s_idx, scenario_name, runs_per_scen);
    
    for r = 1:runs_per_scen
        run_counter = run_counter + 1;
        sats = initialize_satellites(cfg);
        
        % Target fault satellite (SAT-03 or SAT-04)
        fault_sat_idx = mod(run_counter, num_sats) + 1;
        
        for k = 1:sim_steps
            % Compute communication graph
            [adj_mat, lq_mat, dist_mat] = communication_graph(sats(1:num_sats), cfg);
            
            for i = 1:num_sats
                has_fault = (i == fault_sat_idx) && (scenario_code > 0);
                
                % Baseline controls
                u_cmd = [0.1 * sin(k*0.2); 0.1 * cos(k*0.2); 0; 0.01; 0.01; 0];
                
                % Inject physical faults
                if has_fault
                    switch scenario_code
                        case 1 % Battery Fault
                            sats(i).battery = max(0, sats(i).battery - 1.2 * dt);
                        case 2 % Attitude Fault
                            sats(i).attitude = sats(i).attitude + deg2rad([5.0; -4.0; 6.0]) * sin(k);
                            sats(i).angular_velocity = sats(i).angular_velocity + [0.08; -0.05; 0.07];
                        case 3 % Velocity Fault
                            sats(i).velocity = sats(i).velocity + [0.15; -0.20; 0.10];
                        case 4 % Communication Fault
                            lq_mat(i, :) = lq_mat(i, :) * 0.15;
                            lq_mat(:, i) = lq_mat(:, i) * 0.15;
                            adj_mat(i, :) = 0;
                            adj_mat(:, i) = 0;
                        case 5 % Actuator Fault
                            u_cmd = u_cmd * 0.1; % 90% thrust degradation
                        case 6 % Full Failure
                            sats(i).battery = max(0, sats(i).battery - 2.5 * dt);
                            sats(i).health = max(0.05, sats(i).health - 0.05 * dt);
                    end
                end
                
                % Advance telemetry
                sats(i).active_links = sum(adj_mat(i, :));
                avg_lq = 0;
                if sats(i).active_links > 0
                    avg_lq = mean(lq_mat(i, adj_mat(i, :) > 0));
                end
                
                sats(i) = telemetry_update(sats(i), u_cmd, dt, true, has_fault, cfg);
                
                % Log telemetry
                fprintf(t_fid, '%d,%d,%s,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.2f,%.4f,%.4f,%.4f,%d,%.4f\n', ...
                    run_counter, k, sats(i).id, sats(i).position(1), sats(i).position(2), sats(i).position(3), ...
                    sats(i).velocity(1), sats(i).velocity(2), sats(i).velocity(3), ...
                    sats(i).attitude(1), sats(i).attitude(2), sats(i).attitude(3), ...
                    sats(i).angular_velocity(1), sats(i).angular_velocity(2), sats(i).angular_velocity(3), ...
                    sats(i).battery, sats(i).health, sats(i).risk, sats(i).failure_prob, sats(i).active_links, avg_lq);
                    
                % Log ML feature row
                batt_drain = (100 - sats(i).battery) / max(1, k);
                vel_err = norm(sats(i).velocity) - cfg.nominal_speed;
                att_err = norm(sats(i).attitude);
                is_anom = double(has_fault && (k > 5));
                m_load = 0.5;
                
                fprintf(m_fid, '%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%d,%.4f,%.4f\n', ...
                    sats(i).battery / 100.0, batt_drain, abs(vel_err), att_err, avg_lq, ...
                    sats(i).health, m_load, is_anom, sats(i).risk, sats(i).failure_prob);
            end
            
            % Log communication links sample
            if k == 1 || k == sim_steps
                for i = 1:num_sats
                    for j = (i+1):num_sats
                        fprintf(c_fid, '%d,%d,%s,%s,%d,%.4f,%.2f\n', ...
                            run_counter, k, cfg.satellite_ids{i}, cfg.satellite_ids{j}, ...
                            adj_mat(i, j), lq_mat(i, j), dist_mat(i, j));
                    end
                end
            end
        end
        
        % Log fault labels
        for i = 1:num_sats
            if i == fault_sat_idx && scenario_code > 0
                fprintf(f_fid, '%d,%s,%s,%d,1\n', run_counter, sats(i).id, scenario_name, scenario_code);
            else
                fprintf(f_fid, '%d,%s,NORMAL,0,0\n', run_counter, sats(i).id);
            end
        end
    end
end

fclose(t_fid);
fclose(c_fid);
fclose(f_fid);
fclose(m_fid);

fprintf('[Dataset] Telemetry, communication links, and ML feature datasets written to %s\n', cfg.data_dir);

end
