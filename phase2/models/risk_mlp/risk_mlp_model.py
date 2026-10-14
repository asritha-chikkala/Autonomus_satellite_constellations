import torch
import torch.nn as nn

class RiskMLP(nn.Module):
    """
    Risk Multi-Layer Perceptron Network.
    Exact Architecture from Specification:
        Dense(128 -> 64) -> ReLU -> Dropout(0.2)
        Dense(64 -> 32)  -> ReLU
        Dense(32 -> 4)   -> Sigmoid
    Outputs:
        1. Failure Probability
        2. Mission Risk
        3. Battery Health
        4. Constellation Margin Indicator
    """
    def __init__(self, in_features: int = 128, dropout_rate: float = 0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 64),
            nn.ReLU(),
            nn.Dropout(p=dropout_rate),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 4),
            nn.Sigmoid()
        )

    def forward(self, fused_features: torch.Tensor) -> torch.Tensor:
        # fused_features: [batch_size, 128]
        return self.net(fused_features)
