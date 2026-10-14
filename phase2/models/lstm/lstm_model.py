import torch
import torch.nn as nn

class SatelliteLSTM(nn.Module):
    """
    LSTM Temporal Prediction Model for Satellite Telemetry Forecasting.
    Input: Sequence of telemetry history [batch_size, seq_len, in_dim]
           features: [battery, health, velocity_norm, risk, failure_prob]
    Outputs:
      - temporal_features: [batch_size, out_dim=32]
      - predictions: [batch_size, 3] -> (predicted_future_battery, predicted_health, predicted_failure_prob)
    """
    def __init__(self, in_dim: int = 5, hidden_dim: int = 48, out_dim: int = 32, num_layers: int = 2, dropout: float = 0.1):
        super().__init__()
        self.in_dim = in_dim
        self.hidden_dim = hidden_dim
        self.out_dim = out_dim
        
        self.lstm = nn.LSTM(
            input_size=in_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        
        self.fc_temporal = nn.Linear(hidden_dim, out_dim)
        self.fc_pred = nn.Sequential(
            nn.Linear(out_dim, 16),
            nn.ReLU(),
            nn.Linear(16, 3),
            nn.Sigmoid()
        )

    def forward(self, x: torch.Tensor):
        # x: [batch, seq_len, in_dim]
        lstm_out, (h_n, c_n) = self.lstm(x)
        # Use final hidden state
        last_step = lstm_out[:, -1, :]
        temporal_features = F_relu = torch.relu(self.fc_temporal(last_step))
        predictions = self.fc_pred(temporal_features)
        return temporal_features, predictions
