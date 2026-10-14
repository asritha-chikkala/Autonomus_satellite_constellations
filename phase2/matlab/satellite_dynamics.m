function dxdt = satellite_dynamics(t, x, u, cfg)
% SATELLITE_DYNAMICS - Complete 6-DOF Spacecraft Equations of Motion
% State vector x (12x1):
%   x(1:3)   : Position r [km]
%   x(4:6)   : Velocity v [km/s]
%   x(7:9)   : Euler angles [roll, pitch, yaw] [rad]
%   x(10:12) : Angular velocity omega [rad/s]
%
% Control vector u (6x1):
%   u(1:3)   : Thrust force [N]
%   u(4:6)   : Control torque [N*m]

if nargin < 4
    cfg = config();
end

if nargin < 3 || isempty(u)
    u = zeros(6, 1);
end

thrust = u(1:3);
torque = u(4:6);

% Evaluate translational derivatives (6x1)
drdt = translational_dynamics(t, x(1:6), thrust, cfg);

% Evaluate rotational derivatives (6x1)
datt_dt = attitude_dynamics(t, x(7:12), torque, cfg);

dxdt = [drdt; datt_dt];

end
