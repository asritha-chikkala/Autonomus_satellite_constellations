function cfg = config()
% CONFIG - Global configuration parameters for Autonomous Satellite Constellation
% Coordinates, physical constants, MPC weights, and task allocation parameters.

%% Physical and Earth Constants
cfg.mu = 398600.4418;           % Earth gravitational parameter [km^3/s^2]
cfg.Re = 6378.137;              % Earth equatorial radius [km]
cfg.J2 = 1.08263e-3;            % Earth J2 perturbation coefficient
cfg.omega_earth = 7.2921159e-5; % Earth rotation rate [rad/s]

%% Constellation Properties
cfg.num_satellites = 20;
cfg.satellite_ids = {
    'SAT-01', 'SAT-02', 'SAT-03', 'SAT-04', 'SAT-05', ...
    'SAT-06', 'SAT-07', 'SAT-08', 'SAT-09', 'SAT-10', ...
    'SAT-11', 'SAT-12', 'SAT-13', 'SAT-14', 'SAT-15', ...
    'SAT-16', 'SAT-17', 'SAT-18', 'SAT-19', 'SAT-20'
};
cfg.mass = 150.0;               % Dry mass [kg]
cfg.Inertia = diag([25.0, 20.0, 15.0]); % Moment of Inertia matrix [kg*m^2]
cfg.invInertia = inv(cfg.Inertia);

%% Orbital Altitudes and Inclinations
cfg.nominal_altitude = 550.0;   % Nominal orbit altitude [km]
cfg.nominal_radius = cfg.Re + cfg.nominal_altitude;
cfg.nominal_speed = sqrt(cfg.mu / cfg.nominal_radius); % Circular orbital velocity [km/s]
cfg.orbital_period = 2 * pi * sqrt(cfg.nominal_radius^3 / cfg.mu); % [s]

%% Inter-Satellite Communication Parameters
cfg.max_comm_distance = 3200.0; % Maximum inter-satellite communication range [km]
cfg.min_elevation_angle = 5.0;  % Minimum elevation angle [deg]
cfg.data_rate_nominal = 100.0;  % Mbps nominal link capacity
cfg.los_buffer = 50.0;          % Buffer altitude above earth surface for LOS check [km]

%% Cost Matrix Allocation Weights (as specified in architecture)
% C(i,j) = alpha*Distance + beta*Risk - gamma*Battery + delta*Delay
cfg.alpha = 0.40;   % Distance weight
cfg.beta  = 0.25;   % Risk weight
cfg.gamma = 0.25;   % Battery weight
cfg.delta = 0.10;   % Delay weight

%% Model Predictive Controller (MPC) Parameters
cfg.mpc.horizon = 10;           % Prediction horizon N
cfg.mpc.dt = 0.1;               % Sampling time [s]
cfg.mpc.simulation_steps = 40;  % 40 steps * 0.1s = 4.0s simulation window (optimal for fast convergence)
cfg.mpc.Umax = 5.0;             % Maximum thrust force [N]
cfg.thrust_scale = 18.0;        % Demonstration acceleration scaling factor.
                                % Note: Physical 5N RCS divert over 4s is 0.27m (sub-meter). 
                                % To visually resolve and benchmark closed-loop orbital steering 
                                % across a 3km acquisition offset within a fast 4.0s interactive window,
                                % thrust_scale normalizes effective divert authority. All 3 controllers
                                % (NMPC, LMPC, PID) share the identical mass, scale, and 5.0N vector limit.
cfg.mpc.Tmax = 0.5;             % Maximum control torque [N*m]
cfg.mpc.OmegaMax = 0.15;        % Maximum angular velocity [rad/s]
cfg.mpc.Q_pos = 10.0;           % State penalty for position error
cfg.mpc.Q_vel = 2.0;            % State penalty for velocity error
cfg.mpc.Q_att = 5.0;            % State penalty for attitude (quaternion/angle) error
cfg.mpc.Q_angvel = 1.0;         % State penalty for angular velocity error
cfg.mpc.R_thrust = 0.1;         % Control effort penalty for thrust
cfg.mpc.R_torque = 0.05;        % Control effort penalty for torque

%% Battery and Health Degradation Rates
cfg.battery.nominal_drain_rate = 0.005;  % Nominal discharge % per step
cfg.battery.maneuver_drain_rate = 0.04;  % Discharge % per step during thrusting
cfg.battery.solar_recharge_rate = 0.02;  % Recharge % per step in sunlight
cfg.health.nominal_decay = 0.0002;       % Degradation per step
cfg.health.fault_decay = 0.02;          % Degradation during anomaly

%% Paths
cfg.results_dir = fullfile(fileparts(mfilename('fullpath')), '..', 'results');
cfg.figures_dir = fullfile(cfg.results_dir, 'figures');
cfg.csv_dir = fullfile(cfg.results_dir, 'csv');
cfg.json_dir = fullfile(cfg.results_dir, 'json');
cfg.data_dir = fullfile(fileparts(mfilename('fullpath')), '..', 'data', 'generated');

end
