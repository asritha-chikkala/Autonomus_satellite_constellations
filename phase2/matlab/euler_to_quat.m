function q = euler_to_quat(roll, pitch, yaw)
% EULER_TO_QUAT - Converts 3-2-1 Euler angles (rad) to unit quaternion
% Output: q = [q1; q2; q3; q4] with vector first, scalar last

cr = cos(roll / 2);  sr = sin(roll / 2);
cp = cos(pitch / 2); sp = sin(pitch / 2);
cy = cos(yaw / 2);   sy = sin(yaw / 2);

q1 = sr * cp * cy - cr * sp * sy;
q2 = cr * sp * cy + sr * cp * sy;
q3 = cr * cp * sy - sr * sp * cy;
q4 = cr * cp * cy + sr * sp * sy;

q = [q1; q2; q3; q4];
q = q / norm(q);

end
