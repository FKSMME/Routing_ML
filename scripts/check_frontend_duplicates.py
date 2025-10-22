#!/usr/bin/env python3
"""Check MD5 hashes for potential frontend duplicate files."""

import hashlib
from pathlib import Path
from typing import Dict, List

def md5_hash(file_path: Path) -> str:
    """Calculate MD5 hash of a file."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def check_duplicates(file_groups: Dict[str, List[str]]) -> Dict[str, Dict]:
    """Check if files in each group are duplicates."""
    results = {}

    for name, paths in file_groups.items():
        hashes = {}
        for path in paths:
            file_path = Path(path)
            if file_path.exists():
                hash_val = md5_hash(file_path)
                size = file_path.stat().st_size
                hashes[str(file_path)] = {"hash": hash_val, "size": size}
            else:
                hashes[str(file_path)] = {"hash": "FILE_NOT_FOUND", "size": 0}

        results[name] = hashes

    return results

def main():
    base = Path(r"c:\Users\syyun\Documents\GitHub\Routing_ML_251014")

    # Define file groups to check
    file_groups = {
        # CSS Files
        "Hyperspeed.css": [
            base / "frontend-prediction/src/components/Hyperspeed.css",
            base / "frontend-training/src/components/Hyperspeed.css",
            base / "frontend-shared/src/components/hyperspeed/Hyperspeed.css",
        ],
        "CardShell.module.css": [
            base / "frontend-prediction/src/components/common/CardShell.module.css",
            base / "frontend-training/src/components/common/CardShell.module.css",
        ],
        "DialogContainer.module.css": [
            base / "frontend-prediction/src/components/common/DialogContainer.module.css",
            base / "frontend-training/src/components/common/DialogContainer.module.css",
        ],

        # Component Files
        "Ballpit.tsx": [
            base / "common/visual-effects/Ballpit.tsx",
            base / "frontend-training/src/components/effects/Ballpit.tsx",
            base / "frontend-prediction/src/components/effects/Ballpit.tsx",
        ],
        "CardShell.tsx": [
            base / "frontend-training/src/components/common/CardShell.tsx",
            base / "frontend-prediction/src/components/common/CardShell.tsx",
        ],
        "DialogContainer.tsx": [
            base / "frontend-training/src/components/common/DialogContainer.tsx",
            base / "frontend-prediction/src/components/common/DialogContainer.tsx",
        ],
        "Hyperspeed.tsx": [
            base / "frontend-shared/src/components/hyperspeed/Hyperspeed.tsx",
            base / "frontend-prediction/src/components/Hyperspeed.tsx",
            base / "frontend-training/src/components/Hyperspeed.tsx",
        ],
        "HyperspeedBackground.tsx": [
            base / "frontend-shared/src/components/hyperspeed/HyperspeedBackground.tsx",
            base / "frontend-training/src/components/HyperspeedBackground.tsx",
            base / "frontend-prediction/src/components/HyperspeedBackground.tsx",
        ],

        # Store Files
        "authStore.ts": [
            base / "frontend-prediction/src/store/authStore.ts",
            base / "frontend-training/src/store/authStore.ts",
        ],
        "routingStore.ts": [
            base / "frontend-prediction/src/store/routingStore.ts",
            base / "frontend-training/src/store/routingStore.ts",
        ],
        "trainingStore.ts": [
            base / "frontend-prediction/src/store/trainingStore.ts",
            base / "frontend-training/src/store/trainingStore.ts",
        ],
        "workflowGraphStore.ts": [
            base / "frontend-prediction/src/store/workflowGraphStore.ts",
            base / "frontend-training/src/store/workflowGraphStore.ts",
        ],
        "workspaceStore.ts": [
            base / "frontend-prediction/src/store/workspaceStore.ts",
            base / "frontend-training/src/store/workspaceStore.ts",
        ],
    }

    results = check_duplicates(file_groups)

    print("\n" + "="*80)
    print("FRONTEND DUPLICATE FILE ANALYSIS")
    print("="*80)

    duplicates_found = []

    for name, hashes in results.items():
        print(f"\n{name}:")
        print("-" * 60)

        hash_values = [info["hash"] for info in hashes.values() if info["hash"] != "FILE_NOT_FOUND"]

        if len(hash_values) > 1 and len(set(hash_values)) == 1:
            print("  [DUPLICATE] - All files are identical")
            duplicates_found.append(name)
        elif len(hash_values) > 1:
            print("  [NOT DUPLICATE] - Files differ")
        else:
            print("  [INCOMPLETE] - Missing files")

        for path, info in hashes.items():
            # Show relative path
            rel_path = Path(path).relative_to(base)
            if info["hash"] == "FILE_NOT_FOUND":
                print(f"    {rel_path}: NOT FOUND")
            else:
                print(f"    {rel_path}:")
                print(f"      Hash: {info['hash'][:16]}...")
                print(f"      Size: {info['size']:,} bytes")

    print("\n" + "="*80)
    print(f"SUMMARY: {len(duplicates_found)} duplicate file groups found")
    print("="*80)

    if duplicates_found:
        print("\nDuplicate files that can be consolidated:")
        for name in duplicates_found:
            print(f"  - {name}")

if __name__ == "__main__":
    main()
