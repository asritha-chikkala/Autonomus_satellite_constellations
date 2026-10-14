function [new_health, new_risk, failure_prob] = health_model(current_health, battery, control_effort, has_fault, dt, cfg)
% HEALTH_MODEL - Models physical degradation and failure probability
% Returns updated health [0, 1], composite risk [0, 1], and failure probability [0, 1].

if nargin < 6
    cfg = config();
end

% Degradation rate increases under mechanical control stress or low battery
stress_factor = 1.0 + 0.5 * (control_effort / cfg.mpc.Umax);
if battery < 20.0
    stress_factor = stress_factor + 2.0 * (20.0 - battery) / 20.0;
end

decay = cfg.health.nominal_decay * stress_factor * dt;
if has_fault
    decay = decay + cfg.health.fault_decay * dt;
end

new_health = max(0.05, min(1.0, current_health - decay));

% Composite risk metric: higher when health is degraded or battery is critical
batt_penalty = max(0.0, (40.0 - battery) / 40.0);
health_penalty = (1.0 - new_health);

new_risk = min(1.0, 0.55 * health_penalty + 0.35 * batt_penalty + 0.10 * (has_fault > 0));
failure_prob = min(0.99, 1.0 / (1.0 + exp(-8.0 * (new_risk - 0.45))));

end
