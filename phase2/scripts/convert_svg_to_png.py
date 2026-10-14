"""
convert_svg_to_png.py
Embeds SVG inline into standalone HTML and captures 1920x1080 pixel-perfect PNGs
using Edge headless.
"""

import os
import subprocess
from pathlib import Path

def convert(svg_file, html_file, png_file, bg_color):
    with open(svg_file, "r", encoding="utf-8") as f:
        svg_content = f.read()

    html = (
        "<!DOCTYPE html>\n"
        "<html>\n"
        "<head>\n"
        '<meta charset="utf-8">\n'
        "<style>\n"
        "* { margin: 0; padding: 0; box-sizing: border-box; }\n"
        f"html, body {{ width: 1920px; height: 1080px; overflow: hidden; background: {bg_color}; }}\n"
        "svg { width: 1920px; height: 1080px; display: block; }\n"
        "</style>\n"
        "</head>\n"
        "<body>\n"
        f"{svg_content}\n"
        "</body>\n"
        "</html>\n"
    )

    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html)

    edge_exe = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    abs_html = os.path.abspath(html_file).replace("\\", "/")
    abs_png = os.path.abspath(png_file)

    cmd = [
        edge_exe,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1920,1080",
        f"--screenshot={abs_png}",
        f"file:///{abs_html}",
    ]

    print(f"Rendering {png_file} ...")
    subprocess.run(cmd, check=True)
    if os.path.exists(png_file):
        size = os.path.getsize(png_file)
        print(f"Created: {png_file} ({size:,} bytes)")
    else:
        print(f"Failed to create {png_file}")

def main():
    root = str(Path(__file__).resolve().parent.parent)
    public = os.path.join(root, "frontend/public")

    # 1. Convert Light Slide
    light_svg = os.path.join(root, "methodology_diagram_light.svg")
    light_html = os.path.join(root, "inline_light.html")
    light_png = os.path.join(root, "methodology_diagram_light.png")
    convert(light_svg, light_html, light_png, "#ffffff")

    # 2. Convert Dark Slide
    dark_svg = os.path.join(root, "methodology_diagram_dark.svg")
    dark_html = os.path.join(root, "inline_dark.html")
    dark_png = os.path.join(root, "methodology_diagram_dark.png")
    convert(dark_svg, dark_html, dark_png, "#060814")

    # 3. Default PNG
    default_png = os.path.join(root, "methodology_diagram.png")
    import shutil
    shutil.copy2(light_png, default_png)

    # 4. Copy to brain and public
    for dest in [brain, public]:
        os.makedirs(dest, exist_ok=True)
        shutil.copy2(light_png, os.path.join(dest, "methodology_diagram_light.png"))
        shutil.copy2(dark_png, os.path.join(dest, "methodology_diagram_dark.png"))
        shutil.copy2(default_png, os.path.join(dest, "methodology_diagram.png"))
        print(f"Copied PNGs to {dest}")

if __name__ == "__main__":
    main()
