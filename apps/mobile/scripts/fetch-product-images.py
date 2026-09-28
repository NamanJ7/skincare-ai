"""Download and normalize verified catalog product thumbnails.

The script prioritizes official brand pages, uses retailer product pages as a
fallback, stores every source URL for review, and writes a static TypeScript
require map for Expo. Run from the mobile workspace with Pillow installed.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import io
import json
import re
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "src" / "lib" / "product-catalog.ts"
IMAGE_DIR = ROOT / "assets" / "images" / "products"
MANIFEST_PATH = IMAGE_DIR / "sources.json"
MAP_PATH = ROOT / "src" / "lib" / "product-images.ts"

BRAND_DOMAINS: dict[str, tuple[str, ...]] = {
    "CeraVe": ("cerave.com",),
    "La Roche-Posay": ("laroche-posay.us",),
    "The Ordinary": ("theordinary.com",),
    "Paula's Choice": ("paulaschoice.com",),
    "Neutrogena": ("neutrogena.com",),
    "Cetaphil": ("cetaphil.com",),
    "Vanicream": ("vanicream.com",),
    "COSRX": ("cosrx.com",),
    "Beauty of Joseon": ("beautyofjoseon.com",),
    "Anua": ("anua.com",),
    "Laneige": ("laneige.com",),
    "Tatcha": ("tatcha.com",),
    "Glow Recipe": ("glowrecipe.com",),
    "Drunk Elephant": ("drunkelephant.com",),
    "PanOxyl": ("panoxyl.com",),
    "Differin": ("differin.com",),
    "Supergoop!": ("supergoop.com",),
    "EltaMD": ("eltamd.com",),
    "SkinCeuticals": ("skinceuticals.com",),
    "First Aid Beauty": ("firstaidbeauty.com",),
    "Kiehl's": ("kiehls.com",),
    "Clinique": ("clinique.com",),
    "Bioderma": ("bioderma.us", "bioderma.ca", "bioderma.com"),
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Referer": "https://duckduckgo.com/",
}

TRUSTED_RETAILERS = (
    "sephora.com",
    "ulta.com",
    "target.com",
    "walmart.com",
    "amazon.com",
    "dermstore.com",
    "lookfantastic.com",
    "spacenk.com",
    "iherb.com",
    "cvs.com",
    "walgreens.com",
)

# A small override list handles official storefronts whose image search results
# consistently prefer instruction cards or clinical graphics over the package.
SOURCE_OVERRIDES: dict[str, dict[str, Any]] = {
    "cosrx-snail-92-cream": {
        "imageUrl": "https://www.cosrx.com/cdn/shop/files/snail_cream_thumbnail_1200x1200.png?v=1748420673",
        "productPage": "https://www.cosrx.com/products/advanced-snail-92-all-in-one-cream",
        "label": "COSRX Advanced Snail 92 All In One Cream",
    },
    "glow-recipe-strawberry-smooth-serum": {
        "imageUrl": "https://www.glowrecipe.com/cdn/shop/files/NEW5_14_24_PDP_CLAIM_REFRESH_STRAWBERRY_SERUM-01.jpg?v=1762198075",
        "productPage": "https://www.glowrecipe.com/products/strawberry-smooth-bha-aha-salicylic-serum",
        "label": "Glow Recipe Strawberry Smooth BHA + AHA Salicylic Serum",
    },
}


@dataclass(frozen=True)
class Product:
    id: str
    brand: str
    name: str


def products() -> list[Product]:
    source = CATALOG_PATH.read_text(encoding="utf-8")
    matches = re.findall(
        r'product\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"',
        source,
    )
    result = [Product(*match) for match in matches]
    if len(result) != 100:
        raise RuntimeError(f"Expected 100 catalog products, found {len(result)}")
    return result


def request_bytes(url: str, timeout: int = 25) -> bytes:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read(15_000_001)


def official(url: str, domains: tuple[str, ...]) -> bool:
    try:
        host = urllib.parse.urlparse(url).hostname or ""
    except ValueError:
        return False
    host = host.lower()
    return any(host == domain or host.endswith(f".{domain}") for domain in domains)


def trusted_retailer(url: str) -> bool:
    return official(url, TRUSTED_RETAILERS)


def words(value: str) -> set[str]:
    return {
        token
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if (len(token) > 1 or token.isdigit())
        and token not in {"the", "with", "and", "skin", "face"}
    }


def normalized_name(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def open_beauty_facts_candidates(product: Product) -> list[dict[str, Any]]:
    query = f"{product.brand} {product.name}"
    url = "https://world.openbeautyfacts.org/cgi/search.pl?" + urllib.parse.urlencode(
        {
            "search_terms": query,
            "search_simple": "1",
            "action": "process",
            "json": "1",
            "page_size": "20",
            "fields": "code,brands,product_name,product_name_en,image_front_url,image_url,url",
        }
    )
    payload = json.loads(request_bytes(url).decode("utf-8", "ignore"))
    target_words = words(product.name)
    target_brand = normalized_name(product.brand).replace("the ", "")
    candidates: list[dict[str, Any]] = []
    for item in payload.get("products", []):
        if not isinstance(item, dict):
            continue
        name = str(item.get("product_name_en") or item.get("product_name") or "")
        brand = normalized_name(str(item.get("brands") or "")).replace("the ", "")
        image_url = item.get("image_front_url") or item.get("image_url")
        if not name or not isinstance(image_url, str) or not image_url.startswith("https://"):
            continue
        if target_brand not in brand and brand not in target_brand:
            continue
        name_words = words(name)
        overlap = len(target_words & name_words)
        coverage = overlap / max(1, len(target_words))
        if coverage < 0.55:
            continue
        candidates.append(
            {
                "imageUrl": image_url,
                "productPage": str(item.get("url") or "https://world.openbeautyfacts.org"),
                "label": f'{item.get("brands", "")} {name}'.strip(),
                # Community front photos are a fallback, but a clear front
                # photo is more useful than a tiny product in a marketing tile.
                "score": 250 + coverage * 100 + overlap,
                "query": query,
                "source": "Open Beauty Facts",
            }
        )
    return sorted(candidates, key=lambda item: item["score"], reverse=True)


def duckduckgo_candidates(product: Product, domains: tuple[str, ...]) -> list[dict[str, Any]]:
    query = f"{product.brand} {product.name} product"
    search_url = "https://duckduckgo.com/?" + urllib.parse.urlencode({"q": query})
    page = request_bytes(search_url).decode("utf-8", "ignore")
    token_match = re.search(r'vqd=["\']([^"\']+)', page)
    if not token_match:
        raise ValueError("DuckDuckGo search token was missing")
    image_url = "https://duckduckgo.com/i.js?" + urllib.parse.urlencode(
        {
            "l": "us-en",
            "o": "json",
            "q": query,
            "vqd": token_match.group(1),
            "f": ",,,",
        }
    )
    payload = json.loads(request_bytes(image_url).decode("utf-8", "ignore"))
    target_words = words(product.name)
    brand_words = words(product.brand)
    candidates: list[dict[str, Any]] = []
    for item in payload.get("results", []):
        if not isinstance(item, dict):
            continue
        source_image = item.get("image")
        source_page = item.get("url")
        title = str(item.get("title") or "")
        if not isinstance(source_image, str) or not isinstance(source_page, str):
            continue
        label_words = words(f"{title} {source_page} {source_image}")
        overlap = len(target_words & label_words)
        coverage = overlap / max(1, len(target_words))
        target_numbers = {token for token in target_words if token.isdigit()}
        label_numbers = {token for token in label_words if token.isdigit()}
        is_official = official(source_page, domains) or official(source_image, domains)
        is_retailer = trusted_retailer(source_page) or trusted_retailer(source_image)
        brand_match = bool(brand_words & label_words)
        if (
            coverage < 0.55
            or not target_numbers.issubset(label_numbers)
            or not (is_official or is_retailer or brand_match)
        ):
            continue
        width = int(item.get("width") or 0)
        height = int(item.get("height") or 0)
        ratio = width / height if width > 0 and height > 0 else 1
        image_hint = source_image.lower()
        page_hint = source_page.lower()
        trust_score = 1_200 if is_official else 1_050 if is_retailer else 0
        packshot_score = 0
        if any(hint in image_hint for hint in ("main-zoom", "main_zoom", "pdp_main", "hero-product")):
            packshot_score += 700
        if "productimages/sku" in image_hint:
            packshot_score += 700
        if 0.55 <= ratio <= 1.25:
            packshot_score += 180
        elif ratio > 1.5:
            packshot_score -= 500
        if any(
            hint in image_hint or hint in page_hint
            for hint in (
                "-av-",
                "_av_",
                "aplus-media",
                "carousel",
                "infographic",
                "before-after",
                "before_and_after",
                "benefit",
                "ingredients-graphic",
                "routine",
                "review",
                "share.jpg",
                "social-share",
                "stylize",
                "videoimages",
            )
        ):
            packshot_score -= 1_400
        if re.search(r"(?:official-|[_-]0)[2-9](?:[_.?-]|$)", image_hint):
            packshot_score -= 800
        candidates.append(
            {
                "imageUrl": source_image,
                "thumbnailUrl": item.get("thumbnail"),
                "productPage": source_page,
                "label": title,
                "score": trust_score + packshot_score + coverage * 100 + overlap,
                "query": query,
                "source": "Official brand page" if is_official else "Retailer product page",
            }
        )
    return sorted(candidates, key=lambda item: item["score"], reverse=True)


def bing_candidates(product: Product, domains: tuple[str, ...]) -> list[dict[str, Any]]:
    query = f'site:{domains[0]} "{product.name}" {product.brand} product'
    url = "https://www.bing.com/images/search?" + urllib.parse.urlencode(
        {"q": query, "form": "HDRSC2", "first": "1"}
    )
    page = request_bytes(url).decode("utf-8", "ignore")
    candidates: list[dict[str, Any]] = []
    for raw in re.findall(r'\bm="([^"]+)"', page):
        try:
            candidate = json.loads(html.unescape(raw))
        except (json.JSONDecodeError, TypeError):
            continue
        image_url = candidate.get("murl")
        page_url = candidate.get("purl")
        if not isinstance(image_url, str) or not isinstance(page_url, str):
            continue
        if not official(page_url, domains):
            continue
        label = " ".join(
            str(candidate.get(key, "")) for key in ("t", "desc", "purl", "murl")
        )
        overlap = len(words(product.name) & words(label))
        candidates.append(
            {
                "imageUrl": image_url,
                "productPage": page_url,
                "label": str(candidate.get("t", "")),
                "score": overlap,
                "query": query,
                "source": "Official brand page",
            }
        )
    return sorted(candidates, key=lambda item: item["score"], reverse=True)


def normalized_thumbnail(data: bytes) -> Image.Image:
    if len(data) > 15_000_000:
        raise ValueError("Image download exceeded 15 MB")
    source = Image.open(io.BytesIO(data))
    source.seek(0)
    image = source.convert("RGBA")
    if image.width < 160 or image.height < 160:
        raise ValueError(f"Image is too small: {image.width}x{image.height}")

    # Product pages commonly use transparent or white studio images. A warm
    # white square keeps packaging legible and consistent in the search list.
    contained = ImageOps.contain(image, (276, 276), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (320, 320), "#FCFAF6")
    canvas.alpha_composite(
        contained,
        ((canvas.width - contained.width) // 2, (canvas.height - contained.height) // 2),
    )
    return canvas.convert("RGB")


def fetch_one(product: Product, force: bool) -> dict[str, Any]:
    output = IMAGE_DIR / f"{product.id}.jpg"
    if output.exists() and not force:
        return {"id": product.id, "status": "kept"}

    domains = BRAND_DOMAINS.get(product.brand)
    if not domains:
        return {"id": product.id, "status": "error", "error": "No official domain"}

    candidates: list[dict[str, Any]] = []
    if override := SOURCE_OVERRIDES.get(product.id):
        candidates.append(
            {
                **override,
                "score": 10_000,
                "query": f"Verified official package image for {product.brand} {product.name}",
                "source": "Official brand page",
            }
        )
    errors: list[str] = []
    try:
        candidates.extend(open_beauty_facts_candidates(product))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Open Beauty Facts: {exc}")
    try:
        candidates.extend(bing_candidates(product, domains))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Official search: {exc}")
    try:
        candidates.extend(duckduckgo_candidates(product, domains))
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Image search: {exc}")

    candidates.sort(key=lambda item: item["score"], reverse=True)

    for candidate in candidates[:12]:
        try:
            try:
                data = request_bytes(candidate["imageUrl"])
            except Exception:
                thumbnail_url = candidate.get("thumbnailUrl")
                if not isinstance(thumbnail_url, str):
                    raise
                data = request_bytes(thumbnail_url)
            thumbnail = normalized_thumbnail(data)
            output.parent.mkdir(parents=True, exist_ok=True)
            thumbnail.save(output, "JPEG", quality=88, optimize=True, progressive=True)
            return {
                "id": product.id,
                "brand": product.brand,
                "name": product.name,
                "file": output.name,
                "sourcePage": candidate["productPage"],
                "sourceImage": candidate["imageUrl"],
                "sourceLabel": candidate["label"],
                "query": candidate["query"],
                "source": candidate["source"],
                "status": "downloaded",
            }
        except Exception:
            continue

    return {
        "id": product.id,
        "brand": product.brand,
        "name": product.name,
        "status": "error",
        "error": "No verified front image found" + (f" ({'; '.join(errors)})" if errors else ""),
    }


def write_require_map(items: list[Product]) -> None:
    lines = [
        "/** Static product thumbnails verified against brand and product names. */",
        'import type { ImageSource } from "expo-image";',
        "",
        "export const PRODUCT_IMAGES: Readonly<Record<string, ImageSource>> = {",
    ]
    for item in items:
        lines.append(
            f'  "{item.id}": require("../../assets/images/products/{item.id}.jpg"),'
        )
    lines.extend(["};", ""])
    MAP_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--id", action="append", dest="ids")
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()

    catalog = products()
    selected = [item for item in catalog if not args.ids or item.id in args.ids]
    selected = selected[: args.limit] if args.limit else selected
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    previous: dict[str, dict[str, Any]] = {}
    if MANIFEST_PATH.exists():
        previous = {
            item["id"]: item
            for item in json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }

    results: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fetch_one, item, args.force): item for item in selected}
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result["status"] == "kept" and result["id"] in previous:
                result = previous[result["id"]]
            results.append(result)
            print(f'{result["status"]:10} {result["id"]}', flush=True)
            time.sleep(0.03)

    merged = {**previous, **{item["id"]: item for item in results}}
    ordered = [merged[item.id] for item in catalog if item.id in merged]
    MANIFEST_PATH.write_text(json.dumps(ordered, indent=2) + "\n", encoding="utf-8")

    missing = [item.id for item in catalog if not (IMAGE_DIR / f"{item.id}.jpg").exists()]
    if not missing:
        write_require_map(catalog)
    else:
        print(f"Missing {len(missing)} images: {', '.join(missing)}")
    return 1 if missing and not args.limit else 0


if __name__ == "__main__":
    raise SystemExit(main())
