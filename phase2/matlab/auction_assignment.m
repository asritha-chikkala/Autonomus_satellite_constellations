function [assignment, total_cost] = auction_assignment(cost_mat, epsilon)
% AUCTION_ASSIGNMENT - Bertsekas distributed auction algorithm
% Multi-agent bidding where satellites bid for tasks based on marginal utility.
%
% cost_mat : (num_sats x num_targets)
% assignment : (num_targets x 1) vector of assigned satellite indices

if nargin < 2
    epsilon = 0.01;
end

[num_sats, num_targets] = size(cost_mat);

% Convert cost minimization to value maximization: V(i, j) = max(C) - C(i, j)
max_c = max(cost_mat(:));
values = max_c - cost_mat;

prices = zeros(1, num_targets);
sat_assigned = zeros(num_sats, 1); % which target sat i has (0 if none)
target_owner = zeros(num_targets, 1); % which sat owns target j (0 if none)

max_iter = 500;
iter = 0;

while any(target_owner == 0) && iter < max_iter
    iter = iter + 1;
    % Find unassigned satellite
    unassigned = find(sat_assigned == 0);
    if isempty(unassigned)
        break;
    end
    
    i = unassigned(1);
    
    % Compute net values for satellite i across all targets: v_ij - p_j
    net_values = values(i, :) - prices;
    
    [sorted_vals, sorted_indices] = sort(net_values, 'descend');
    best_target = sorted_indices(1);
    best_val = sorted_vals(1);
    
    if length(sorted_indices) > 1
        second_best_val = sorted_vals(2);
    else
        second_best_val = 0;
    end
    
    % Bid increment: delta = best_val - second_best_val + epsilon
    bid_increment = (best_val - second_best_val) + epsilon;
    
    % If target was already owned by another satellite, unassign previous owner
    prev_owner = target_owner(best_target);
    if prev_owner > 0
        sat_assigned(prev_owner) = 0;
    end
    
    % Assign target to satellite i
    target_owner(best_target) = i;
    sat_assigned(i) = best_target;
    
    % Update task price
    prices(best_target) = prices(best_target) + bid_increment;
end

assignment = target_owner;

% Calculate total cost
total_cost = 0;
for j = 1:num_targets
    sat_idx = assignment(j);
    if sat_idx > 0 && sat_idx <= num_sats
        total_cost = total_cost + cost_mat(sat_idx, j);
    end
end

end
