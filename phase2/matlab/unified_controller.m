function [u_cmd, new_controller_state, diag_info] = unified_controller(type_name, state13, ref_window13, controller_state, cfg, debris_pos)
% UNIFIED_CONTROLLER - Common Simulation Interface for LMPC, NMPC, and PID
% Selectable across all benchmark scenarios.
%
% Inputs:
%   type_name        : 'LMPC', 'NMPC', or 'PID'
%   state13          : 13x1 plant state [r; v; q; omega]
%   ref_window13     : Nx13 reference window
%   controller_state : internal state struct (integrator states, warm starts)
%   cfg              : global config
%   debris_pos       : optional Nx3 debris trajectory for CAM
%
% Outputs:
%   u_cmd                : 6x1 control command [thrust; torque]
%   new_controller_state : updated controller state
%   diag_info            : diagnostic execution metrics

if nargin < 5 || isempty(cfg)
    cfg = config();
end
if nargin < 4 || isempty(controller_state)
    controller_state = struct();
end
if nargin < 6
    debris_pos = [];
end

new_controller_state = controller_state;

switch upper(type_name)
    case 'PID'
        ref_curr = ref_window13(1, :)';
        int_state = struct();
        if isfield(controller_state, 'pos_err_integral')
            int_state.pos_err_integral = controller_state.pos_err_integral;
            int_state.att_err_integral = controller_state.att_err_integral;
        end
        [u_cmd, int_state, diag_info] = pid_controller(state13, ref_curr, int_state, cfg.mpc.dt, cfg);
        new_controller_state.pos_err_integral = int_state.pos_err_integral;
        new_controller_state.att_err_integral = int_state.att_err_integral;
        
    case 'LMPC'
        % Map 13-state plant to 12-state reduced controller state
        q_ref0 = ref_window13(1, 7:10)';
        [x12, ~] = plant13_to_controller12(state13, q_ref0);
        
        % Build 12-state reference window: [r; v; delta_theta=0; omega_ref]
        N = size(ref_window13, 1);
        ref_win12 = zeros(N, 12);
        for k = 1:N
            ref_win12(k, 1:3) = ref_window13(k, 1:3);
            ref_win12(k, 4:6) = ref_window13(k, 4:6);
            ref_win12(k, 7:9) = [0, 0, 0]; % nominal attitude error reference is zero
            ref_win12(k, 10:12) = ref_window13(k, 11:13);
        end
        
        [u_cmd, pred_traj, cost_val, diag_info] = mpc_controller_linear(x12, ref_win12, cfg, debris_pos);
        new_controller_state.last_pred_traj = pred_traj;
        new_controller_state.cost = cost_val;
        
    case 'NMPC'
        u_warm = [];
        if isfield(controller_state, 'u_warm')
            u_warm = controller_state.u_warm;
        end
        [u_cmd, pred_traj, cost_val, diag_info] = nmpc_controller(state13, ref_window13, cfg, debris_pos, u_warm);
        new_controller_state.last_pred_traj = pred_traj;
        new_controller_state.cost = cost_val;
        % Shift warm start forward by one step
        N = cfg.mpc.horizon;
        if length(u_warm) == 6 * N
            new_controller_state.u_warm = [u_warm(7:end); u_warm(end-5:end)];
        end
        
    otherwise
        error('Unknown controller type: %s. Expected LMPC, NMPC, or PID.', type_name);
end

end
