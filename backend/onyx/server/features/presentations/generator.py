"""
Colnitia GPT Slides - Reveal.js Presentation Generator for Onyx
Ported from Colnitio GPT (Open-WebUI fork).
"""

import json
import logging
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

log = logging.getLogger(__name__)

# =============================================================================
# BRAND CONFIGURATION - Colnitia GPT
# =============================================================================

BRAND_COLORS = {
    "primary": "#3b82f6",      # Blue 500
    "primary_dark": "#1e40af", # Blue 800
    "primary_light": "#60a5fa", # Blue 400
    "surface": "#0f172a",      # Slate 900
    "surface_light": "#1e293b", # Slate 800
    "text_primary": "#f8fafc", # Slate 50
    "text_secondary": "#94a3b8", # Slate 400
    "accent": "#22c55e",       # Green 500
    "white": "#ffffff",
}

THEME_CONFIGS = {
    "dark": {
        "name": "Dark (Default)",
        "background": "#0f172a",
        "surface": "#1e293b",
        "text_primary": "#f8fafc",
        "text_secondary": "#94a3b8",
        "heading": "#ffffff",
        "accent": "#3b82f6",
        "accent_light": "#60a5fa",
        "accent_dark": "#1e40af",
        "success": "#22c55e",
        "gradient_start": "#60a5fa",
        "gradient_end": "#3b82f6",
        "card_bg": "rgba(30, 41, 59, 0.8)",
        "card_border": "rgba(59, 130, 246, 0.3)",
    },
    "light": {
        "name": "Light",
        "background": "#ffffff",
        "surface": "#f1f5f9",
        "text_primary": "#0f172a",
        "text_secondary": "#475569",
        "heading": "#1e293b",
        "accent": "#3b82f6",
        "accent_light": "#60a5fa",
        "accent_dark": "#1e40af",
        "success": "#16a34a",
        "gradient_start": "#3b82f6",
        "gradient_end": "#1e40af",
        "card_bg": "rgba(241, 245, 249, 0.9)",
        "card_border": "rgba(59, 130, 246, 0.4)",
    },
    "corporate": {
        "name": "Corporate Blue",
        "background": "#1e40af",
        "surface": "#1e3a8a",
        "text_primary": "#ffffff",
        "text_secondary": "#bfdbfe",
        "heading": "#ffffff",
        "accent": "#fbbf24",
        "accent_light": "#fcd34d",
        "accent_dark": "#d97706",
        "success": "#4ade80",
        "gradient_start": "#fbbf24",
        "gradient_end": "#f59e0b",
        "card_bg": "rgba(30, 58, 138, 0.8)",
        "card_border": "rgba(251, 191, 36, 0.4)",
    }
}

REVEALJS_TEMPLATE = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>

    <!-- Reveal.js CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/reveal.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/theme/black.css">

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <style>
        :root {{
            --theme-background: {theme_background};
            --theme-surface: {theme_surface};
            --theme-text-primary: {theme_text_primary};
            --theme-text-secondary: {theme_text_secondary};
            --theme-heading: {theme_heading};
            --theme-accent: {theme_accent};
            --theme-accent-light: {theme_accent_light};
            --theme-accent-dark: {theme_accent_dark};
            --theme-success: {theme_success};
            --theme-gradient-start: {theme_gradient_start};
            --theme-gradient-end: {theme_gradient_end};
            --theme-card-bg: {theme_card_bg};
            --theme-card-border: {theme_card_border};

            --r-background-color: var(--theme-background);
            --r-main-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            --r-heading-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            --r-main-color: var(--theme-text-primary);
            --r-heading-color: var(--theme-heading);
            --r-link-color: var(--theme-accent);
            --r-link-color-hover: var(--theme-accent-light);
            --r-selection-background-color: var(--theme-accent);
        }}

        body, .reveal {{
            background-color: var(--theme-background);
        }}

        .reveal {{
            font-family: var(--r-main-font);
        }}

        .reveal .slides section {{
            background-color: var(--theme-background);
        }}

        .reveal h1, .reveal h2, .reveal h3 {{
            font-weight: 600;
            text-transform: none;
            letter-spacing: -0.02em;
        }}

        .reveal h1 {{
            font-size: 2.8em;
            background: linear-gradient(135deg, var(--theme-gradient-start), var(--theme-gradient-end));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}

        .reveal h2 {{
            font-size: 1.8em;
            color: var(--theme-heading);
            margin-bottom: 0.8em;
        }}

        .reveal h3 {{
            font-size: 1.3em;
            color: var(--theme-accent-light);
        }}

        .reveal p, .reveal li {{
            font-size: 1.1em;
            line-height: 1.6;
            color: var(--theme-text-secondary);
        }}

        .reveal ul {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}

        .reveal li {{
            position: relative;
            padding-left: 1.5em;
            margin-bottom: 0.6em;
        }}

        .reveal li::before {{
            content: '';
            position: absolute;
            left: 0;
            top: 0.5em;
            width: 8px;
            height: 8px;
            background: var(--theme-accent);
            border-radius: 50%;
        }}

        .slide-title {{
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            text-align: center;
        }}

        .slide-title h1 {{
            font-size: 3.2em;
            margin-bottom: 0.3em;
        }}

        .slide-title .subtitle {{
            font-size: 1.4em;
            color: var(--theme-text-secondary);
            font-weight: 300;
        }}

        .slide-title .brand {{
            position: absolute;
            bottom: 40px;
            font-size: 0.9em;
            color: var(--theme-text-secondary);
            opacity: 0.7;
        }}

        .slide-content {{
            text-align: left;
            padding: 0 2em;
        }}

        .slide-content h2 {{
            border-bottom: 3px solid var(--theme-accent);
            padding-bottom: 0.3em;
            display: inline-block;
        }}

        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 2em;
            margin-top: 1.5em;
        }}

        .stat-card {{
            background: var(--theme-card-bg);
            border: 1px solid var(--theme-card-border);
            border-radius: 16px;
            padding: 2em;
            text-align: center;
        }}

        .stat-value {{
            font-size: 3em;
            font-weight: 700;
            background: linear-gradient(135deg, var(--theme-gradient-start), var(--theme-success));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}

        .stat-label {{
            font-size: 1em;
            color: var(--theme-text-secondary);
            margin-top: 0.5em;
        }}

        .slide-quote {{
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 0 3em;
        }}

        .slide-quote blockquote {{
            font-size: 1.6em;
            font-style: italic;
            color: var(--theme-text-primary);
            border-left: 4px solid var(--theme-accent);
            padding-left: 1em;
            margin: 0;
        }}

        .slide-quote .author {{
            margin-top: 1.5em;
            font-size: 1.1em;
            color: var(--theme-accent-light);
        }}

        .slide-section {{
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
        }}

        .slide-section h2 {{
            font-size: 2.5em;
            margin-bottom: 0.3em;
            color: var(--theme-heading);
        }}

        .slide-closing {{
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }}

        .slide-closing h2 {{
            font-size: 2.8em;
            background: linear-gradient(135deg, var(--theme-gradient-start), var(--theme-success));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}

        .two-columns {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3em;
            text-align: left;
        }}

        .column h3 {{
            margin-bottom: 0.8em;
        }}

        .slide-footer {{
            position: absolute;
            bottom: 20px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            padding: 0 40px;
            font-size: 0.7em;
            color: var(--theme-text-secondary);
            opacity: 0.6;
        }}

        .reveal .progress {{
            background: rgba(255,255,255,0.1);
            height: 4px;
        }}

        .reveal .progress span {{
            background: linear-gradient(90deg, var(--theme-accent), var(--theme-success));
        }}

        .reveal .controls {{
            color: var(--theme-accent);
        }}

        .reveal .slides section .fragment {{
            transition: all 0.3s ease;
        }}

        .reveal .slides section .fragment.visible {{
            opacity: 1;
            transform: none;
        }}

        .reveal .slides section .fragment.fade-up {{
            transform: translateY(20px);
        }}
    </style>
</head>
<body>
    <div class="reveal">
        <div class="slides">
{slides_html}
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.0.4/dist/reveal.js"></script>
    <script>
        Reveal.initialize({{
            hash: true,
            controls: true,
            progress: true,
            center: true,
            transition: 'slide',
            transitionSpeed: 'default',
            backgroundTransition: 'fade',
            viewDistance: 3,
            width: 1280,
            height: 720,
            margin: 0.1,
        }});
    </script>
</body>
</html>
"""

def _escape_html(text: str) -> str:
    if not text: return ""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")

def _get_presentations_dir() -> Path:
    base_dir = Path(os.environ.get("DATA_DIR", "/app/backend/data"))
    presentations_dir = base_dir / "presentations"
    presentations_dir.mkdir(parents=True, exist_ok=True)
    return presentations_dir

def _generate_title_slide(title: str, subtitle: str = "") -> str:
    sub = f'<p class="subtitle">{_escape_html(subtitle)}</p>' if subtitle else ''
    return f"""
            <section>
                <div class="slide-title">
                    <h1>{_escape_html(title)}</h1>
                    {sub}
                    <p class="brand">Generado con Colnitia GPT AI</p>
                </div>
            </section>"""

def _generate_content_slide(title: str, bullets: List[str], idx: int, total: int) -> str:
    b_html = "\n".join([f'                        <li class="fragment fade-up">{_escape_html(b)}</li>' for b in bullets])
    return f"""
            <section>
                <div class="slide-content">
                    <h2>{_escape_html(title)}</h2>
                    <ul>{b_html}</ul>
                </div>
                <div class="slide-footer">
                    <span>Colnitia GPT</span>
                    <span>{idx}/{total}</span>
                </div>
            </section>"""

def _generate_stats_slide(title: str, stats: List[Dict], idx: int, total: int) -> str:
    s_html = "\n".join([
        f'<div class="stat-card fragment fade-up"><div class="stat-value">{_escape_html(str(s.get("value", "")))}</div><div class="stat-label">{_escape_html(s.get("label", ""))}</div></div>'
        for s in stats[:4]
    ])
    return f"""
            <section>
                <div class="slide-content">
                    <h2>{_escape_html(title)}</h2>
                    <div class="stats-grid">{s_html}</div>
                </div>
                <div class="slide-footer">
                    <span>Colnitia GPT</span>
                    <span>{idx}/{total}</span>
                </div>
            </section>"""

def _generate_quote_slide(quote: str, author: str = "", role: str = "") -> str:
    auth_html = f'<p class="author">— {_escape_html(author)}{", " + _escape_html(role) if role else ""}</p>' if author else ""
    return f"""
            <section>
                <div class="slide-quote">
                    <blockquote>"{_escape_html(quote)}"</blockquote>
                    {auth_html}
                </div>
            </section>"""

def _generate_section_slide(title: str, subtitle: str = "", theme: dict = None) -> str:
    active_theme = theme or THEME_CONFIGS["dark"]
    sub = f'<p class="subtitle" style="color: {active_theme["text_secondary"]};">{_escape_html(subtitle)}</p>' if subtitle else ''
    return f"""
            <section data-background="linear-gradient(135deg, {active_theme['accent_dark']}, {active_theme['background']})">
                <div class="slide-section">
                    <h2>{_escape_html(title)}</h2>
                    {sub}
                </div>
            </section>"""

def _generate_two_column_slide(title: str, left_items: List[str], right_items: List[str], left_title: str = "", right_title: str = "", idx: int = 0, total: int = 0) -> str:
    l_b = "\n".join([f'<li class="fragment">{_escape_html(i)}</li>' for i in left_items])
    r_b = "\n".join([f'<li class="fragment">{_escape_html(i)}</li>' for i in right_items])
    return f"""
            <section>
                <div class="slide-content">
                    <h2>{_escape_html(title)}</h2>
                    <div class="two-columns">
                        <div class="column">{"<h3>"+_escape_html(left_title)+"</h3>" if left_title else ""}<ul>{l_b}</ul></div>
                        <div class="column">{"<h3>"+_escape_html(right_title)+"</h3>" if right_title else ""}<ul>{r_b}</ul></div>
                    </div>
                </div>
                <div class="slide-footer">
                    <span>Colnitia GPT</span>
                    <span>{idx}/{total}</span>
                </div>
            </section>"""

def _generate_closing_slide(title: str, subtitle: str = "", contact: str = "", theme: dict = None) -> str:
    active_theme = theme or THEME_CONFIGS["dark"]
    sub = f'<p class="subtitle" style="color: {active_theme["text_secondary"]};">{_escape_html(subtitle)}</p>' if subtitle else ''
    cont = f'<p style="margin-top: 2em; color: {active_theme["text_secondary"]};">{_escape_html(contact)}</p>' if contact else ''
    return f"""
            <section>
                <div class="slide-closing">
                    <h2>{_escape_html(title)}</h2>
                    {sub}{cont}
                    <p class="brand" style="margin-top: 3em; opacity: 0.6; color: {active_theme["text_secondary"]};">Powered by Colnitia GPT AI</p>
                </div>
            </section>"""

def generate_presentation_html(title: str, slides: List[Dict], theme: str = "dark") -> str:
    theme_config = THEME_CONFIGS.get(theme, THEME_CONFIGS["dark"])
    html_parts = []
    total = len(slides)
    for idx, s in enumerate(slides, 1):
        stype = s.get("type", "content")
        if stype == "title": html_parts.append(_generate_title_slide(s.get("title", title), s.get("subtitle", "")))
        elif stype == "content": html_parts.append(_generate_content_slide(s.get("title", ""), s.get("bullets", []), idx, total))
        elif stype == "stats": html_parts.append(_generate_stats_slide(s.get("title", ""), s.get("stats", []), idx, total))
        elif stype == "quote": html_parts.append(_generate_quote_slide(s.get("quote", ""), s.get("author", ""), s.get("role", "")))
        elif stype == "section": html_parts.append(_generate_section_slide(s.get("title", ""), s.get("subtitle", ""), theme_config))
        elif stype == "two_column": html_parts.append(_generate_two_column_slide(s.get("title", ""), s.get("left_items", []), s.get("right_items", []), s.get("left_title", ""), s.get("right_title", ""), idx, total))
        elif stype == "closing": html_parts.append(_generate_closing_slide(s.get("title", "Gracias"), s.get("subtitle", ""), s.get("contact", ""), theme_config))
    
    return REVEALJS_TEMPLATE.format(
        title=_escape_html(title),
        slides_html="\n".join(html_parts),
        theme_background=theme_config["background"],
        theme_surface=theme_config["surface"],
        theme_text_primary=theme_config["text_primary"],
        theme_text_secondary=theme_config["text_secondary"],
        theme_heading=theme_config["heading"],
        theme_accent=theme_config["accent"],
        theme_accent_light=theme_config["accent_light"],
        theme_accent_dark=theme_config["accent_dark"],
        theme_success=theme_config["success"],
        theme_gradient_start=theme_config["gradient_start"],
        theme_gradient_end=theme_config["gradient_end"],
        theme_card_bg=theme_config["card_bg"],
        theme_card_border=theme_config["card_border"],
    )

def save_presentation(title: str, html_content: str) -> str:
    safe_title = re.sub(r'[^\w\s-]', '', title).strip()
    safe_title = re.sub(r'\s+', '_', safe_title)[:50]
    filename = f"{safe_title}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
    filepath = _get_presentations_dir() / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html_content)
    return filename
