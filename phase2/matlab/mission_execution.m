function mission_out = mission_execution(target, cfg)
% MISSION_EXECUTION - Complete pipeline orchestrator for satellite mission
% Runs Initialization -> Comm Graph -> Allocation -> MPC Tracking -> Telemetry Feedback

if nargin < 2
    cfg = config();
end

if nargin < 1 || isempty(target)
    target.id = 'TASK-1';
    target.name = 'Visakhapatnam Observation';
    target.latitude = 16.50;
    target.longitude = 80.60;
    target.altitude = 0.0;
    target.type = 'Earth Observation';
    target.priority = 'HIGH';
    target.action = 'CAPTURE IMAGE';
end

if ~isfield(target, 'id') || isempty(target.id)
    target.id = 'TASK-1';
end
if ~isfield(target, 'name') || isempty(target.name)
    target.name = sprintf('Target (%.2f N, %.2f E)', target.latitude, target.longitude);
end

fprintf('=== STARTING AUTONOMOUS SATELLITE CONSTELLATION PIPELINE [%s: %s] ===\n', target.id, target.name);
fprintf('Target: Lat %.2f deg, Lon %.2f deg, Priority: %s\n', target.latitude, target.longitude, target.priority);

% 1. Satellite Constellation Initialization
fprintf('[Phase 1] Initializing constellation (8 Satellites + 1 Space Station)...\n');
satellites = initialize_satellites(cfg);
num_sats = cfg.num_satellites;

% 2. Dynamic Communication Graph Topology
fprintf('[Phase 2] Computing dynamic communication topology A(t)...\n');
[adj_matrix, link_qualities, distances] = communication_graph(satellites(1:num_sats), cfg);

% Update active links for each satellite
for i = 1:num_sats
    satellites(i).active_links = sum(adj_matrix(i, :));
    satellites(i).neighbors = cfg.satellite_ids(adj_matrix(i, :) > 0);
end

% 3. Multi-Agent Task Allocation (Hungarian, Auction, Greedy)
fprintf('[Phase 3] Generating Cost Matrix and executing Hungarian/Auction/Greedy algorithms...\n');
t1 = struct('latitude', target.latitude, 'longitude', target.longitude, 'altitude', target.altitude, ...
            'type', target.type, 'priority', target.priority, 'action', target.action);
t2 = struct('latitude', 28.61, 'longitude', 77.20, 'altitude', 0, ...
            'type', 'Weather', 'priority', 'MEDIUM', 'action', 'SCAN');
t3 = struct('latitude', 12.97, 'longitude', 77.59, 'altitude', 0, ...
            'type', 'Infrared', 'priority', 'LOW', 'action', 'MONITOR');
targets = [t1; t2; t3];

alloc_result = task_allocation(satellites(1:num_sats), targets, cfg);
selected_idx = alloc_result.selected_satellite_index;
selected_sat = satellites(selected_idx);

% If specific satellite was assigned by multi-agent satellite agent, synchronize selection
if isfield(target, 'assigned_satellite') && ~isempty(target.assigned_satellite)
    for s_i = 1:num_sats
        if strcmp(satellites(s_i).id, target.assigned_satellite)
            selected_idx = s_i;
            selected_sat = satellites(s_i);
            alloc_result.selected_satellite_index = s_i;
            alloc_result.selected_satellite_id = satellites(s_i).id;
            break;
        end
    end
end

% Apply runtime satellite state if provided from agent telemetry
if isfield(target, 'battery') && ~isempty(target.battery)
    selected_sat.battery = target.battery;
    satellites(selected_idx).battery = target.battery;
end
if isfield(target, 'health') && ~isempty(target.health)
    selected_sat.health = target.health;
    satellites(selected_idx).health = target.health;
end
if isfield(target, 'is_faulty') && target.is_faulty == 1
    selected_sat.is_faulty = true;
    selected_sat.status = 'FAULT_CRITICAL';
    satellites(selected_idx).is_faulty = true;
    satellites(selected_idx).status = 'FAULT_CRITICAL';
end

fprintf('Selected Satellite: %s (%s Algorithm, Reason: %s)\n', ...
    selected_sat.id, alloc_result.selected_strategy, alloc_result.selection_reason);

% 4. Model Predictive Control Trajectory Tracking
fprintf('[Phase 4] Activating 6-DOF MPC Controller for %s (Horizon=%d, dt=%.2fs)...\n', ...
    selected_sat.id, cfg.mpc.horizon, cfg.mpc.dt);

mpc_out = run_mpc_simulation(selected_sat, target, cfg.mpc.simulation_steps, cfg.mpc.dt, cfg);

% 5. Simulated Target Acquisition and Observation Image Metadata
fprintf('[Phase 5] Target acquired at (%.2f N, %.2f E). Capturing simulated image...\n', ...
    target.latitude, target.longitude);

observation_image.status = 'SUCCESS';
observation_image.satellite_id = selected_sat.id;
observation_image.coordinates = [target.latitude, target.longitude];
observation_image.resolution_m = 0.5;
observation_image.cloud_cover_percent = 4.2;
observation_image.spectral_bands = {'Red', 'Green', 'Blue', 'Near-Infrared'};
observation_image.timestamp = datestr(now, 'yyyy-mm-dd HH:MM:SS');

% 6. Constellation Telemetry Feedback Loop
fprintf('[Phase 6] Updating constellation-wide telemetry feedback loop...\n');
constellation_history.time = mpc_out.time;
constellation_history.battery = zeros(length(mpc_out.time), num_sats);
constellation_history.health = zeros(length(mpc_out.time), num_sats);
constellation_history.risk = zeros(length(mpc_out.time), num_sats);
constellation_history.failure_prob = zeros(length(mpc_out.time), num_sats);

% Simulate background orbits and battery for non-executing satellites
dt = cfg.mpc.dt;
for k = 1:length(mpc_out.time)
    for i = 1:num_sats
        if i == selected_idx
            constellation_history.battery(k, i) = mpc_out.battery_log(k);
            constellation_history.health(k, i) = mpc_out.health_log(k);
        else
            % Passive orbit drain / solar charge
            constellation_history.battery(k, i) = max(0, satellites(i).battery - 0.003 * k * dt);
            constellation_history.health(k, i) = max(0.1, satellites(i).health - 0.0001 * k * dt);
        end
        risk_i = 0.55 * (1.0 - constellation_history.health(k, i)) + ...
                 0.35 * max(0.0, (40.0 - constellation_history.battery(k, i)) / 40.0);
        constellation_history.risk(k, i) = risk_i;
        constellation_history.failure_prob(k, i) = 1.0 / (1.0 + exp(-8.0 * (risk_i - 0.45)));
    end
end

% Update final state of selected satellite
satellites(selected_idx) = mpc_out.final_satellite;
satellites(selected_idx).current_task = 'TASK_COMPLETED';
satellites(selected_idx).status = 'RETURNING';

% Package final mission output
mission_out.target = target;
mission_out.targets = targets;
mission_out.initial_satellites = satellites;
mission_out.adj_matrix = adj_matrix;
mission_out.link_qualities = link_qualities;
mission_out.distances = distances;
mission_out.allocation = alloc_result;
mission_out.selected_satellite = selected_sat;
mission_out.mpc = mpc_out;
mission_out.observation_image = observation_image;
mission_out.constellation_history = constellation_history;
mission_out.completed_at = datestr(now, 'yyyy-mm-dd HH:MM:SS');

fprintf('=== MISSION PIPELINE EXECUTED SUCCESSFULLY ===\n');

end
