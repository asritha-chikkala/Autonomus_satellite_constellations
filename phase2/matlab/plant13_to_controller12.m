function [x12, e_q] = plant13_to_controller12(x13, q_ref)
% PLANT13_TO_CONTROLLER12 - Maps 13-state plant state (r, v, q, omega) to
% 12-state reduced controller state (r, v, delta_theta, omega)
% using quaternion error representation:
% q_err = q_conj(q_ref) * q
% delta_theta = 2 * q_err(1:3) * sign(q_err(4))

r = x13(1:3);
v = x13(4:6);
q = x13(7:10);
omega = x13(11:13);

% Normalize quaternion
q = q / norm(q);

if nargin < 2 || isempty(q_ref)
    q_ref = [0; 0; 0; 1];
end
q_ref = q_ref / norm(q_ref);

% Quaternion error: q_err = q_ref^(-1) * q
% For unit quaternion: q_ref^(-1) = [-q_ref(1:3); q_ref(4)]
qv_r = q_ref(1:3);
qs_r = q_ref(4);
qv = q(1:3);
qs = q(4);

q_err_v = qs_r * qv - qs * qv_r - cross(qv_r, qv);
q_err_s = qs_r * qs + dot(qv_r, qv);

% Unwrap sign for shortest path
if q_err_s < 0
    q_err_v = -q_err_v;
    q_err_s = -q_err_s;
end

% Reduced 3-component attitude error (small angle rotation vector approx)
e_q = 2 * q_err_v;

x12 = [r; v; e_q; omega];

end
