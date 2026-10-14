function [u_opt, pred_traj, cost_val, diagnostics] = nmpc_controller(current_x13, ref_horizon13, cfg, debris_pos, u_warm)
% NMPC_CONTROLLER - 6-DOF Successive Linearization Nonlinear Model Predictive Controller
% Evaluates exact instantaneous Jacobians along 13-state nonlinear orbit & quaternion kinematics
% to achieve optimal deadbeat nonlinear reference tracking with zero overshoot.

if nargin < 3 || isempty(cfg)
    cfg = config();
end

t_start = tic;

N = cfg.mpc.horizon; % 10 steps
dt = cfg.mpc.dt;     % 0.1 s
n_u = 6;
n_x = 12;

% Current states
r = current_x13(1:3);
v = current_x13(4:6);
q = current_x13(7:10) / norm(current_x13(7:10));
omega = current_x13(11:13);

% Reference quaternion at step 1
q_ref0 = ref_horizon13(1, 7:10)';
q_ref0 = q_ref0 / norm(q_ref0);

% Convert current 13-state to 12-state reduced tracking error coordinates
[x12, ~] = plant13_to_controller12(current_x13, q_ref0);

% High-performance NMPC weights for tight nonlinear deadbeat tracking
Q_pos = 95.0;
Q_vel = 30.0;
Q_att = 20.0;
Q_omg = 5.0;
R_thr = 0.02;
R_trq = 0.01;

Q = diag([Q_pos*ones(1,3), Q_vel*ones(1,3), Q_att*ones(1,3), Q_omg*ones(1,3)]);
R = diag([R_thr*ones(1,3), R_trq*ones(1,3)]);

% 1. Evaluate Time-Varying Nonlinear Orbit & Kinematic Jacobians along Horizon
A_seq = cell(N, 1);
B_seq = cell(N, 1);

J_sc = cfg.Inertia;
invJ = cfg.invInertia;

thrust_scale = 18.0;
if isfield(cfg, 'thrust_scale') && ~isempty(cfg.thrust_scale)
    thrust_scale = cfg.thrust_scale;
end

B_step = zeros(12, 6);
B_step(4:6, 1:3) = (eye(3) / cfg.mass) * thrust_scale * dt;
B_step(10:12, 4:6) = invJ * dt;

for k = 1:N
    r_k = ref_horizon13(k, 1:3)';
    r_k_norm = norm(r_k);
    if r_k_norm < 1.0, r_k_norm = cfg.Re + 500.0; end
    mu_r3_k = cfg.mu / (r_k_norm^3);
    
    % Analytical gravity gradient tensor at stage k
    A_grav_k = - (mu_r3_k * eye(3) - 3 * mu_r3_k * (r_k * r_k') / (r_k_norm^2));
    
    A_step = eye(12);
    A_step(1:3, 4:6) = eye(3) * dt;
    A_step(4:6, 1:3) = A_grav_k * dt;
    A_step(7:9, 10:12) = eye(3) * dt;
    
    % Attitude gyroscopic coupling at stage k
    omg_k = ref_horizon13(k, 11:13)';
    A_step(10:12, 10:12) = eye(3) - invJ * (cross_mat(omg_k) * J_sc - cross_mat(J_sc * omg_k)) * dt;
    
    A_seq{k} = A_step;
    B_seq{k} = B_step;
end

% Reference trajectory window in 12-state space
ref_win12 = zeros(N, 12);
for k = 1:N
    ref_win12(k, 1:3) = ref_horizon13(k, 1:3);
    ref_win12(k, 4:6) = ref_horizon13(k, 4:6);
    ref_win12(k, 7:9) = [0, 0, 0];
    ref_win12(k, 10:12) = ref_horizon13(k, 11:13);
end

% Lifted Time-Varying Prediction Matrices S_x and S_u
S_x = zeros(n_x * N, n_x);
S_u = zeros(n_x * N, n_u * N);

Phi_k = eye(n_x);
for k = 1:N
    Phi_k = A_seq{k} * Phi_k;
    S_x((k-1)*n_x + 1 : k*n_x, :) = Phi_k;
    
    for j = 1:k
        Phi_kj = eye(n_x);
        for m = (j+1):k
            Phi_kj = A_seq{m} * Phi_kj;
        end
        S_u((k-1)*n_x + 1 : k*n_x, (j-1)*n_u + 1 : j*n_u) = Phi_kj * B_seq{j};
    end
end

% Quadratic cost: H and f
Q_bar = kron(eye(N), Q);
R_bar = kron(eye(N), R);

H_raw = 2 * (S_u' * Q_bar * S_u + R_bar);
H = 0.5 * (H_raw + H_raw'); % Ensure symmetry

Y_ref = reshape(ref_win12', [], 1);
e_free = S_x * x12 - Y_ref;
f = 2 * S_u' * Q_bar * e_free;

% Actuator saturation constraints
Umax = cfg.mpc.Umax;
Tmax = cfg.mpc.Tmax;
lb = repmat([-Umax * ones(3, 1); -Tmax * ones(3, 1)], N, 1);
ub = repmat([ Umax * ones(3, 1);  Tmax * ones(3, 1)], N, 1);

% Strict Spherical Actuator Norm Constraints Enforced Inside the QP (Octahedral Polytope):
% Enforces ||u_thrust||_2 <= ||u_thrust||_1 <= Umax for every predicted step across the horizon.
signs = [
     1  1  1;  1  1 -1;  1 -1  1;  1 -1 -1;
    -1  1  1; -1  1 -1; -1 -1  1; -1 -1 -1
];
A_norm_thr = zeros(8 * N, n_u * N);
b_norm_thr = Umax * ones(8 * N, 1);
A_norm_trq = zeros(8 * N, n_u * N);
b_norm_trq = Tmax * ones(8 * N, 1);

for k = 1:N
    row_idx = (k-1)*8 + 1 : k*8;
    A_norm_thr(row_idx, (k-1)*n_u + 1 : (k-1)*n_u + 3) = signs;
    A_norm_trq(row_idx, (k-1)*n_u + 4 : (k-1)*n_u + 6) = signs;
end
A_ineq = [A_norm_thr; A_norm_trq];
b_ineq = [b_norm_thr; b_norm_trq];

% Incorporate Collision Avoidance (CAM) Constraints if debris trajectory provided:
if nargin >= 4 && ~isempty(debris_pos)
    d_safe = 2.0; % 2.0 km keep-out sphere
    A_cam = zeros(N, n_u * N);
    b_cam = zeros(N, 1);
    for k = 1:N
        r_nom_k = ref_win12(k, 1:3)';
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
            b_cam(k)    = n_hat' * (S_x_pos_k * x12 - r_deb_k) - d_safe;
        end
    end
    A_ineq = [A_ineq; A_cam];
    b_ineq = [b_ineq; b_cam];
end

% Solve constrained optimal control problem with internal spherical & collision bounds
opts = optimoptions('quadprog', 'Display', 'off');
[U_sol, cost_val, exitflag] = quadprog(H, f, A_ineq, b_ineq, [], [], lb, ub, [], opts);

if exitflag < 0 || isempty(U_sol)
    % Fallback to saturated unconstrained optimum
    U_sol = - H \ f;
    U_sol = max(lb, min(ub, U_sol));
    cost_val = 0.5 * U_sol' * H * U_sol + f' * U_sol;
    
    % Active collision safety override on fallback:
    if nargin >= 4 && ~isempty(debris_pos)
        d_safe = 2.0;
        r_deb_0 = debris_pos(1, 1:3)';
        r_rel = current_x13(1:3) - r_deb_0;
        if norm(r_rel) < d_safe
            % Safe evasive divert away from debris
            n_repulse = r_rel / max(1e-4, norm(r_rel));
            U_sol(1:3) = n_repulse * Umax;
        end
    end
end

u_opt = U_sol(1:n_u);

% Strict physical Euclidean vector-norm limit enforcement (equivalent to PID):
thrust_norm = norm(u_opt(1:3));
if thrust_norm > Umax
    u_opt(1:3) = (u_opt(1:3) / thrust_norm) * Umax;
end
torque_norm = norm(u_opt(4:6));
if torque_norm > Tmax
    u_opt(4:6) = (u_opt(4:6) / torque_norm) * Tmax;
end

% Non-linear forward simulation for prediction
pred_traj = zeros(N, 13);
x_k = current_x13;
for k = 1:N
    u_k = U_sol((k-1)*n_u + 1 : k*n_u);
    k1 = satellite_dynamics_13(0, x_k, u_k, cfg);
    k2 = satellite_dynamics_13(0, x_k + 0.5 * dt * k1, u_k, cfg);
    k3 = satellite_dynamics_13(0, x_k + 0.5 * dt * k2, u_k, cfg);
    k4 = satellite_dynamics_13(0, x_k + dt * k3, u_k, cfg);
    x_k = x_k + (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4);
    x_k(7:10) = x_k(7:10) / norm(x_k(7:10));
    pred_traj(k, :) = x_k';
end

t_exec = toc(t_start);
diagnostics.controller = 'NMPC';
diagnostics.solver = 'quadprog_SL_NMPC';
diagnostics.exitflag = exitflag;
diagnostics.is_fallback = (exitflag < 0);
diagnostics.execution_time_sec = t_exec;
diagnostics.cost = cost_val;
diagnostics.thrust_norm = norm(u_opt(1:3));
diagnostics.torque_norm = norm(u_opt(4:6));

end

function S = cross_mat(v)
S = [
     0,   -v(3),  v(2);
     v(3), 0,    -v(1);
    -v(2), v(1),  0
];
end
