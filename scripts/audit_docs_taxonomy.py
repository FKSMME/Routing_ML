#!/usr/bin/env python3
"""Audit documentation files and create taxonomy for reorganization."""

import os
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Tuple

def extract_date_from_filename(filename: str) -> str:
    """Extract date from filename if present."""
    # Match patterns like 2025-10-20, 20251020, etc.
    patterns = [
        r'(\d{4}-\d{2}-\d{2})',  # 2025-10-20
        r'(\d{8})',               # 20251020
    ]

    for pattern in patterns:
        match = re.search(pattern, filename)
        if match:
            date_str = match.group(1)
            # Normalize to YYYY-MM-DD
            if '-' not in date_str:
                # 20251020 -> 2025-10-20
                return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            return date_str

    return None

def categorize_doc(file_path: Path, base_path: Path) -> Tuple[str, str]:
    """Categorize a document based on its path and name."""
    rel_path = file_path.relative_to(base_path)
    parts = rel_path.parts
    filename = file_path.name.lower()

    # Category determination logic
    if 'planning' in parts:
        return 'planning', 'Active planning and project management documents'
    elif 'prd' in parts or 'PRD' in filename:
        return 'planning', 'Product requirements documents'
    elif 'checklist' in parts or 'CHECKLIST' in filename:
        return 'planning', 'Checklists and task tracking'
    elif 'work-history' in parts:
        return 'historical', 'Work history and session logs'
    elif 'sessions' in parts or 'logs' in parts:
        return 'historical', 'Session logs and historical records'
    elif 'guides' in parts:
        return 'active', 'User and developer guides'
    elif 'architecture' in parts or 'design' in parts:
        return 'active', 'Architecture and design documentation'
    elif 'api' in parts:
        return 'active', 'API documentation'
    elif 'admin' in parts:
        return 'active', 'Administration guides'
    elif 'deployment' in parts or 'deploy' in parts:
        return 'active', 'Deployment documentation'
    elif 'qa' in parts or 'test' in filename:
        return 'testing', 'QA and testing documentation'
    elif 'reports' in parts or 'progress' in parts:
        return 'reports', 'Progress reports and deliverables'
    elif 'migration' in parts:
        return 'archive', 'Migration documentation (potentially outdated)'
    elif 'templates' in parts:
        return 'active', 'Document templates'
    elif 'requirements' in parts:
        return 'active', 'Requirements documentation'
    elif 'features' in parts:
        return 'active', 'Feature documentation'
    elif 'implementation' in parts:
        return 'historical', 'Implementation notes and records'
    elif 'analysis' in parts:
        return 'historical', 'Analysis and investigation records'
    elif filename in ['readme.md', 'changelog.md', 'build_complete.md']:
        return 'active', 'Root-level documentation'
    else:
        return 'uncategorized', 'Needs manual review'

def analyze_docs(base_path: Path) -> Dict:
    """Analyze all documentation files."""
    results = {
        'total_files': 0,
        'by_category': defaultdict(list),
        'by_date': defaultdict(list),
        'by_extension': defaultdict(int),
        'large_files': [],
    }

    for file_path in base_path.rglob('*'):
        if not file_path.is_file():
            continue

        results['total_files'] += 1

        # Extension
        ext = file_path.suffix.lower()
        results['by_extension'][ext] += 1

        # Size
        size = file_path.stat().st_size
        if size > 50_000:  # >50KB
            results['large_files'].append((str(file_path.relative_to(base_path)), size))

        # Category
        category, reason = categorize_doc(file_path, base_path)
        results['by_category'][category].append({
            'path': str(file_path.relative_to(base_path)),
            'size': size,
            'reason': reason,
        })

        # Date
        date_str = extract_date_from_filename(file_path.name)
        if date_str:
            results['by_date'][date_str].append(str(file_path.relative_to(base_path)))

    return results

def main():
    base_path = Path(r"c:\Users\syyun\Documents\GitHub\Routing_ML_251014\docs")

    print("=" * 80)
    print("DOCUMENTATION TAXONOMY AUDIT")
    print("=" * 80)

    results = analyze_docs(base_path)

    print(f"\nTotal Files: {results['total_files']}")

    print("\n" + "=" * 80)
    print("BY FILE EXTENSION")
    print("=" * 80)
    for ext, count in sorted(results['by_extension'].items(), key=lambda x: -x[1]):
        ext_name = ext if ext else '<no extension>'
        print(f"  {ext_name:20s}: {count:4d} files")

    print("\n" + "=" * 80)
    print("BY CATEGORY (Proposed Taxonomy)")
    print("=" * 80)

    category_order = ['active', 'planning', 'testing', 'reports', 'historical', 'archive', 'uncategorized']

    for category in category_order:
        if category not in results['by_category']:
            continue

        files = results['by_category'][category]
        print(f"\n{category.upper()}: {len(files)} files")
        print("-" * 60)

        # Show reason distribution
        reason_counts = defaultdict(int)
        for f in files:
            reason_counts[f['reason']] += 1

        for reason, count in sorted(reason_counts.items()):
            print(f"  - {reason}: {count} files")

        # Show first 10 examples
        print("\n  Examples:")
        for f in files[:10]:
            print(f"    {f['path']}")

    print("\n" + "=" * 80)
    print("LARGE FILES (>50KB)")
    print("=" * 80)

    large_sorted = sorted(results['large_files'], key=lambda x: -x[1])
    for path, size in large_sorted[:20]:
        print(f"  {size:>8,} bytes: {path}")

    print("\n" + "=" * 80)
    print("FILES BY DATE (Last 30 days)")
    print("=" * 80)

    recent_dates = sorted([d for d in results['by_date'].keys() if d >= '2025-09-22'], reverse=True)

    for date in recent_dates[:15]:
        files = results['by_date'][date]
        print(f"\n{date}: {len(files)} files")
        for path in files[:5]:
            print(f"  - {path}")
        if len(files) > 5:
            print(f"  ... and {len(files) - 5} more")

    print("\n" + "=" * 80)
    print("REORGANIZATION RECOMMENDATIONS")
    print("=" * 80)

    print(f"""
Proposed structure:

  docs/
    active/           ({len(results['by_category']['active'])} files)
      - guides/
      - architecture/
      - api/
      - features/
      - admin/
      - requirements/
      - templates/

    planning/         ({len(results['by_category']['planning'])} files)
      - prds/
      - checklists/
      - sprints/

    archive/          ({len(results['by_category']['historical']) + len(results['by_category']['archive'])} files)
      - sessions/
      - work-history/
      - analysis/
      - implementation/
      - migration/

    testing/          ({len(results['by_category']['testing'])} files)
      - qa/

    reports/          ({len(results['by_category']['reports'])} files)
      - progress/
      - deliverables/

    INDEX.md          (Navigation guide)

Total active docs target: <300
Current active estimate: {len(results['by_category']['active']) + len(results['by_category']['planning'])}
""")

if __name__ == "__main__":
    main()
