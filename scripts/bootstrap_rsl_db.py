"""Helper script to initialise the RSL persistence schema."""

from __future__ import annotations

from backend.database_rsl import bootstrap_schema


def main() -> None:
    bootstrap_schema()


if __name__ == "__main__":
    main()

