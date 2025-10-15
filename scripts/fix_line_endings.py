#!/usr/bin/env python3
"""
Fix line endings in frontend files.

Converts CRLF to LF in all TypeScript/JavaScript files.
"""

import os
from pathlib import Path


def fix_line_endings(file_path: Path) -> bool:
    """Fix line endings in a single file. Returns True if file was modified."""
    try:
        with open(file_path, 'rb') as f:
            content = f.read()

        # Check if file has CRLF
        if b'\r\n' not in content:
            return False

        # Replace CRLF with LF
        fixed_content = content.replace(b'\r\n', b'\n')

        # Write back
        with open(file_path, 'wb') as f:
            f.write(fixed_content)

        return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False


def main():
    """Main function."""
    frontend_dir = Path(__file__).parent.parent / "frontend-prediction" / "src"

    if not frontend_dir.exists():
        print(f"Directory not found: {frontend_dir}")
        return

    print(f"Fixing line endings in: {frontend_dir}")

    # File extensions to process
    extensions = ['.ts', '.tsx', '.js', '.jsx']

    modified_count = 0
    total_count = 0

    for ext in extensions:
        for file_path in frontend_dir.rglob(f'*{ext}'):
            total_count += 1
            if fix_line_endings(file_path):
                modified_count += 1
                print(f"  Fixed: {file_path.relative_to(frontend_dir)}")

    print(f"\nProcessed {total_count} files, fixed {modified_count} files")


if __name__ == "__main__":
    main()
