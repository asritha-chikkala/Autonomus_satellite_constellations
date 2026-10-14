"""
generate_methodology_svg.py
Generates presentation-ready 16:9 Widescreen (1920x1080) SVG diagrams 
for single-slide PowerPoint presentations in both Light and Dark themes.
"""

import os

def create_svg(is_dark=False):
    # Theme color definitions
    if is_dark:
        bg_main = "#060814"
        bg_card = "#0b1021"
        border_card = "#1e293b"
        border_sub = "#1e2942"
        text_title = "#f8fafc"
        text_subtitle = "#94a3b8"
        text_body = "#cbd5e1"
        text_muted = "#64748b"
        card_sub_bg = "#0f172a"
        arrow_color = "#38bdf8"
        feedback_bg = "rgba(14, 165, 233, 0.08)"
        feedback_border = "#0284c7"
    else:
        bg_main = "#ffffff"
        bg_card = "#f8fafc"
        border_card = "#e2e8f0"
        border_sub = "#cbd5e1"
        text_title = "#0f172a"
        text_subtitle = "#475569"
        text_body = "#1e293b"
        text_muted = "#64748b"
        card_sub_bg = "#ffffff"
        arrow_color = "#0284c7"
        feedback_bg = "#f0f9ff"
        feedback_border = "#0284c7"

    # Stage accent palettes [HeaderBg, AccentColor, BadgeBg, BadgeText]
    palettes = [
        # Stage 1: Sky / Cyan
        {"primary": "#0284c7", "light_bg": "#e0f2fe", "dark_bg": "#0c2842", "accent": "#0ea5e9"},
        # Stage 2: Indigo / Blue
        {"primary": "#4f46e5", "light_bg": "#e0e7ff", "dark_bg": "#1e1b4b", "accent": "#6366f1"},
        # Stage 3: Purple / Violet
        {"primary": "#7e22ce", "light_bg": "#f3e8ff", "dark_bg": "#3b0764", "accent": "#a855f7"},
        # Stage 4: Amber / Orange
        {"primary": "#b45309", "light_bg": "#fef3c7", "dark_bg": "#451a03", "accent": "#d97706"},
        # Stage 5: Emerald / Green
        {"primary": "#15803d", "light_bg": "#dcfce7", "dark_bg": "#052e16", "accent": "#16a34a"},
    ]

    col_w = 336
    gap = 35
    start_x = 50
    start_y = 155
    col_h = 765

    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" style="background-color: {bg_main}; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;">')
    
    # SVG Definitions (Gradients, Markers, Filters)
    svg.append('<defs>')
    svg.append('  <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">')
    svg.append('    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.08"/>')
    svg.append('  </filter>')
    svg.append('  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">')
    svg.append(f'    <polygon points="0 0, 10 3.5, 0 7" fill="{arrow_color}" />')
    svg.append('  </marker>')
    svg.append('  <marker id="arrowhead-feedback" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">')
    svg.append('    <polygon points="0 0, 10 3.5, 0 7" fill="#0284c7" />')
    svg.append('  </marker>')
    svg.append('</defs>')

    # 1. Slide Header
    svg.append(f'<rect x="0" y="0" width="1920" height="135" fill="{bg_main}" />')
    # Pill Tag
    svg.append(f'<rect x="50" y="25" width="460" height="26" rx="13" fill="{palettes[0]["light_bg"] if not is_dark else palettes[0]["dark_bg"]}" />')
    svg.append(f'<text x="65" y="42" font-size="11" font-weight="700" fill="{palettes[0]["primary"]}" letter-spacing="1.5">AUTONOMOUS MULTI-AGENT SATELLITE CONSTELLATION ARCHITECTURE</text>')
    
    # Title & Subtitle
    svg.append(f'<text x="50" y="80" font-size="28" font-weight="800" fill="{text_title}">System Architecture &amp; Mathematical Methodology Pipeline</text>')
    svg.append(f'<text x="50" y="110" font-size="14" font-weight="400" fill="{text_subtitle}">End-to-end framework integrating 6-DOF Keplerian-J₂ orbital dynamics, dynamic laser crosslinks, multi-modal GAT-LSTM-RF risk inference, distributed auction matching, and constrained 6-DOF MPC.</text>')

    # Meta tags / Right header badges
    svg.append(f'<g transform="translate(1450, 40)">')
    svg.append(f'  <rect x="0" y="0" width="180" height="34" rx="8" fill="{card_sub_bg}" stroke="{border_sub}" stroke-width="1"/>')
    svg.append(f'  <circle cx="20" cy="17" r="5" fill="#10b981"/>')
    svg.append(f'  <text x="35" y="22" font-size="12" font-weight="700" fill="{text_title}">20 Satellites + 1 ISS</text>')
    svg.append(f'  <rect x="195" y="0" width="225" height="34" rx="8" fill="{card_sub_bg}" stroke="{border_sub}" stroke-width="1"/>')
    svg.append(f'  <circle cx="215" cy="17" r="5" fill="#0284c7"/>')
    svg.append(f'  <text x="230" y="22" font-size="12" font-weight="700" fill="{text_title}">Closed-Loop Rate: 10 Hz (0.1s)</text>')
    svg.append(f'</g>')

    # Stage Content Data
    stages = [
        {
            "num": "STAGE 1",
            "name": "6-DOF Dynamics & Orbit",
            "tag": "PHYSICAL ENVIRONMENT",
            "blocks": [
                {
                    "title": "Orbital Geometry & Frame",
                    "badge": "ECI FRAME",
                    "lines": [
                        "• 20 LEO Satellites in 4 Walker planes",
                        "• Orbital Altitude h = 550 km, i = 53.0°",
                        "• 1 Non-Cooperative Target (ISS Node)"
                    ]
                },
                {
                    "title": "3-DOF Orbital Mechanics (J₂)",
                    "badge": "NEWTON-EULER",
                    "lines": [
                        "• ṙ = v,   v̇ = a_grav + a_J2 + (F_thrust / m)",
                        "• Keplerian: a_grav = -μ r / ‖r‖³",
                        "• Earth Oblateness (J₂ = 1.0826×10⁻³):",
                        "  a_J2 = 3/2 J₂ (μRe²/r⁵) [x(5z²/r²-1), ...]"
                    ]
                },
                {
                    "title": "3-DOF Attitude Dynamics",
                    "badge": "EULER-LAGRANGE",
                    "lines": [
                        "• Euler Angles: Θ = [ϕ, θ, ψ]ᵀ (Roll, Pitch, Yaw)",
                        "• Kinematics: Θ̇ = W(Θ) ω",
                        "• Rigid Body: J ω̇ + ω × (J ω) = τ_control",
                        "• Inertia: J = diag([25.0, 20.0, 15.0]) kg·m²"
                    ]
                },
                {
                    "title": "Stage Output",
                    "badge": "STATE VECTOR",
                    "lines": [
                        "➤ True State X(t) = [r, v, Θ, ω, Batt, Health]ᵀ",
                        "  Synchronized at microsecond epochs"
                    ]
                }
            ]
        },
        {
            "num": "STAGE 2",
            "name": "Dynamic ISL Topology",
            "tag": "GRAPH THEORY & OPTICS",
            "blocks": [
                {
                    "title": "Geometric Line-of-Sight (LOS)",
                    "badge": "EARTH OCCLUSION",
                    "lines": [
                        "• Inter-satellite vector: r_ij = r_j - r_i",
                        "• Closest ray distance: t* = -(r_i · r_ij)/‖r_ij‖²",
                        "• Occlusion check: d_min ≥ Re + h_buffer",
                        "• LOS_ij = 1 if clear ray, 0 if blocked"
                    ]
                },
                {
                    "title": "Multi-Factor Link Quality (Q)",
                    "badge": "METRIC SCORE",
                    "lines": [
                        "• Range Threshold: d_ij ≤ 3500 km (Optical)",
                        "• Q_ij = max(0, 1 - d_ij/R_max)¹·⁵",
                        "         × 0.5(Health_i + Health_j)",
                        "         × (1 - 0.3(Risk_i + Risk_j))"
                    ]
                },
                {
                    "title": "Time-Varying Graph A(t)",
                    "badge": "ADJACENCY",
                    "lines": [
                        "• Dynamic graph G(t) = (V, E(t))",
                        "• A_ij(t) = 1  ⟺  (LOS_ij = 1 ∧ Q_ij ≥ 0.15)",
                        "• Mean constellation connectivity: 14-28 links",
                        "• Decentralized multi-agent packet routing"
                    ]
                },
                {
                    "title": "Stage Output",
                    "badge": "TOPOLOGY GRAPH",
                    "lines": [
                        "➤ Graph Adjacency Matrix A(t) ∈ ℝ²¹ˣ²¹",
                        "  + Link Quality Weight Matrix Q(t)"
                    ]
                }
            ]
        },
        {
            "num": "STAGE 3",
            "name": "Multi-Modal AI Perception",
            "tag": "DEEP LEARNING / GNN",
            "blocks": [
                {
                    "title": "Graph Attention Network (GAT)",
                    "badge": "SPATIAL EMBED",
                    "lines": [
                        "• Node Features h_i ∈ ℝ⁷: [SoC, H, R, d_tgt, Alt, Q, Deg]",
                        "• Attention: α_ij = Softmax(LeakyReLU(aᵀ[Wh_i ‖ Wh_j]))",
                        "• Constellation spatial embedding: z_i^GAT ∈ ℝ⁶⁴"
                    ]
                },
                {
                    "title": "LSTM Temporal Predictor",
                    "badge": "TIME-SERIES",
                    "lines": [
                        "• Telemetry sequence window X_i ∈ ℝ^(K×5)",
                        "• Hidden states: h_t = LSTM(x_t, h_{t-1})",
                        "• Temporal degradation embedding: z_i^LSTM ∈ ℝ³²",
                        "• Predicts battery SoC drift & thermal fatigue"
                    ]
                },
                {
                    "title": "Random Forest & Risk MLP",
                    "badge": "FUSION & RISK",
                    "lines": [
                        "• Random Forest (80 trees): Anomaly score r̂",
                        "• Multi-Modal Fusion: z_fused = LayerNorm(W_f [z^GAT ‖ z^LSTM ‖ z^RF])",
                        "• MLP (128 → 64 → 32 → 4):",
                        "  P_f (Failure Prob), R_m (Mission Risk)"
                    ]
                },
                {
                    "title": "Stage Output",
                    "badge": "INFERRED HEALTH",
                    "lines": [
                        "➤ Validated Failure Risk P_f,i ∈ [0, 1]",
                        "➤ Projected Battery Capacity Margin [%]"
                    ]
                }
            ]
        },
        {
            "num": "STAGE 4",
            "name": "Multi-Agent Allocation",
            "tag": "OPTIMIZATION & AUCTION",
            "blocks": [
                {
                    "title": "Global Cost Matrix C(i, j)",
                    "badge": "UTILITY FUNCTION",
                    "lines": [
                        "• C(i, j) = α·Dist_ij + β·Risk_i - γ·Batt_i + δ·Delay_ij",
                        "• Calibrated Weights:",
                        "  α = 0.40  (Proximity & Slewing)",
                        "  β = 0.25  (AI Inferred Risk P_f)",
                        "  γ = 0.25  (Battery State-of-Charge)",
                        "  δ = 0.10  (ISL Communication Latency)"
                    ]
                },
                {
                    "title": "Hungarian Solver (Optimal)",
                    "badge": "O(N³) MATCHING",
                    "lines": [
                        "• Bipartite Primal-Dual Kuhn-Munkres:",
                        "  min ∑_{i,j} C(i,j) x_ij  s.t. ∑ x_ij = 1",
                        "• Globally minimal cost: C_norm = 0.180",
                        "• Execution latency: 1.20 ms"
                    ]
                },
                {
                    "title": "Distributed Auction (Bertsekas)",
                    "badge": "DECENTRALIZED",
                    "lines": [
                        "• Multi-agent bidding with ε-slackness:",
                        "  b_ij = v_ij - p_j + ε,   p_j ← p_j + max(b_ij)",
                        "• Decentralized consensus, 94.2% efficiency",
                        "• Greedy baseline O(MN): fast fallback"
                    ]
                },
                {
                    "title": "Stage Output",
                    "badge": "OPTIMAL DISPATCH",
                    "lines": [
                        "➤ Target Assignment Vector: Sat i* → Target j*",
                        "➤ Verified zero multi-tasking conflict"
                    ]
                }
            ]
        },
        {
            "num": "STAGE 5",
            "name": "Constrained 6-DOF MPC",
            "tag": "REAL-TIME CONTROL",
            "blocks": [
                {
                    "title": "Receding Horizon Optimization",
                    "badge": "QP FORMULATION",
                    "lines": [
                        "• min_U J = ∑_{k=1}^N (‖x_k - x_ref‖_Q² + ‖u_k‖_R²)",
                        "• Discrete Dynamics: x_{k+1} = A_k x_k + B_k u_k",
                        "• Prediction Horizon: N = 10,  Δt = 0.1 s",
                        "• Solved via OSQP Convex Solver (4.38 ms)"
                    ]
                },
                {
                    "title": "Physical Actuator Constraints",
                    "badge": "HARD LIMITS",
                    "lines": [
                        "• Thrust limit: ‖u_thrust‖₂ ≤ 5.0 N (Monopropellant)",
                        "• Torque limit: ‖τ_control‖₂ ≤ 0.5 N·m (Wheels)",
                        "• Angular rate constraint: ‖ω‖₂ ≤ 0.15 rad/s",
                        "• Actuator Saturation Check: 0.0% nominal"
                    ]
                },
                {
                    "title": "Safety & Payload Execution",
                    "badge": "MISSION TARGET",
                    "lines": [
                        "• Debris Avoidance: ‖r_sat - r_debris‖ ≥ 2.0 km",
                        "• Precision Nadir Pointing: Attitude RMSE < 3.8°",
                        "• Optical Sensor Lock & Earth Surface Imaging",
                        "• Autonomous Re-allocation if Anomaly detected"
                    ]
                },
                {
                    "title": "Stage Output",
                    "badge": "PHYSICAL ACTUATION",
                    "lines": [
                        "➤ Optimal Control Trajectory U* = [F*, τ*]ᵀ",
                        "➤ Captured Target Telemetry & Payload Data"
                    ]
                }
            ]
        }
    ]

    # Render 5 Stage Columns
    for idx, stg in enumerate(stages):
        x = start_x + idx * (col_w + gap)
        pal = palettes[idx]
        
        # Outer Column Card
        svg.append(f'<g id="stage-{idx+1}">')
        svg.append(f'  <rect x="{x}" y="{start_y}" width="{col_w}" height="{col_h}" rx="14" fill="{bg_card}" stroke="{border_card}" stroke-width="1.5" filter="url(#shadow)" />')
        
        # Column Header Banner
        header_fill = pal["light_bg"] if not is_dark else pal["dark_bg"]
        svg.append(f'  <path d="M {x} {start_y+14} A 14 14 0 0 1 {x+14} {start_y} L {x+col_w-14} {start_y} A 14 14 0 0 1 {x+col_w} {start_y+14} L {x+col_w} {start_y+75} L {x} {start_y+75} Z" fill="{header_fill}" />')
        svg.append(f'  <line x1="{x}" y1="{start_y+75}" x2="{x+col_w}" y2="{start_y+75}" stroke="{pal["primary"]}" stroke-width="2" />')

        # Header Text
        svg.append(f'  <rect x="{x+14}" y="{start_y+10}" width="65" height="18" rx="4" fill="{pal["primary"]}" />')
        svg.append(f'  <text x="{x+22}" y="{start_y+23}" font-size="10" font-weight="800" fill="#ffffff" letter-spacing="1">{stg["num"]}</text>')
        svg.append(f'  <text x="{x+88}" y="{start_y+23}" font-size="10" font-weight="700" fill="{pal["primary"]}" letter-spacing="0.8">{stg["tag"]}</text>')
        svg.append(f'  <text x="{x+14}" y="{start_y+55}" font-size="16" font-weight="800" fill="{text_title}">{stg["name"]}</text>')

        # Render 4 Sub-blocks inside column
        block_y = start_y + 88
        for b_idx, blk in enumerate(stg["blocks"]):
            # Calculate height according to content
            b_h = 138 if b_idx < 3 else 95
            is_output = (b_idx == 3)
            
            box_bg = card_sub_bg
            box_stroke = border_sub
            if is_output:
                box_bg = pal["light_bg"] if not is_dark else pal["dark_bg"]
                box_stroke = pal["primary"]

            svg.append(f'  <rect x="{x+12}" y="{block_y}" width="{col_w-24}" height="{b_h}" rx="8" fill="{box_bg}" stroke="{box_stroke}" stroke-width="{1.5 if is_output else 1}" />')
            
            # Sub-block title & badge
            svg.append(f'  <text x="{x+22}" y="{block_y+20}" font-size="12" font-weight="700" fill="{pal["primary"] if is_output else text_title}">{blk["title"]}</text>')
            badge_w = len(blk["badge"]) * 6 + 14
            svg.append(f'  <rect x="{x+col_w-22-badge_w}" y="{block_y+9}" width="{badge_w}" height="16" rx="4" fill="{pal["light_bg"] if not is_dark else pal["dark_bg"]}" stroke="{pal["primary"]}" stroke-width="0.7"/>')
            svg.append(f'  <text x="{x+col_w-15-badge_w}" y="{block_y+21}" font-size="8.5" font-weight="700" fill="{pal["primary"]}">{blk["badge"]}</text>')
            
            # Sub-block bullet text
            line_y = block_y + 38
            for l in blk["lines"]:
                is_bold = l.startswith("➤")
                font_weight = "700" if is_bold else "500"
                fill_color = pal["primary"] if is_bold else text_body
                svg.append(f'  <text x="{x+22}" y="{line_y}" font-size="10" font-weight="{font_weight}" fill="{fill_color}" font-family="SFMono-Regular, Consolas, \'Courier New\', monospace">{l}</text>')
                line_y += 18
                
            block_y += b_h + 10

        svg.append('</g>')

        # Inter-column forward flow arrow (except after last column)
        if idx < 4:
            arrow_x1 = x + col_w + 5
            arrow_x2 = arrow_x1 + gap - 10
            arrow_y = start_y + 360
            svg.append(f'<g transform="translate(0, 0)">')
            svg.append(f'  <line x1="{arrow_x1}" y1="{arrow_y}" x2="{arrow_x2}" y2="{arrow_y}" stroke="{arrow_color}" stroke-width="2.5" marker-end="url(#arrowhead)"/>')
            svg.append(f'  <circle cx="{(arrow_x1+arrow_x2)/2}" cy="{arrow_y}" r="3" fill="{arrow_color}" />')
            svg.append(f'</g>')

    # 3. Bottom Closed-Loop Feedback Loop
    fb_y = start_y + col_h + 20
    fb_h = 75
    fb_w = 1820
    svg.append(f'<g id="feedback-loop">')
    # Large rounded banner
    svg.append(f'  <rect x="{start_x}" y="{fb_y}" width="{fb_w}" height="{fb_h}" rx="12" fill="{feedback_bg}" stroke="{feedback_border}" stroke-width="2" stroke-dasharray="8,4" />')
    
    # Feedback flow line with arrow returning from Right (Stage 5) to Left (Stage 1)
    svg.append(f'  <path d="M 1700 {fb_y-8} L 1700 {fb_y+38} L 120 {fb_y+38} L 120 {fb_y-8}" fill="none" stroke="{feedback_border}" stroke-width="2.5" marker-end="url(#arrowhead-feedback)"/>')

    # Feedback Loop Pill Tag
    svg.append(f'  <rect x="{start_x+25}" y="{fb_y+14}" width="260" height="24" rx="6" fill="#0284c7" />')
    svg.append(f'  <text x="{start_x+35}" y="{fb_y+30}" font-size="11" font-weight="800" fill="#ffffff" letter-spacing="1">CLOSED-LOOP AUTONOMY ENGINE</text>')

    # Text description
    svg.append(f'  <text x="{start_x+305}" y="{fb_y+31}" font-size="13" font-weight="700" fill="{text_title}">High-Frequency Real-Time Telemetry &amp; State Feedback (Δt = 0.1 s, 10 Hz):</text>')
    svg.append(f'  <text x="{start_x+305}" y="{fb_y+53}" font-size="11" font-weight="500" fill="{text_subtitle}" font-family="SFMono-Regular, Consolas, \'Courier New\', monospace">True state vector [r(t), v(t), Θ(t), ω(t), SoC(t)] + microsecond Multi-Agent flight event stream continuously recirculate into Stage 1 (Dynamics) &amp; Stage 2 (ISL Topology) for receding horizon closed-loop execution.</text>')
    svg.append(f'</g>')

    svg.append('</svg>')
    return '\n'.join(svg)

def main():
    from pathlib import Path
    out_dir_local = str(Path(__file__).resolve().parent.parent)
    out_dir_public = os.path.join(out_dir_local, "frontend/public")

    light_svg = create_svg(is_dark=False)
    dark_svg = create_svg(is_dark=True)

    paths = [
        (os.path.join(out_dir_local, "methodology_diagram_light.svg"), light_svg),
        (os.path.join(out_dir_local, "methodology_diagram_dark.svg"), dark_svg),
        (os.path.join(out_dir_local, "methodology_diagram.svg"), light_svg),
        (os.path.join(out_dir_public, "methodology_diagram_light.svg"), light_svg),
        (os.path.join(out_dir_public, "methodology_diagram_dark.svg"), dark_svg),
        (os.path.join(out_dir_public, "methodology_diagram.svg"), light_svg),
    ]

    for p, content in paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Generated: {p}")

if __name__ == "__main__":
    main()
