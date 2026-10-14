import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def generate_simulated_earth_observation_image(output_path: Path, lat: float = 16.50, lon: float = 80.60, sat_id: str = "SAT-03"):
    """
    Generates a realistic simulated high-resolution satellite imagery snapshot
    with telemetry HUD overlays, crosshairs, grid lines, and mission stamps.
    """
    width, height = 800, 600
    img = Image.new("RGB", (width, height), color=(18, 28, 42))
    draw = ImageDraw.Draw(img)

    # Simulated terrain background (landmass, rivers, coastal gradients)
    for y in range(height):
        for x in range(0, width, 8):
            # Noise-like terrain synthesis using trigonometric harmonics
            val = (
                math.sin(x * 0.015 + lat) * 0.4 +
                math.cos(y * 0.012 + lon) * 0.3 +
                math.sin((x + y) * 0.008) * 0.3
            )
            if val > 0.15:
                # Land / Agriculture / Urban terrain
                r = int(45 + 30 * val)
                g = int(85 + 40 * val)
                b = int(50 + 25 * val)
            elif val > -0.05:
                # Coastline / Shore
                r = int(120 + 30 * val)
                g = int(140 + 30 * val)
                b = int(110 + 20 * val)
            else:
                # Ocean / Water body
                r = int(15 + 15 * abs(val))
                g = int(40 + 25 * abs(val))
                b = int(95 + 40 * abs(val))
            draw.rectangle([x, y, x + 8, y + 1], fill=(r, g, b))

    # Grid overlay
    grid_color = (0, 220, 255, 60)
    for x in range(0, width, 100):
        draw.line([(x, 0), (x, height)], fill=(0, 180, 220), width=1)
    for y in range(0, height, 100):
        draw.line([(0, y), (width, y)], fill=(0, 180, 220), width=1)

    # Sensor Crosshair in Center
    cx, cy = width // 2, height // 2
    cross_color = (255, 215, 0)
    draw.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], outline=cross_color, width=2)
    draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=cross_color)
    draw.line([(cx - 70, cy), (cx - 15, cy)], fill=cross_color, width=2)
    draw.line([(cx + 15, cy), (cx + 70, cy)], fill=cross_color, width=2)
    draw.line([(cx, cy - 70), (cx, cy - 15)], fill=cross_color, width=2)
    draw.line([(cx, cy + 15), (cx, cy + 70)], fill=cross_color, width=2)

    # Corner brackets (HUD style)
    b_len = 30
    draw.line([(20, 20), (20 + b_len, 20)], fill=(0, 255, 200), width=3)
    draw.line([(20, 20), (20, 20 + b_len)], fill=(0, 255, 200), width=3)
    draw.line([(width - 20, 20), (width - 20 - b_len, 20)], fill=(0, 255, 200), width=3)
    draw.line([(width - 20, 20), (width - 20, 20 + b_len)], fill=(0, 255, 200), width=3)
    draw.line([(20, height - 20), (20 + b_len, height - 20)], fill=(0, 255, 200), width=3)
    draw.line([(20, height - 20), (20, height - 20 - b_len)], fill=(0, 255, 200), width=3)
    draw.line([(width - 20, height - 20), (width - 20 - b_len, height - 20)], fill=(0, 255, 200), width=3)
    draw.line([(width - 20, height - 20), (width - 20, height - 20 - b_len)], fill=(0, 255, 200), width=3)

    # HUD Overlay Text Boxes
    draw.rectangle([25, 25, 360, 130], fill=(10, 15, 25))
    draw.rectangle([25, 25, 360, 130], outline=(0, 255, 200), width=1)
    
    draw.text((35, 32), "[SIMULATED EARTH OBSERVATION]", fill=(0, 255, 200))
    draw.text((35, 52), f"SENSOR PLATFORM : {sat_id}", fill=(255, 255, 255))
    draw.text((35, 70), f"TARGET COORDS   : {lat:.2f} N, {lon:.2f} E", fill=(255, 255, 255))
    draw.text((35, 88), "RESOLUTION      : 0.50 m GSD (RGB/NIR)", fill=(200, 220, 240))
    draw.text((35, 106), "STATUS          : ACQUIRED / SUCCESS", fill=(50, 255, 120))

    draw.rectangle([width - 270, height - 75, width - 25, height - 25], fill=(10, 15, 25))
    draw.rectangle([width - 270, height - 75, width - 25, height - 25], outline=(255, 200, 0), width=1)
    draw.text((width - 260, height - 68), "CLOUD COVER  : 3.8 %", fill=(255, 255, 255))
    draw.text((width - 260, height - 48), "PAYLOAD GIMBAL: LOCKED NADIR", fill=(255, 200, 0))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG")
    return output_path
