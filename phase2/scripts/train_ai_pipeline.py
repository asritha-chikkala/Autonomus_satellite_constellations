import os
import sys
import json
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import pandas as pd
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))

from models.gat.gat_model import SatelliteGAT
from models.lstm.lstm_model import SatelliteLSTM
from models.random_forest.rf_model import SatelliteRandomForest
from models.feature_fusion import FeatureFusion
from models.risk_mlp.risk_mlp_model import RiskMLP

def train_pipeline():
    print("=== STARTING AI PIPELINE TRAINING (GAT, LSTM, RF, FUSION, RISK MLP) ===")
    
    data_dir = BASE_DIR / "data" / "generated"
    models_dir = BASE_DIR / "models"
    models_dir.mkdir(exist_ok=True)
    
    # 1. Load ML features generated from MATLAB simulation
    ml_feat_path = data_dir / "ml_features.csv"
    if not ml_feat_path.exists():
        raise FileNotFoundError(f"Missing {ml_feat_path}. Run MATLAB simulation first.")
        
    df_features = pd.read_csv(ml_feat_path)
    print(f"Loaded {len(df_features)} simulation feature samples from {ml_feat_path}")
    
    # Feature columns: battery, battery_drain, velocity_error, attitude_error, comm_quality, health_index, mission_load
    X_cols = ["battery", "battery_drain", "velocity_error", "attitude_error", "comm_quality", "health_index", "mission_load"]
    X = df_features[X_cols].values
    y_anom = df_features["anomaly_flag"].values
    y_risk = df_features["risk_score"].values
    y_fail = df_features["failure_prob"].values
    
    # 2. Train Random Forest model
    print("[1/4] Training Random Forest Anomaly & Risk Model...")
    rf = SatelliteRandomForest(n_estimators=80, max_depth=7, random_state=42)
    rf.fit(X, y_anom, y_risk)
    rf.save(str(models_dir / "rf_model"))
    print("  RF Feature Importances:", rf.get_feature_importances())
    
    # 3. Train LSTM Temporal Model
    print("[2/4] Training LSTM Temporal Model on Telemetry History...")
    # Prepare sequence dataset from telemetry
    seq_len = 10
    n_samples = len(X) - seq_len
    if n_samples < 50:
        # Fallback to repeating if small
        X = np.tile(X, (3, 1))
        y_risk = np.tile(y_risk, 3)
        y_fail = np.tile(y_fail, 3)
        n_samples = len(X) - seq_len

    X_seq = []
    y_lstm = []
    for i in range(n_samples):
        # input: [battery, health, velocity_error, risk, failure_prob]
        seq = np.column_stack([
            X[i:i+seq_len, 0], # battery
            X[i:i+seq_len, 5], # health
            X[i:i+seq_len, 2], # velocity_error
            y_risk[i:i+seq_len],
            y_fail[i:i+seq_len]
        ])
        X_seq.append(seq)
        # target future state (step i+seq_len)
        y_lstm.append([
            X[i+seq_len, 0], # next battery
            X[i+seq_len, 5], # next health
            y_fail[i+seq_len] # next failure prob
        ])
    
    X_seq = np.array(X_seq, dtype=np.float32)
    y_lstm = np.array(y_lstm, dtype=np.float32)
    
    # Save sequences
    np.save(str(data_dir / "lstm_sequences.npy"), X_seq)
    
    lstm_model = SatelliteLSTM(in_dim=5, hidden_dim=48, out_dim=32, num_layers=2)
    lstm_optimizer = optim.Adam(lstm_model.parameters(), lr=0.005)
    lstm_criterion = nn.MSELoss()
    
    tensor_X_seq = torch.tensor(X_seq)
    tensor_y_lstm = torch.tensor(y_lstm)
    
    lstm_model.train()
    for epoch in range(40):
        lstm_optimizer.zero_grad()
        _, preds = lstm_model(tensor_X_seq)
        loss = lstm_criterion(preds, tensor_y_lstm)
        loss.backward()
        lstm_optimizer.step()
        if (epoch + 1) % 10 == 0:
            print(f"  LSTM Epoch {epoch+1}/40 - MSE Loss: {loss.item():.5f}")
            
    torch.save(lstm_model.state_dict(), str(models_dir / "lstm_model.pth"))
    
    # 4. Train GAT Spatial Model
    print("[3/4] Training Graph Attention Network (GAT) on Satellite Topology...")
    num_sats = 8
    # Build representative constellation node features and adjacency
    node_feat = torch.tensor([
        [0.87, 0.98, 0.12, 0.45, 0.85, 0.10, 0.9],
        [0.63, 0.91, 0.21, 0.65, 0.75, 0.25, 0.7],
        [0.92, 0.99, 0.08, 0.25, 0.95, 0.05, 0.95],
        [0.45, 0.82, 0.38, 0.80, 0.50, 0.40, 0.5],
        [0.78, 0.95, 0.15, 0.55, 0.80, 0.15, 0.8],
        [0.82, 0.97, 0.11, 0.35, 0.90, 0.10, 0.85],
        [0.69, 0.89, 0.24, 0.70, 0.70, 0.20, 0.75],
        [0.94, 0.99, 0.07, 0.15, 0.98, 0.03, 0.98]
    ], dtype=torch.float32)
    
    # Adjacency with link qualities
    adj = torch.tensor([
        [1.0, 0.8, 0.9, 0.0, 0.0, 0.7, 0.0, 0.0],
        [0.8, 1.0, 0.7, 0.6, 0.0, 0.0, 0.0, 0.0],
        [0.9, 0.7, 1.0, 0.0, 0.8, 0.0, 0.0, 0.6],
        [0.0, 0.6, 0.0, 1.0, 0.0, 0.0, 0.5, 0.0],
        [0.0, 0.0, 0.8, 0.0, 1.0, 0.7, 0.0, 0.9],
        [0.7, 0.0, 0.0, 0.0, 0.7, 1.0, 0.8, 0.0],
        [0.0, 0.0, 0.0, 0.5, 0.0, 0.8, 1.0, 0.7],
        [0.0, 0.0, 0.6, 0.0, 0.9, 0.0, 0.7, 1.0]
    ], dtype=torch.float32)
    
    gat_model = SatelliteGAT(in_dim=7, hidden_dim=32, out_dim=64, num_heads=2)
    gat_optimizer = optim.Adam(gat_model.parameters(), lr=0.01)
    
    gat_model.train()
    for epoch in range(35):
        gat_optimizer.zero_grad()
        spatial_out, att_weights = gat_model(node_feat, adj)
        # Self-supervised spatial reconstruction loss
        loss = torch.mean((torch.matmul(spatial_out, spatial_out.T) - adj)**2)
        loss.backward()
        gat_optimizer.step()
        if (epoch + 1) % 10 == 0:
            print(f"  GAT Epoch {epoch+1}/35 - Graph Alignment Loss: {loss.item():.5f}")
            
    torch.save(gat_model.state_dict(), str(models_dir / "gat_model.pth"))
    
    # Save graph data JSON
    graph_dict = {
        "nodes": [f"SAT-0{i+1}" for i in range(num_sats)],
        "adjacency": adj.tolist(),
        "node_features": node_feat.tolist()
    }
    with open(data_dir / "gat_graph_data.json", "w") as f:
        json.dump(graph_dict, f, indent=2)

    # 5. Train Feature Fusion & Risk MLP
    print("[4/4] Training Feature Fusion & Risk MLP Network...")
    fusion = FeatureFusion(gat_dim=64, lstm_dim=32, rf_dim=32, out_dim=128)
    risk_mlp = RiskMLP(in_features=128, dropout_rate=0.2)
    
    fusion_opt = optim.Adam(list(fusion.parameters()) + list(risk_mlp.parameters()), lr=0.005)
    risk_criterion = nn.MSELoss()
    
    gat_model.eval()
    lstm_model.eval()
    with torch.no_grad():
        gat_emb, _ = gat_model(node_feat, adj) # [8, 64]
        sample_lstm_in = tensor_X_seq[:8]
        lstm_emb, _ = lstm_model(sample_lstm_in) # [8, 32]
        _, _, rf_emb = rf.predict(X[:8]) # [8, 32]
        rf_emb = torch.tensor(rf_emb, dtype=torch.float32)
        
    # Targets for Risk MLP: [Failure Prob, Mission Risk, Battery Health, Constellation Margin]
    targets_mlp = torch.tensor([
        [0.08, 0.12, 0.87, 0.90],
        [0.21, 0.25, 0.63, 0.75],
        [0.04, 0.08, 0.92, 0.95],
        [0.38, 0.42, 0.45, 0.55],
        [0.15, 0.18, 0.78, 0.82],
        [0.10, 0.13, 0.82, 0.88],
        [0.22, 0.26, 0.69, 0.72],
        [0.03, 0.06, 0.94, 0.98]
    ], dtype=torch.float32)
    
    fusion.train()
    risk_mlp.train()
    for epoch in range(50):
        fusion_opt.zero_grad()
        fused = fusion(gat_emb, lstm_emb, rf_emb) # [8, 128]
        out_risk = risk_mlp(fused)                # [8, 4]
        loss = risk_criterion(out_risk, targets_mlp)
        loss.backward()
        fusion_opt.step()
        if (epoch + 1) % 10 == 0:
            print(f"  Risk MLP Epoch {epoch+1}/50 - MSE Loss: {loss.item():.5f}")
            
    torch.save(fusion.state_dict(), str(models_dir / "fusion_model.pth"))
    torch.save(risk_mlp.state_dict(), str(models_dir / "risk_mlp.pth"))
    
    print("\n=== ALL AI MODELS TRAINED AND SAVED TO models/ ===")
    print("  [OK] GAT Model       : models/gat_model.pth")
    print("  [OK] LSTM Model      : models/lstm_model.pth")
    print("  [OK] Random Forest   : models/rf_model_clf.joblib, models/rf_model_reg.joblib")
    print("  [OK] Feature Fusion  : models/fusion_model.pth")
    print("  [OK] Risk MLP        : models/risk_mlp.pth")
    print("  [OK] Dataset outputs : data/generated/gat_graph_data.json, lstm_sequences.npy")

if __name__ == "__main__":
    train_pipeline()
