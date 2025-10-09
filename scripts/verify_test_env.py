#!/usr/bin/env python3
"""Quick test environment verification."""
import sys
import os

print("=" * 60)
print("Test Environment Verification")
print("=" * 60)

# Check imports
try:
    import numpy as np
    print(f"✅ numpy {np.__version__}")
except ImportError as e:
    print(f"❌ numpy: {e}")
    sys.exit(1)

try:
    import pandas as pd
    print(f"✅ pandas {pd.__version__}")
except ImportError as e:
    print(f"❌ pandas: {e}")
    sys.exit(1)

try:
    import polars as pl
    print(f"✅ polars {pl.__version__}")
except ImportError:
    print("⚠️  polars not installed (optional)")

try:
    import pyodbc
    print(f"✅ pyodbc {pyodbc.version}")
except ImportError:
    print("⚠️  pyodbc not installed")

try:
    import pydantic_settings
    print(f"✅ pydantic_settings {pydantic_settings.__version__}")
except ImportError as e:
    print(f"❌ pydantic_settings: {e}")
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ All critical dependencies available")
print("=" * 60)
