#!/usr/bin/env python3
"""
bracelet_geometry_validator.py — Crystal Bracelet Studio 領域模型幾何與契約驗證器
功能：
1. 靜態檢查 src/domain/types.ts：確保 BraceletPlacement 零 px 污染、BeadSpec 金額使用整數 (priceMinor)。
2. 檢查手串領域 Invariants 單元測試是否具備並通過。
"""

import sys
import subprocess
from pathlib import Path

def validate():
    project_root = Path(__file__).resolve().parent.parent
    types_file = project_root / "src" / "domain" / "types.ts"
    
    errors = []
    
    if not types_file.is_file():
        errors.append(f"Missing domain types file: {types_file}")
    else:
        content = types_file.read_text(encoding="utf-8")
        if "radiusPx" in content:
            errors.append("Domain Model Violation: 'radiusPx' detected in domain/types.ts (px is a presentation concern).")
        if "priceMinor" not in content:
            errors.append("Domain Model Violation: 'priceMinor' integer field missing in BeadSpec.")

    # 執行 npm run test (如果可用的話)
    try:
        res = subprocess.run(["npx", "vitest", "run", "src/domain/__tests__"], cwd=str(project_root), capture_output=True, text=True, shell=True)
        if res.returncode != 0:
            errors.append(f"Domain invariant tests failed:\n{res.stdout}\n{res.stderr}")
    except Exception as e:
        errors.append(f"Failed to execute vitest: {e}")

    if errors:
        print("[bracelet_geometry_validator] FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("[bracelet_geometry_validator] PASS: Domain model boundary is clean and invariant tests passed.")
    return 0

if __name__ == "__main__":
    sys.exit(validate())
