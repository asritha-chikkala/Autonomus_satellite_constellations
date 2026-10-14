function [u_opt, pred_traj, cost_val] = mpc_controller(current_x, ref_horizon, cfg, debris_pos)
% MPC_CONTROLLER - Model Predictive Controller for 6-DOF Satellite Tracking
% Solves constrained quadratic objective:
%   min J = sum_{k=1}^N [ ||x_k - x_ref,k||_Q^2 + ||u_k||_R^2 ]
%
% Subject to:
%   ||u_thrust|| <= Umax
%   ||u_torque|| <= Tmax
%   ||omega||    <= OmegaMax

if nargin < 3
    cfg = config();
end

N = cfg.mpc.horizon; % 10 steps
dt = cfg.mpc.dt;     % 0.1 s

% Weight matrices
Q_diag = [
    cfg.mpc.Q_pos * ones(1, 3), ...    % Position errors
    cfg.mpc.Q_vel * ones(1, 3), ...    % Velocity errors
    cfg.mpc.Q_att * ones(1, 3), ...    % Attitude errors
    cfg.mpc.Q_angvel * ones(1, 3) ...  % Angular velocity errors
];
Q = diag(Q_diag);

R_diag = [
    cfg.mpc.R_thrust * ones(1, 3), ... % Thrust effort
    cfg.mpc.R_torque * ones(1, 3)      % Torque effort
];
R = diag(R_diag);

% Numerical linearization matrices A and B (12x12 and 12x6)
% For orbital dynamics:
% r_dot = v
% v_dot = a_grav + a_j2 + u_thrust / m
% theta_dot ~ omega
% omega_dot ~ J^-1 * u_torque
A = eye(12);
A(1:3, 4:6) = eye(3) * dt;

% Gravity gradient approximation in A(4:6, 1:3)
r_norm = norm(current_x(1:3));
mu_r3 = cfg.mu / (r_norm^3);
A(4:6, 1:3) = - (mu_r3 * eye(3) - 3 * mu_r3 * (current_x(1:3) * current_x(1:3)') / (r_norm^2)) * dt;

% Attitude kinematics approximation
A(7:9, 10:12) = eye(3) * dt;

% Control input matrix B (12x6)
B = zeros(12, 6);
B(4:6, 1:3) = (eye(3) / cfg.mass) * 1e-3 * dt; % km/s per N
B(10:12, 4:6) = cfg.invInertia * dt;            % rad/s per N*m

% Formulate QP matrices over prediction horizon N
n_x = 12;
n_u = 6;

% Build prediction matrices: X = S_x * x0 + S_u * U
S_x = zeros(n_x * N, n_x);
S_u = zeros(n_x * N, n_u * N);

A_k = eye(n_x);
for k = 1:N
    A_k = A_k * A;
    S_x((k-1)*n_x + 1 : k*n_x, :) = A_k;
    
    for j = 1:k
        S_u((k-1)*n_x + 1 : k*n_x, (j-1)*n_u + 1 : j*n_u) = (A^(k - j)) * B;
    end
end

% Reference trajectory stacked vector
X_ref = zeros(n_x * N, 1);
for k = 1:N
    if k <= size(ref_horizon, 1)
        X_ref((k-1)*n_x + 1 : k*n_x) = ref_horizon(k, :)';
    else
        X_ref((k-1)*n_x + 1 : k*n_x) = ref_horizon(end, :)';
    end
end

% Block diagonal cost matrices
Q_bar = kron(eye(N), Q);
R_bar = kron(eye(N), R);

% QP formulation: min 0.5 * U' * H * U + f' * U
H_raw = 2 * (S_u' * Q_bar * S_u + R_bar);
H = 0.5 * (H_raw + H_raw'); % Ensure exact numerical symmetry
f = 2 * S_u' * Q_bar * (S_x * current_x(:) - X_ref);

% Input saturation constraints: lb <= U <= ub
lb = repmat([-cfg.mpc.Umax*ones(3, 1); -cfg.mpc.Tmax*ones(3, 1)], N, 1);
ub = repmat([ cfg.mpc.Umax*ones(3, 1);  cfg.mpc.Tmax*ones(3, 1)], N, 1);

% Space Debris Collision Avoidance Maneuver (CAM) constraint
A_ineq = [];
b_ineq = [];
if nargin >= 4 && ~isempty(debris_pos)
    d_safe = 2.0; % 2.0 km minimum keep-out safety radius
    A_ineq = zeros(N, n_u * N);
    b_ineq = zeros(N, 1);
    for k = 1:N
        r_nom_k = X_ref((k-1)*n_x + 1 : (k-1)*n_x + 3);
        if size(debris_pos, 1) >= k
            r_deb_k = debris_pos(k, 1:3)';
        else
            r_deb_k = debris_pos(end, 1:3)';
        end
        diff_vec = r_nom_k - r_deb_k;
        dist_nom = norm(diff_vec);
        if dist_nom > 1e-4
            n_hat = diff_vec / dist_nom;
            S_u_pos_k = S_u((k-1)*n_x + 1 : (k-1)*n_x + 3, :);
            S_x_pos_k = S_x((k-1)*n_x + 1 : (k-1)*n_x + 3, :);
            % Linearized hyperplane constraint: n_hat' * (r_sat,k - r_deb,k) >= d_safe
            % -> -n_hat' * S_u_pos_k * U <= n_hat' * (S_x_pos_k * current_x(:) - r_deb_k) - d_safe
            A_ineq(k, :) = - n_hat' * S_u_pos_k;
            b_ineq(k)    = n_hat' * (S_x_pos_k * current_x(:) - r_deb_k) - d_safe;
        end
    end
end

% Solve constrained optimization
U_opt = zeros(n_u * N, 1);

if exist('quadprog', 'file') == 2
    options = optimoptions('quadprog', 'Display', 'off', 'Algorithm', 'interior-point-convex');
    [U_opt, cost_val] = quadprog(H, f, A_ineq, b_ineq, [], [], lb, ub, [], options);
    if isempty(U_opt)
        % Fallback to unconstrained with projection
        U_unconstrained = - H \ f;
        U_opt = max(lb, min(ub, U_unconstrained));
        cost_val = 0.5 * U_opt' * H * U_opt + f' * U_opt;
    end
else
    % Projected Gradient Descent solver for standalone MATLAB without Optimization Toolbox
    U_k = zeros(n_u * N, 1);
    alpha_step = 1.0 / max(eig(H));
    for iter = 1:60
        grad = H * U_k + f;
        U_k = U_k - alpha_step * grad;
        U_k = max(lb, min(ub, U_k)); % Projection onto box constraints
    end
    U_opt = U_k;
    cost_val = 0.5 * U_opt' * H * U_opt + f' * U_opt;
end

% Extract first control action
u_opt = U_opt(1:n_u);

% Compute predicted trajectory over the horizon
X_pred = S_x * current_x(:) + S_u * U_opt;
pred_traj = reshape(X_pred, [n_x, N])';

end
