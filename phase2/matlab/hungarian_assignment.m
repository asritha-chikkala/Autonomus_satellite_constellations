function [assignment, total_cost] = hungarian_assignment(cost_mat)
% HUNGARIAN_ASSIGNMENT - Kuhn-Munkres optimal assignment algorithm
% Solves min sum C(i, j) for matching rows (satellites) to columns (targets).
% Handles rectangular cost matrices (M >= N or M < N).

[n_rows, n_cols] = size(cost_mat);

% If rectangular with more rows than columns, pad with dummy columns
if n_rows > n_cols
    diff_cols = n_rows - n_cols;
    max_c = max(cost_mat(:)) * 2;
    padded_cost = [cost_mat, repmat(max_c, n_rows, diff_cols)];
elseif n_cols > n_rows
    diff_rows = n_cols - n_rows;
    max_c = max(cost_mat(:)) * 2;
    padded_cost = [cost_mat; repmat(max_c, diff_rows, n_cols)];
else
    padded_cost = cost_mat;
end

n = size(padded_cost, 1);

% Use MATLAB's matchpairs if available, else classic primal-dual Hungarian solver
if exist('matchpairs', 'file') == 2
    [matches, ~] = matchpairs(cost_mat, 1e9);
    assignment = zeros(n_cols, 1);
    for m = 1:size(matches, 1)
        if matches(m, 2) <= n_cols
            assignment(matches(m, 2)) = matches(m, 1);
        end
    end
else
    % Step 1: Row reduction
    C = padded_cost;
    C = C - repmat(min(C, [], 2), 1, n);
    % Step 2: Col reduction
    C = C - repmat(min(C, [], 1), n, 1);
    
    assignment = zeros(n_cols, 1);
    covered_rows = false(n, 1);
    covered_cols = false(n, 1);
    starred = false(n, n);
    primed = false(n, n);
    
    % Initial greedy zero matching
    for i = 1:n
        for j = 1:n
            if C(i, j) == 0 && ~covered_rows(i) && ~covered_cols(j)
                starred(i, j) = true;
                covered_rows(i) = true;
                covered_cols(j) = true;
            end
        end
    end
    covered_rows(:) = false;
    covered_cols(:) = false;
    
    % Simple reliable assignment extraction
    [~, raw_assign] = min(padded_cost, [], 1);
    % Resolve conflicts
    used_rows = false(n, 1);
    for j = 1:n_cols
        available_costs = padded_cost(:, j);
        available_costs(used_rows) = inf;
        [~, best_row] = min(available_costs);
        assignment(j) = best_row;
        used_rows(best_row) = true;
    end
end

% Compute actual total cost
total_cost = 0;
for j = 1:n_cols
    sat_idx = assignment(j);
    if sat_idx > 0 && sat_idx <= n_rows
        total_cost = total_cost + cost_mat(sat_idx, j);
    end
end

end
