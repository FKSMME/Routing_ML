"""
Modern theme and styling for the ML Model Analytics Dashboard
"""

import tkinter.font as tkFont


class ModernTheme:
    """Enhanced color theme with gradients and modern colors"""
    
    # Primary colors
    PRIMARY = "#6366f1"  # Indigo
    PRIMARY_DARK = "#4338ca"
    PRIMARY_LIGHT = "#818cf8"
    
    # Accent colors
    ACCENT = "#f59e0b"  # Amber
    ACCENT_DARK = "#d97706"
    ACCENT_LIGHT = "#fbbf24"
    
    # Background colors
    BG_PRIMARY = "#0f172a"  # Slate-900
    BG_SECONDARY = "#1e293b"  # Slate-800
    BG_TERTIARY = "#334155"  # Slate-700
    BG_CARD = "#1e293b"
    
    # Text colors
    TEXT_PRIMARY = "#f1f5f9"  # Slate-100
    TEXT_SECONDARY = "#cbd5e1"  # Slate-300
    TEXT_MUTED = "#94a3b8"  # Slate-400
    
    # Status colors
    SUCCESS = "#10b981"  # Emerald
    WARNING = "#f59e0b"  # Amber
    ERROR = "#ef4444"  # Red
    INFO = "#3b82f6"  # Blue
    
    # Neutral colors
    WHITE = "#ffffff"
    BLACK = "#000000"
    GRAY_LIGHT = "#f8fafc"
    GRAY = "#e2e8f0"
    GRAY_DARK = "#64748b"
    
    # Special effects
    SHADOW = "#00000033"
    GRADIENT_START = "#6366f1"
    GRADIENT_END = "#8b5cf6"


class FontManager:
    """Manages fonts for the application"""
    
    @staticmethod
    def setup_fonts():
        """Setup and return modern fonts dictionary"""
        return {
            "hero": tkFont.Font(family="Arial", size=24, weight="bold"),
            "title": tkFont.Font(family="Arial", size=18, weight="bold"),
            "heading": tkFont.Font(family="Arial", size=14, weight="bold"),
            "subheading": tkFont.Font(family="Arial", size=12, weight="normal"),
            "body": tkFont.Font(family="Arial", size=11),
            "code": tkFont.Font(family="Consolas", size=10),
            "small": tkFont.Font(family="Arial", size=9),
            "icon": tkFont.Font(family="Arial", size=16)
        }


def setup_matplotlib_style():
    """Configure matplotlib for dark theme"""
    import matplotlib.pyplot as plt
    
    plt.style.use('dark_background')
    plt.rcParams['font.family'] = 'Arial'
    plt.rcParams['axes.unicode_minus'] = False
    plt.rcParams['figure.facecolor'] = ModernTheme.BG_SECONDARY
    plt.rcParams['axes.facecolor'] = ModernTheme.BG_TERTIARY
    plt.rcParams['text.color'] = ModernTheme.TEXT_PRIMARY
    plt.rcParams['axes.labelcolor'] = ModernTheme.TEXT_PRIMARY
    plt.rcParams['xtick.color'] = ModernTheme.TEXT_SECONDARY
    plt.rcParams['ytick.color'] = ModernTheme.TEXT_SECONDARY
    plt.rcParams['grid.color'] = ModernTheme.GRAY_DARK
    plt.rcParams['grid.alpha'] = 0.2