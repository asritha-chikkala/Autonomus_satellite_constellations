function new_battery = battery_model(current_battery, thrust_magnitude, num_active_links, is_sunlit, dt, cfg)
% BATTERY_MODEL - Models battery state-of-charge (SoC) dynamics
% Accounts for idle avionics power, propulsion maneuvers, inter-satellite comm, and solar array generation.

if nargin < 6
    cfg = config();
end

% Normalized consumption rates
idle_drain = cfg.battery.nominal_drain_rate * dt;
propulsion_drain = cfg.battery.maneuver_drain_rate * (thrust_magnitude / cfg.mpc.Umax) * dt;
comm_drain = 0.002 * num_active_links * dt;

total_drain = idle_drain + propulsion_drain + comm_drain;

if is_sunlit
    recharge = cfg.battery.solar_recharge_rate * dt;
else
    recharge = 0.0;
end

new_battery = current_battery - total_drain + recharge;
new_battery = max(0.0, min(100.0, new_battery));

end
