# METHODOLOGY & MATHEMATICAL FORMULATION

## Autonomous Satellite Constellation Coordination using Multi-Agent Systems & 6-DOF MPC

This document outlines the theoretical, algorithmic, and mathematical foundations implemented across MATLAB, Python PyTorch/Scikit-learn, and the Mission Control Web Platform.

---

## 1. 6-DOF Spacecraft Equations of Motion

Each satellite is modeled as a 6-DOF rigid spacecraft with 3 translational degrees of freedom and 3 rotational degrees of freedom.

### 1.1 3-DOF Translational Dynamics (Newton-Euler)
The orbital state is described in the Earth-Centered Inertial (ECI) frame by position $\mathbf{r} = [x, y, z]^T \in \mathbb{R}^3$ and velocity $\mathbf{v} = [v_x, v_y, v_z]^T \in \mathbb{R}^3$:

$$\mathbf{\dot{r}} = \mathbf{v}$$

$$\mathbf{\dot{v}} = \mathbf{a}_{\text{grav}} + \mathbf{a}_{J2} + \frac{\mathbf{F}_{\text{thrust}}}{m}$$

Where:
- $\mathbf{a}_{\text{grav}} = -\frac{\mu}{\|\mathbf{r}\|^3} \mathbf{r}$ (Keplerian central body gravitational acceleration, with $\mu = 398600.4418 \text{ km}^3/\text{s}^2$)
- $\mathbf{a}_{J2}$ accounts for Earth's oblateness (second zonal harmonic $J_2 = 1.08263 \times 10^{-3}$ and equatorial radius $R_e = 6378.137 \text{ km}$):

$$\mathbf{a}_{J2} = \frac{3}{2} J_2 \frac{\mu R_e^2}{\|\mathbf{r}\|^5} \begin{bmatrix} x \left(5 \frac{z^2}{\|\mathbf{r}\|^2} - 1\right) \\ y \left(5 \frac{z^2}{\|\mathbf{r}\|^2} - 1\right) \\ z \left(5 \frac{z^2}{\|\mathbf{r}\|^2} - 3\right) \end{bmatrix}$$

- $m = 150 \text{ kg}$ is spacecraft dry mass, and $\mathbf{F}_{\text{thrust}} \in \mathbb{R}^3$ is the applied thrust vector.

### 1.2 3-DOF Rotational Dynamics (Lagrangian / Euler)
The attitude is parametrized by 3-2-1 Euler angles $\mathbf{\Theta} = [\phi, \theta, \psi]^T$ (Roll, Pitch, Yaw) and body angular rates $\boldsymbol{\omega} = [\omega_x, \omega_y, \omega_z]^T$:

$$\mathbf{\dot{\Theta}} = \mathbf{W}(\mathbf{\Theta}) \boldsymbol{\omega}$$

$$\mathbf{W}(\mathbf{\Theta}) = \begin{bmatrix} 1 & \sin\phi\tan\theta & \cos\phi\tan\theta \\ 0 & \cos\phi & -\sin\phi \\ 0 & \sin\phi/\cos\theta & \cos\phi/\cos\theta \end{bmatrix}$$

Euler's rotational dynamics for a rigid body with inertia tensor $\mathbf{J} = \text{diag}([25.0, 20.0, 15.0]) \text{ kg}\cdot\text{m}^2$:

$$\mathbf{J} \boldsymbol{\dot{\omega}} + \boldsymbol{\omega} \times (\mathbf{J} \boldsymbol{\omega}) = \boldsymbol{\tau}_{\text{control}}$$

$$\boldsymbol{\dot{\omega}} = \mathbf{J}^{-1} \left( \boldsymbol{\tau}_{\text{control}} - \boldsymbol{\omega} \times (\mathbf{J} \boldsymbol{\omega}) \right)$$

---

## 2. Dynamic Communication Graph Topology

Inter-satellite crosslinks (ISL) dynamically form and dissolve according to:

$$\mathbf{A}_{ij}(t) = f(\text{Line-of-Sight}, d_{ij}, Q_{ij})$$

1. **Euclidean Distance**:
   $$d_{ij} = \|\mathbf{r}_i - \mathbf{r}_j\|$$

2. **Line of Sight (LOS) Sphere Occlusion**:
   Let $\mathbf{r}_{ij} = \mathbf{r}_j - \mathbf{r}_i$. The point of closest approach along the ray to the center of Earth:
   $$t^* = -\frac{\mathbf{r}_i \cdot \mathbf{r}_{ij}}{\|\mathbf{r}_{ij}\|^2}$$
   The minimum ray distance $d_{\min}$ is evaluated and compared against the effective Earth radius $R_{\text{eff}} = R_e + h_{\text{buffer}}$:
   $$\text{LOS}_{ij} = \begin{cases} 1 & \text{if } d_{\min} \ge R_{\text{eff}} \\ 0 & \text{otherwise} \end{cases}$$

3. **Link Quality Score $Q_{ij}$**:
   $$Q_{ij} = \max\left(0, 1 - \frac{d_{ij}}{R_{\max}}\right)^{1.5} \times \left(\frac{H_i + H_j}{2}\right) \times \left(1 - 0.3(\text{Risk}_i + \text{Risk}_j)\right)$$
   Active connection established if $\text{LOS}_{ij} = 1$, $d_{ij} \le 3500\text{ km}$, and $Q_{ij} \ge 0.15$.

---

## 3. Machine Learning & Deep Risk Inference Pipeline

### 3.1 Graph Attention Network (GAT)
Processes spatial topology $\mathcal{G} = (\mathcal{V}, \mathcal{E})$ with 7-dimensional node feature vectors $\mathbf{h}_i$:
$$\mathbf{h}_i = \left[\frac{\text{Batt}_i}{100}, \text{Health}_i, \text{Risk}_i, d_{i, \text{tgt}}, \text{Alt}_i, Q_i, \text{Links}_i\right]^T$$

Attention coefficients $\alpha_{ij}$:
$$\alpha_{ij} = \frac{\exp\left(\text{LeakyReLU}\left(\mathbf{a}^T [\mathbf{W}\mathbf{h}_i \,\|\, \mathbf{W}\mathbf{h}_j]\right)\right)}{\sum_{k \in \mathcal{N}_i} \exp\left(\text{LeakyReLU}\left(\mathbf{a}^T [\mathbf{W}\mathbf{h}_i \,\|\, \mathbf{W}\mathbf{h}_k]\right)\right)}$$

Produces 64-dimensional spatial embedding $\mathbf{z}_i^{\text{GAT}}$.

### 3.2 LSTM Temporal Predictor
Processes sequential historical telemetry $\mathbf{X}_i = [\mathbf{x}_{i, t-K}, \dots, \mathbf{x}_{i, t}] \in \mathbb{R}^{K \times 5}$:
$$\mathbf{h}_t = \text{LSTM}(\mathbf{x}_t, \mathbf{h}_{t-1})$$
Produces 32-dimensional temporal feature vector $\mathbf{z}_i^{\text{LSTM}}$ and predicts future battery SoC, health trajectory, and temporal failure risk.

### 3.3 Random Forest Anomaly Detector
Ensemble of 80 randomized decision trees evaluated across 7 operational metrics:
- Battery drain rate
- Velocity deviation from nominal circular speed
- Attitude pointing jitter
- Transceiver link quality
- Degradation index
- Battery margin
- Mission payload duty cycle

Outputs anomaly classification flag $\hat{y}_{\text{anom}}$, risk regression score $\hat{r}$, and Gini feature importances.

### 3.4 Feature Fusion & Risk MLP
Fused multi-modal representation:
$$\mathbf{z}_{\text{fused}} = \text{LayerNorm}(\mathbf{W}_f [\mathbf{z}_i^{\text{GAT}} \,\|\, \mathbf{z}_i^{\text{LSTM}} \,\|\, \mathbf{z}_i^{\text{RF}}])$$

Exact Risk MLP architecture:
$$\mathbf{h}_1 = \text{Dropout}_{0.2}(\text{ReLU}(\mathbf{W}_1 \mathbf{z}_{\text{fused}} + \mathbf{b}_1)) \quad (128 \to 64)$$
$$\mathbf{h}_2 = \text{ReLU}(\mathbf{W}_2 \mathbf{h}_1 + \mathbf{b}_2) \quad (64 \to 32)$$
$$\hat{\mathbf{y}} = \sigma(\mathbf{W}_3 \mathbf{h}_2 + \mathbf{b}_3) \quad (32 \to 4)$$

Outputs:
1. Failure Probability $P_f \in [0, 1]$
2. Mission Risk $R_m \in [0, 1]$
3. Battery Health SoC $\in [0, 1]$
4. Constellation Margin Indicator $\in [0, 1]$

---

## 4. Multi-Agent Task Allocation Formulation

### 4.1 Cost Matrix $C(i, j)$
$$C(i, j) = \alpha \cdot \text{Distance}_{ij} + \beta \cdot \text{Risk}_i - \gamma \cdot \text{Battery}_i + \delta \cdot \text{Delay}_{ij}$$
Weights:
- $\alpha = 0.40$
- $\beta = 0.25$
- $\gamma = 0.25$
- $\delta = 0.10$

### 4.2 Algorithm Benchmarks
1. **Hungarian Algorithm**:
   Solves optimal weighted bipartite matching $\min \sum_{i,j} C(i,j) x_{ij}$ in $\mathcal{O}(N^3)$ via primal-dual path augmentation.
2. **Bertsekas Auction Algorithm**:
   Simulates decentralized economic bidding where satellites place competitive bids $b_{ij} = v_{ij} - p_j + \epsilon$ on targets until $\epsilon$-complementary slackness is attained.
3. **Greedy Heuristic**:
   Sequential myopic assignment choosing $\arg\min_{i} C(i, j)$ in $\mathcal{O}(M N)$ time.

---

## 5. Model Predictive Controller (MPC)

The assigned satellite executes constrained closed-loop tracking:

$$\min_{\mathbf{U}} J = \sum_{k=1}^N \left( \|\mathbf{x}_k - \mathbf{x}_{\text{ref}, k}\|_{\mathbf{Q}}^2 + \|\mathbf{u}_k\|_{\mathbf{R}}^2 \right)$$

Subject to:
- Discrete linear time-varying dynamics: $\mathbf{x}_{k+1} = \mathbf{A}_k \mathbf{x}_k + \mathbf{B}_k \mathbf{u}_k$
- Thrust limits: $\|\mathbf{u}_{\text{thrust}}\|_2 \le 5.0\text{ N}$
- Torque limits: $\|\boldsymbol{\tau}_{\text{control}}\|_2 \le 0.5\text{ N}\cdot\text{m}$
- Angular velocity constraints: $\|\boldsymbol{\omega}\|_2 \le 0.15\text{ rad/s}$
- Horizon $N = 10$, sampling interval $\Delta t = 0.1\text{ s}$.
