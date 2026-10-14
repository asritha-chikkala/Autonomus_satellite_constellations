% MAIN_SIMULATION - Entry point for Autonomous Satellite Constellation Simulation
%
% Architecture Flow:
%   1. Mission Request (Default: Lat 16.50 N, Lon 80.60 E, Earth Observation)
%   2. Constellation Initialization (8 Satellites + 1 Space Station)
%   3. 6-DOF Dynamics (3-DOF Newton-Euler Translation + 3-DOF Lagrangian Attitude)
%   4. Telemetry Collection (Position, Velocity, Attitude, Battery, Health)
%   5. Dynamic Communication Graph A(t) = f(LOS, Distance, Link Quality)
%   6. Cost Matrix Generation: C(i,j) = 0.40*Dist + 0.25*Risk - 0.25*Batt + 0.10*Delay
%   7. Task Allocation (Hungarian, Auction, Greedy comparison)
%   8. 6-DOF Model Predictive Control (Horizon = 10, dt = 0.1s)
%   9. Satellite Task Execution & Simulated Earth Observation
%  10. Constellation Telemetry Feedback Loop
%  11. Export of all CSV/JSON datasets and generation of all 20 MATLAB figures

clear; clc; close all;

fprintf('=================================================================\n');
fprintf('  AUTONOMOUS SATELLITE CONSTELLATION COORDINATION (MAS + MPC)   \n');
fprintf('=================================================================\n\n');

% Initialize configuration
cfg = config();

% Define Mission Request
target.latitude = 16.50;
target.longitude = 80.60;
target.altitude = 0.0;
target.type = 'Earth Observation';
target.priority = 'HIGH';
target.action = 'CAPTURE IMAGE';

% Execute Mission Pipeline
mission_out = mission_execution(target, cfg);

% Generate Results, Export CSVs and Render 20 Figures
generate_results(mission_out, cfg);

fprintf('\n=================================================================\n');
fprintf('  SIMULATION COMPLETED SUCCESSFULLY\n');
fprintf('  Selected Satellite : %s\n', mission_out.allocation.selected_satellite_id);
fprintf('  Strategy           : %s\n', mission_out.allocation.selected_strategy);
fprintf('  Position RMSE      : %.4f km\n', mission_out.mpc.metrics.rmse_pos);
fprintf('  Thrust Effort      : %.4f N*s\n', mission_out.mpc.metrics.total_thrust_effort);
fprintf('  Battery Consumed   : %.2f %%\n', mission_out.mpc.metrics.battery_consumed);
fprintf('  Results Location   : %s\n', cfg.results_dir);
fprintf('=================================================================\n');
