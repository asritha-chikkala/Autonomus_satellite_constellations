import torch
import torch.nn as nn

class FeatureFusion(nn.Module):
    """
    Feature Fusion Layer combining:
      - GAT spatial features (64 dims)
      - LSTM temporal features (32 dims)
      - Random Forest / Risk features (32 dims)
    Produces 128-dimensional fused representation for Risk MLP.
    """
    def __init__(self, gat_dim: int = 64, lstm_dim: int = 32, rf_dim: int = 32, out_dim: int = 128):
        super().__init__()
        self.gat_dim = gat_dim
        self.lstm_dim = lstm_dim
        self.rf_dim = rf_dim
        self.out_dim = out_dim
        
        # Linear layer with layer norm to align representations
        self.proj = nn.Sequential(
            nn.Linear(gat_dim + lstm_dim + rf_dim, out_dim),
            nn.LayerNorm(out_dim),
            nn.ReLU()
        )

    def forward(self, gat_feat: torch.Tensor, lstm_feat: torch.Tensor, rf_feat: torch.Tensor) -> torch.Tensor:
        # Concatenate: [batch, 64 + 32 + 32] = [batch, 128]
        raw_concat = torch.cat([gat_feat, lstm_feat, rf_feat], dim=-1)
        fused = self.proj(raw_concat)
        return fused
