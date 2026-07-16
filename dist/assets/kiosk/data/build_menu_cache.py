"""Rebuild local McDonald's menu cache used by the kiosk."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from kiosk.menu import MENU_CACHE, fetch_live_menu  # noqa: E402


def main() -> None:
    data = fetch_live_menu()
    MENU_CACHE.parent.mkdir(parents=True, exist_ok=True)
    MENU_CACHE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    drinks = [p["name"] for p in data["products"] if p["categorySlug"] == "mc-cafe"]
    sides = [p["name"] for p in data["products"] if p["categorySlug"] == "sides"]
    print(
        f"wrote {MENU_CACHE} products={len(data['products'])} "
        f"drinks={len(drinks)} sides={len(sides)}"
    )
    print("set drinks:", [d["name"] for d in data["drinks"][:8]])
    print("set sides:", [s["name"] for s in data["sides"][:8]])


if __name__ == "__main__":
    main()
