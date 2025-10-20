"""
Utility functions for Monitor Application
"""


def blend_color(hex_a: str, hex_b: str, t: float) -> str:
    """Linear interpolate between two hex colors"""
    ra = int(hex_a[1:3], 16)
    ga = int(hex_a[3:5], 16)
    ba = int(hex_a[5:7], 16)
    rb = int(hex_b[1:3], 16)
    gb = int(hex_b[3:5], 16)
    bb = int(hex_b[5:7], 16)

    r = int(ra * (1 - t) + rb * t)
    g = int(ga * (1 - t) + gb * t)
    b = int(ba * (1 - t) + bb * t)

    return f"#{r:02x}{g:02x}{b:02x}"
