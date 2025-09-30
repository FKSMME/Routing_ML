#!/usr/bin/env python3
"""Helper entry point that forwards arguments to the training CLI."""
from __future__ import annotations

import sys

from backend.cli.train_model import main


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
