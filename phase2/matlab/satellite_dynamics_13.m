function dxdt = satellite_dynamics_13(t, x, u, cfg)
% SATELLITE_DYNAMICS_13 - Rigorous 13-State Plant Dynamics with Quaternions
% Plant state x (13x1):
%   x(1:3)   : Position r [km]
%   x(4:6)   : Velocity v [km/s]
%   x(7:10)  : Unit Quaternion q = [q1, q2, q3, q4]' (vector first, scalar last)
%   x(11:13) : Body angular velocity omega [rad/s]
%
% Control input u (6x1):
%   u(1:3)   : Thrust force [N]
%   u(4:6)   : Control torque [N*m]

if nargin < 4
    cfg = config();
end

if nargin < 3 || isempty(u)
    u = zeros(6, 1);
end

r = x(1:3);
v = x(4:6);
q = x(7:10);
omega = x(11:13);

% Normalize quaternion to prevent numerical drift
q_norm = norm(q);
if q_norm > 1e-8
    q = q / q_norm;
else
    q = [0; 0; 0; 1];
end

% 1. Translational dynamics (Keplerian Gravity + J2 + Thruster)
drdt = translational_dynamics(t, [r; v], u(1:3), cfg);

% 2. Quaternion Kinematics: dq/dt = 0.5 * Omega(omega) * q
% Using [q_vec; q_scalar] convention:
qv = q(1:3);
qs = q(4);
dq_vec = 0.5 * (qs * eye(3) + skew(qv)) * omega;
dq_scalar = -0.5 * dot(qv, omega);
dqdt = [dq_vec; dq_scalar];

% 3. Rigid Body Rotational Dynamics: J * omega_dot + omega x (J * omega) = torque
J = cfg.Inertia;
invJ = cfg.invInertia;
torque = u(4:6);
domega_dt = invJ * (torque(:) - cross(omega, J * omega));

dxdt = [drdt; dqdt; domega_dt];

end

function S = skew(w)
S = [
     0,    -w(3),  w(2);
     w(3),  0,    -w(1);
    -w(2),  w(1),  0
];
end
