import torch
import torch.nn as nn
import torch.nn.functional as F

class GraphAttentionLayer(nn.Module):
    """
    Standard multi-head Graph Attention Layer (Velickovic et al.)
    Computes dynamic attention coefficients between connected satellite nodes.
    """
    def __init__(self, in_features: int, out_features: int, dropout: float = 0.1, alpha: float = 0.2, concat: bool = True):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.dropout = dropout
        self.alpha = alpha
        self.concat = concat

        self.W = nn.Linear(in_features, out_features, bias=False)
        self.a = nn.Parameter(torch.empty(size=(2 * out_features, 1)))
        nn.init.xavier_uniform_(self.W.weight.data, gain=1.414)
        nn.init.xavier_uniform_(self.a.data, gain=1.414)

        self.leakyrelu = nn.LeakyReLU(self.alpha)

    def forward(self, h: torch.Tensor, adj: torch.Tensor):
        # h: [N, in_features]
        # adj: [N, N] (adjacency matrix with optional link qualities)
        Wh = self.W(h) # [N, out_features]
        N = Wh.size(0)

        # Broadcast addition for pairwise attention inputs: [N, N, 2*out_features]
        a_input = torch.cat([Wh.repeat(1, N).view(N * N, -1), Wh.repeat(N, 1)], dim=1).view(N, N, 2 * self.out_features)
        e = self.leakyrelu(torch.matmul(a_input, self.a).squeeze(2)) # [N, N]

        # Mask non-connected nodes (where adj <= 0) with a large negative value
        zero_vec = -9e15 * torch.ones_like(e)
        # Include self-loops in adj
        adj_with_self = adj + torch.eye(N, device=adj.device)
        attention = torch.where(adj_with_self > 0, e, zero_vec)
        attention = F.softmax(attention, dim=1)
        attention = F.dropout(attention, self.dropout, training=self.training)

        h_prime = torch.matmul(attention, Wh) # [N, out_features]

        if self.concat:
            return F.elu(h_prime), attention
        else:
            return h_prime, attention


class SatelliteGAT(nn.Module):
    """
    Graph Attention Network for Satellite Constellation Spatial Processing.
    Input node features (dim=7): [pos_norm, vel_norm, battery, health, risk, dist_to_target, link_quality]
    Output spatial features (dim=64).
    """
    def __init__(self, in_dim: int = 7, hidden_dim: int = 32, out_dim: int = 64, num_heads: int = 2, dropout: float = 0.1):
        super().__init__()
        self.dropout = dropout
        self.num_heads = num_heads

        # Multi-head attention layers
        self.att_heads = nn.ModuleList([
            GraphAttentionLayer(in_dim, hidden_dim, dropout=dropout, concat=True)
            for _ in range(num_heads)
        ])
        
        # Second layer aggregating heads to out_dim (64)
        self.out_att = GraphAttentionLayer(hidden_dim * num_heads, out_dim, dropout=dropout, concat=False)

    def forward(self, x: torch.Tensor, adj: torch.Tensor):
        head_outputs = []
        attentions = []
        for att in self.att_heads:
            out, att_w = att(x, adj)
            head_outputs.append(out)
            attentions.append(att_w)
            
        h1 = torch.cat(head_outputs, dim=1)
        h1 = F.dropout(h1, self.dropout, training=self.training)
        
        spatial_features, final_att = self.out_att(h1, adj)
        return spatial_features, final_att
