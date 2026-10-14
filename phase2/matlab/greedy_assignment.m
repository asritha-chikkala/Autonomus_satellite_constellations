function [assignment, total_cost] = greedy_assignment(cost_mat)
% GREEDY_ASSIGNMENT - Fast greedy allocation heuristic
% Sequentially assigns targets to the available satellite with minimum cost.

[num_sats, num_targets] = size(cost_mat);
assignment = zeros(num_targets, 1);
available_sats = true(num_sats, 1);

for j = 1:num_targets
    costs = cost_mat(:, j);
    costs(~available_sats) = inf;
    
    [min_val, best_sat] = min(costs);
    if isfinite(min_val)
        assignment(j) = best_sat;
        available_sats(best_sat) = false;
    else
        % If all sats used, pick best overall
        [~, best_sat] = min(cost_mat(:, j));
        assignment(j) = best_sat;
    end
end

total_cost = 0;
for j = 1:num_targets
    sat_idx = assignment(j);
    if sat_idx > 0 && sat_idx <= num_sats
        total_cost = total_cost + cost_mat(sat_idx, j);
    end
end

end
