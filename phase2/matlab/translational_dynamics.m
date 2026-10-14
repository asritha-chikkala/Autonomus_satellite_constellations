function drdt = translational_dynamics(t, state, thrust, cfg)
% TRANSLATIONAL_DYNAMICS - 3-DOF Newton-Euler Translational Equations of Motion
% Includes Two-Body Gravity, Earth Oblateness (J2 Perturbation), and Thruster Input.
%
% State: [r_x, r_y, r_z, v_x, v_y, v_z]' (Position [km], Velocity [km/s])
% Thrust: 3x1 thrust force in [N]

if nargin < 4
    cfg = config();
end

r = state(1:3); % [km]
v = state(4:6); % [km/s]

r_norm = norm(r);

% 1. Keplerian Central Body Acceleration [km/s^2]
a_grav = - (cfg.mu / (r_norm^3)) * r;

% 2. J2 Perturbation Acceleration [km/s^2]
z2_r2 = (r(3) / r_norm)^2;
factor_j2 = 1.5 * cfg.J2 * (cfg.mu * cfg.Re^2) / (r_norm^5);
a_j2 = factor_j2 * [
    r(1) * (5 * z2_r2 - 1);
    r(2) * (5 * z2_r2 - 1);
    r(3) * (5 * z2_r2 - 3)
];

% 3. Applied Thrust Acceleration [km/s^2]
% Physical unit conversion: thrust [N] / cfg.mass [kg] yields acceleration in m/s^2.
% Conversion to km/s^2: 1 m/s^2 = 1e-3 km/s^2.
% For a 150 kg spacecraft with 5.0 N thrust in physically calibrated mode:
%   a_phys = (5.0 / 150.0) * 1e-3 = 3.3333e-5 km/s^2 (= 0.03333 m/s^2).
% In accelerated demonstration mode, thrust_scale (default: 18.0) scales the effective
% divert authority to resolve maneuver differences across the 4.0-second interactive UI window.
thrust_scale = 18.0;
if isfield(cfg, 'thrust_scale') && ~isempty(cfg.thrust_scale)
    thrust_scale = cfg.thrust_scale;
end
a_thrust = (thrust(:) / cfg.mass) * thrust_scale;

% Total translational derivative
drdt = zeros(6, 1);
drdt(1:3) = v;
drdt(4:6) = a_grav + a_j2 + a_thrust;

end
