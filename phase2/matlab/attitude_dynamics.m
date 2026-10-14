function dtheta_dt = attitude_dynamics(t, att_state, torque, cfg)
% ATTITUDE_DYNAMICS - 3-DOF Rotational Equations of Motion
% Rigid body attitude dynamics using Euler's equations and kinematic relationship.
%
% att_state: [phi; theta; psi; omega_x; omega_y; omega_z]
% phi, theta, psi: Euler 3-2-1 angles (Roll, Pitch, Yaw) [rad]
% omega: Body angular velocities [rad/s]
% torque: 3x1 control torque [N*m]

if nargin < 4
    cfg = config();
end

euler = att_state(1:3); % [phi; theta; psi]
omega = att_state(4:6); % body angular rates [rad/s]

phi   = euler(1);
theta = euler(2);

% Kinematic transformation matrix (avoid singular pitch near +-pi/2)
cos_th = cos(theta);
if abs(cos_th) < 1e-4
    cos_th = 1e-4 * sign(cos_th);
end
sin_th = sin(theta);
tan_th = sin_th / cos_th;
sin_ph = sin(phi);
cos_ph = cos(phi);

W = [
    1,  sin_ph * tan_th,  cos_ph * tan_th;
    0,  cos_ph,          -sin_ph;
    0,  sin_ph / cos_th,  cos_ph / cos_th
];

euler_dot = W * omega;

% Dynamic Euler's equations: J*omega_dot + omega x (J*omega) = torque
% omega_dot = J^-1 * (torque - omega x (J * omega))
J_omega = cfg.Inertia * omega;
cross_term = cross(omega, J_omega);
omega_dot = cfg.invInertia * (torque(:) - cross_term);

dtheta_dt = zeros(6, 1);
dtheta_dt(1:3) = euler_dot;
dtheta_dt(4:6) = omega_dot;

end
