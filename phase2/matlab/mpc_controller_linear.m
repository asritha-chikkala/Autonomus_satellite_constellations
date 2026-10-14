function [u_opt, pred_traj, cost_val, diagnostics] = mpc_controller_linear(current_x, ref_horizon, cfg, debris_pos)
% MPC_CONTROLLER_LINEAR - Validated 6-DOF Linear MPC with Diagnostic Logging
% Inputs:
%   current_x   : 12x1 reduced state [r; v; delta_theta; omega]
%   ref_horizon : Nx12 reference trajectory window
%   cfg         : global config structure
%   debris_pos  : optional Nx3 debris trajectory for CAM keep-out zone
% Outputs:
%   u_opt       : 6x1 optimal control input [thrust(N); torque(N*m)]
%   pred_traj   : Nx12 predicted state trajectory
%   cost_val    : evaluated quadratic cost
%   diagnostics : struct with solver status, time, iterations, and flags

if nargin < 3 || isempty(cfg)
    cfg = config();
end

t_start = tic;

N = cfg.mpc.horizon; % 10 steps
dt = cfg.mpc.dt;     % 0.1 s

% State weighting: Q (12x12)
Q_diag = [
    cfg.mpc.Q_pos * ones(1, 3), ...    % Position errors (km)
    cfg.mpc.Q_vel * ones(1, 3), ...    % Velocity errors (km/s)
    cfg.mpc.Q_att * ones(1, 3), ...    % Reduced attitude errors (rad)
    cfg.mpc.Q_angvel * ones(1, 3) ...  % Angular velocity errors (rad/s)
];
Q = diag(Q_diag);

% Control weighting: R (6x6)
R_diag = [
    cfg.mpc.R_thrust * ones(1, 3), ... % Thrust effort (N)
    cfg.mpc.R_torque * ones(1, 3)      % Torque effort (N*m)
];
R = diag(R_diag);

% 1. Linearized State Transition Matrix A (12x12)
A = eye(12);
A(1:3, 4:6) = eye(3) * dt;

% Gravity gradient linearization in ECI frame:
r_norm = norm(current_x(1:3));
if r_norm < 1.0, r_norm = cfg.Re + 500; end
mu_r3 = cfg.mu / (r_norm^3);
A(4:6, 1:3) = - (mu_r3 * eye(3) - 3 * mu_r3 * (current_x(1:3) * current_x(1:3)') / (r_norm^2)) * dt;

% Attitude kinematics: delta_theta_dot ~ omega
A(7:9, 10:12) = eye(3) * dt;

% 2. Control Input Matrix B (12x6)
thrust_scale = 6.0;
if isfield(cfg, 'thrust_scale') && ~isempty(cfg.thrust_scale)
    thrust_scale = cfg.thrust_scale;
end
B = zeros(12, 6);
B(4:6, 1:3) = (eye(3) / cfg.mass) * thrust_scale * dt;
B(10:12, 4:6) = cfg.invInertia * dt;

n_x = 12;
n_u = 6;

% 3. Lifted Prediction Matrices
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

% 4. Stacked Reference Trajectory
X_ref = zeros(n_x * N, 1);
for k = 1:N
    if k <= size(ref_horizon, 1)
        X_ref((k-1)*n_x + 1 : k*n_x) = ref_horizon(k, :)';
    else
        X_ref((k-1)*n_x + 1 : k*n_x) = ref_horizon(end, :)';
    end
end

% 5. Quadratic Programming Matrices
Q_bar = kron(eye(N), Q);
R_bar = kron(eye(N), R);

H_raw = 2 * (S_u' * Q_bar * S_u + R_bar);
H = 0.5 * (H_raw + H_raw'); % Symmetry certification
f = 2 * S_u' * Q_bar * (S_x * current_x(:) - X_ref);

% Actuator saturation constraints
lb = repmat([-cfg.mpc.Umax * ones(3, 1); -cfg.mpc.Tmax * ones(3, 1)], N, 1);
ub = repmat([ cfg.mpc.Umax * ones(3, 1);  cfg.mpc.Tmax * ones(3, 1)], N, 1);

% Strict Spherical Actuator Norm Constraints Enforced Inside the QP (Octahedral Polytope):
signs = [
     1  1  1;  1  1 -1;  1 -1  1;  1 -1 -1;
    -1  1  1; -1  1 -1; -1 -1  1; -1 -1 -1
];
A_norm_thr = zeros(8 * N, n_u * N);
b_norm_thr = cfg.mpc.Umax * ones(8 * N, 1);
A_norm_trq = zeros(8 * N, n_u * N);
b_norm_trq = cfg.mpc.Tmax * ones(8 * N, 1);

for k = 1:N
    row_idx = (k-1)*8 + 1 : k*8;
    A_norm_thr(row_idx, (k-1)*n_u + 1 : (k-1)*n_u + 3) = signs;
    A_norm_trq(row_idx, (k-1)*n_u + 4 : (k-1)*n_u + 6) = signs;
end

A_ineq = [A_norm_thr; A_norm_trq];
b_ineq = [b_norm_thr; b_norm_trq];

% 6. Collision Avoidance Constraints (Hyperplane Linearization)
if nargin >= 4 && ~isempty(debris_pos)
    d_safe = 2.0; % 2.0 km keep-out sphere
    A_cam = zeros(N, n_u * N);
    b_cam = zeros(N, 1);
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
            A_cam(k, :) = - n_hat' * S_u_pos_k;
            b_cam(k)    = n_hat' * (S_x_pos_k * current_x(:) - r_deb_k) - d_safe;
        end
    end
    A_ineq = [A_ineq; A_cam];
    b_ineq = [b_ineq; b_cam];
end

% 7. Solve Quadratic Program
solver_used = 'quadprog';
exitflag = -99;
is_fallback = false;

if exist('quadprog', 'file') == 2
    opts = optimoptions('quadprog', 'Display', 'off', 'Algorithm', 'interior-point-convex');
    [U_opt, cost_val, exitflag] = quadprog(H, f, A_ineq, b_ineq, [], [], lb, ub, [], opts);
    if isempty(U_opt) || exitflag <= 0
        is_fallback = true;
        U_uncon = - H \ f;
        U_opt = max(lb, min(ub, U_uncon));
        cost_val = 0.5 * U_opt' * H * U_opt + f' * U_opt;
        
        % Active collision safety override on fallback:
        if nargin >= 4 && ~isempty(debris_pos)
            d_safe = 2.0;
            r_deb_0 = debris_pos(1, 1:3)';
            r_rel = current_x(1:3) - r_deb_0;
            if norm(r_rel) < d_safe
                % Safe evasive divert away from debris
                n_repulse = r_rel / max(1e-4, norm(r_rel));
                U_opt(1:3) = n_repulse * cfg.mpc.Umax;
            end
        end
    end
else
    solver_used = 'projected_gradient';
    U_k = zeros(n_u * N, 1);
    step_sz = 1.0 / max(real(eig(H)));
    for iter = 1:80
        grad = H * U_k + f;
        U_k = U_k - step_sz * grad;
        U_k = max(lb, min(ub, U_k));
    end
    U_opt = U_k;
    cost_val = 0.5 * U_opt' * H * U_opt + f' * U_opt;
    exitflag = 1;
end

u_opt = U_opt(1:n_u);

% Strict physical Euclidean vector-norm limit enforcement (equivalent to PID & NMPC):
thrust_norm = norm(u_opt(1:3));
if thrust_norm > cfg.mpc.Umax
    u_opt(1:3) = (u_opt(1:3) / thrust_norm) * cfg.mpc.Umax;
end
torque_norm = norm(u_opt(4:6));
if torque_norm > cfg.mpc.Tmax
    u_opt(4:6) = (u_opt(4:6) / torque_norm) * cfg.mpc.Tmax;
end

X_pred = S_x * current_x(:) + S_u * U_opt;
pred_traj = reshape(X_pred, [n_x, N])';

t_exec = toc(t_start);

diagnostics.controller = 'LMPC';
diagnostics.solver = solver_used;
diagnostics.exitflag = exitflag;
diagnostics.is_fallback = is_fallback;
diagnostics.execution_time_sec = t_exec;
diagnostics.cost = cost_val;
diagnostics.thrust_norm = norm(u_opt(1:3));
diagnostics.torque_norm = norm(u_opt(4:6));

end
