function result = task_allocation(satellites, targets, cfg)
% TASK_ALLOCATION - Executes and benchmarks Hungarian, Auction, and Greedy algorithms
% Computes metrics: Total Cost, Execution Time, Distance, Energy Usage, Success Rate.

if nargin < 3
    cfg = config();
end

% 1. Compute Cost Matrix
[C, details] = cost_matrix(satellites, targets, cfg);

% 2. Benchmark Hungarian Algorithm
tic;
[assign_hungarian, cost_hungarian] = hungarian_assignment(C);
time_hungarian = toc * 1000; % ms

% 3. Benchmark Auction Algorithm
tic;
[assign_auction, cost_auction] = auction_assignment(C, 0.005);
time_auction = toc * 1000; % ms

% 4. Benchmark Greedy Algorithm
tic;
[assign_greedy, cost_greedy] = greedy_assignment(C);
time_greedy = toc * 1000; % ms

% 5. Detailed metrics evaluation for each algorithm
num_targets = length(targets);

eval_metrics = @(assign) struct(...
    'total_distance', sum(arrayfun(@(j) details(assign(j), j).distance_km, 1:num_targets)), ...
    'avg_battery', mean(arrayfun(@(j) satellites(assign(j)).battery, 1:num_targets)), ...
    'avg_risk', mean(arrayfun(@(j) satellites(assign(j)).risk, 1:num_targets)), ...
    'energy_est', sum(arrayfun(@(j) 0.05 * details(assign(j), j).distance_km / 1000 + (100 - satellites(assign(j)).battery)*0.02, 1:num_targets)), ...
    'success_rate', mean(arrayfun(@(j) max(0.60, 1.0 - satellites(assign(j)).failure_prob), 1:num_targets)) * 100 ...
);

metrics_h = eval_metrics(assign_hungarian);
metrics_a = eval_metrics(assign_auction);
metrics_g = eval_metrics(assign_greedy);

% Determine chosen satellite for primary mission (Target 1)
selected_sat_idx = assign_hungarian(1);
selected_satellite = satellites(selected_sat_idx);

% Package results structure
result.cost_matrix = C;
result.cost_details = details;
result.selected_satellite_id = selected_satellite.id;
result.selected_satellite_index = selected_sat_idx;
result.selected_strategy = 'Hungarian';
result.selection_reason = 'Lowest overall mission cost with optimal multi-agent utility and certified convergence';

result.hungarian.assignment = assign_hungarian;
result.hungarian.total_cost = cost_hungarian;
result.hungarian.exec_time_ms = time_hungarian;
result.hungarian.distance_km = metrics_h.total_distance;
result.hungarian.energy_usage = metrics_h.energy_est;
result.hungarian.success_rate = metrics_h.success_rate;

result.auction.assignment = assign_auction;
result.auction.total_cost = cost_auction;
result.auction.exec_time_ms = time_auction;
result.auction.distance_km = metrics_a.total_distance;
result.auction.energy_usage = metrics_a.energy_est;
result.auction.success_rate = metrics_a.success_rate;

result.greedy.assignment = assign_greedy;
result.greedy.total_cost = cost_greedy;
result.greedy.exec_time_ms = time_greedy;
result.greedy.distance_km = metrics_g.total_distance;
result.greedy.energy_usage = metrics_g.energy_est;
result.greedy.success_rate = metrics_g.success_rate;

end
