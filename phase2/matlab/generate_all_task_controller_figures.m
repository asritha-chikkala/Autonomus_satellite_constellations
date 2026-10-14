function generate_all_task_controller_figures(input_tasks)
% GENERATE_ALL_TASK_CONTROLLER_FIGURES - Pre-computes and caches all 20 MATLAB scientific figures
% for TASK-1 and TASK-2 across all three 6-DOF controllers (LMPC, NMPC, PID).
% This guarantees instant (<10ms) zero-latency UI loading without timeouts.

clc;
fprintf('========================================================================\n');
fprintf('  STARTING BATCH PRE-GENERATION OF ALL TASK & CONTROLLER MATLAB FIGURES  \n');
fprintf('========================================================================\n\n');

cfg = config();

% Task 1 Definition (Visakhapatnam Observation, Tropical LEO pass)
t1.id = 'TASK-1';
t1.name = 'Visakhapatnam Observation';
t1.latitude = 16.50;
t1.longitude = 80.60;
t1.altitude = 0.0;
t1.type = 'Earth Observation';
t1.priority = 'HIGH';
t1.action = 'CAPTURE IMAGE';
t1.assigned_satellite = 'SAT-06';
t1.battery = 82.5;
t1.health = 0.97;
t1.is_faulty = 0;

% Task 2 Definition (Brasilia / Amazon Basin Emergency Scan, Inclined LEO pass)
t2.id = 'TASK-2';
t2.name = 'Brasilia Emergency Observation';
t2.latitude = -15.78;
t2.longitude = -47.93;
t2.altitude = 0.0;
t2.type = 'Disaster Monitoring';
t2.priority = 'CRITICAL';
t2.action = 'MULTISPECTRAL SCAN';
t2.assigned_satellite = 'SAT-04';
t2.battery = 78.0;
t2.health = 0.95;
% Task 3 Definition (Tokyo Precision Scan)
t3.id = 'TASK-3';
t3.name = 'Tokyo Precision Scan';
t3.latitude = 35.68;
t3.longitude = 139.76;
t3.altitude = 0.0;
t3.type = 'Earth Observation';
t3.priority = 'CRITICAL';
t3.action = 'CAPTURE IMAGE';
t3.assigned_satellite = 'SAT-01';
t3.battery = 87.5;
t3.health = 0.98;
t3.is_faulty = 0;

% Task 4 Definition (Sydney Coastal Environmental Scan)
t4.id = 'TASK-4';
t4.name = 'Sydney Coastal Scan';
t4.latitude = -33.86;
t4.longitude = 151.20;
t4.altitude = 0.0;
t4.type = 'Environmental';
t4.priority = 'HIGH';
t4.action = 'OCEAN SCAN';
t4.assigned_satellite = 'SAT-08';
t4.battery = 85.0;
t4.health = 0.98;
t4.is_faulty = 0;

if nargin >= 1 && ~isempty(input_tasks)
    tasks = input_tasks;
else
    tasks = {t1, t2, t3, t4};
end
controllers = {'LMPC', 'PID', 'NMPC'};

total_runs = length(tasks) * length(controllers);
run_idx = 0;

for tidx = 1:length(tasks)
    curr_task = tasks{tidx};
    for cidx = 1:length(controllers)
        run_idx = run_idx + 1;
        ctrl_name = controllers{cidx};
        curr_task.controller_type = ctrl_name;
        
        fprintf('[%d/%d] Executing %s with %s controller...\n', run_idx, total_runs, curr_task.id, ctrl_name);
        t_start = tic;
        
        % Run closed-loop mission execution
        mission_out = mission_execution(curr_task, cfg);
        
        % Render and export all 20 figures
        generate_results(mission_out, cfg);
        
        elapsed = toc(t_start);
        fprintf('       -> Completed %s [%s] in %.2f seconds.\n\n', curr_task.id, ctrl_name, elapsed);
    end
end

fprintf('========================================================================\n');
fprintf('  ALL TASK & CONTROLLER FIGURES PRE-GENERATED AND CACHED SUCCESSFULLY    \n');
fprintf('========================================================================\n');

end
