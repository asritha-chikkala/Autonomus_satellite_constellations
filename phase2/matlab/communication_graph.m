function [adj_matrix, link_qualities, distances] = communication_graph(satellites, cfg)
% COMMUNICATION_GRAPH - Computes dynamic inter-satellite communication topology
% Architecture: A(t) = f(Line-of-Sight, Distance, Link Quality)
%
% Outputs:
%   adj_matrix     : NxN binary/weighted connectivity graph
%   link_qualities : NxN matrix of link quality scores [0, 1]
%   distances      : NxN distance matrix in kilometers

if nargin < 2
    cfg = config();
end

num_sats = length(satellites);
adj_matrix = zeros(num_sats, num_sats);
link_qualities = zeros(num_sats, num_sats);
distances = zeros(num_sats, num_sats);

re_effective = cfg.Re + cfg.los_buffer; % Earth radius + atmospheric buffer

for i = 1:num_sats
    r_i = satellites(i).position;
    for j = (i+1):num_sats
        r_j = satellites(j).position;
        
        % 1. Euclidean distance
        d_ij = norm(r_i - r_j);
        distances(i, j) = d_ij;
        distances(j, i) = d_ij;
        
        % 2. Line of Sight (LOS) calculation relative to Earth sphere
        r_ij = r_j - r_i;
        norm_rij_sq = dot(r_ij, r_ij);
        if norm_rij_sq > 0
            t_star = - dot(r_i, r_ij) / norm_rij_sq;
        else
            t_star = -1;
        end
        
        if t_star > 0 && t_star < 1
            % Closest point lies on the line segment between the two satellites
            closest_pt = r_i + t_star * r_ij;
            min_dist_to_center = norm(closest_pt);
        else
            min_dist_to_center = min(norm(r_i), norm(r_j));
        end
        
        los_clear = (min_dist_to_center >= re_effective);
        
        % 3. Link Quality modeling
        if los_clear && (d_ij <= cfg.max_comm_distance)
            % Free space path loss and distance degradation
            dist_factor = (1.0 - (d_ij / cfg.max_comm_distance))^1.5;
            
            % Health and risk impact on transceiver
            transceiver_health = 0.5 * (satellites(i).health + satellites(j).health);
            risk_penalty = 1.0 - 0.3 * (satellites(i).risk + satellites(j).risk);
            
            q_ij = max(0.0, min(1.0, dist_factor * transceiver_health * risk_penalty));
            
            link_qualities(i, j) = q_ij;
            link_qualities(j, i) = q_ij;
            
            % Adjacency threshold
            if q_ij >= 0.15
                adj_matrix(i, j) = 1;
                adj_matrix(j, i) = 1;
            end
        end
    end
end

end
