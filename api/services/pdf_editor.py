import os
from typing import List, Dict, Any, Optional
import fitz  # PyMuPDF


def get_pdf_page_count(filepath: str) -> int:
    """Return total page count of a PDF."""
    try:
        with fitz.open(filepath) as doc:
            return len(doc)
    except Exception as e:
        raise ValueError(f"Unable to read PDF file: {str(e)}")


def find_text_occurrences(filepath: str, search_term: str, case_sensitive: bool = False) -> List[Dict[str, Any]]:
    """
    Search for exact text occurrences across all pages of a PDF.
    Returns a structured list of match coordinates, page numbers (1-indexed), and surrounding context.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"PDF file not found at: {filepath}")

    if not search_term or not search_term.strip():
        return []

    occurrences = []
    flags = fitz.TEXT_CASE_SENSITIVE if case_sensitive else 0

    try:
        with fitz.open(filepath) as doc:
            for page_idx, page in enumerate(doc):
                # Search rects
                rects = page.search_for(search_term, flags=flags)
                if not rects:
                    continue

                # Extract page blocks to extract surrounding sentence context
                text_blocks = page.get_text("blocks")

                for rect in rects:
                    context_snippet = ""
                    for b in text_blocks:
                        bx0, by0, bx1, by1, block_text = b[0], b[1], b[2], b[3], b[4]
                        # Check if rect overlaps or is close to this block
                        if not (rect.x1 < bx0 or rect.x0 > bx1 or rect.y1 < by0 or rect.y0 > by1):
                            # Clean block text to extract immediate context
                            cleaned = " ".join(block_text.split())
                            pos = cleaned.lower().find(search_term.lower())
                            if pos != -1:
                                start = max(0, pos - 40)
                                end = min(len(cleaned), pos + len(search_term) + 40)
                                context_snippet = ("..." if start > 0 else "") + cleaned[start:end] + ("..." if end < len(cleaned) else "")
                                break

                    if not context_snippet:
                        context_snippet = search_term

                    occurrences.append({
                        "page": page_idx + 1,  # 1-indexed for user-friendliness
                        "page_index": page_idx,
                        "rect": {
                            "x0": round(rect.x0, 2),
                            "y0": round(rect.y0, 2),
                            "x1": round(rect.x1, 2),
                            "y1": round(rect.y1, 2),
                            "width": round(rect.width, 2),
                            "height": round(rect.height, 2)
                        },
                        "search_term": search_term,
                        "context": context_snippet
                    })

    except Exception as e:
        raise RuntimeError(f"Error scanning PDF text: {str(e)}")

    return occurrences


def _extract_style_at_rect(page: fitz.Page, target_rect: fitz.Rect) -> Dict[str, Any]:
    """
    Inspect the page text span dictionary to determine font name, font size, and color
    at the specified bounding box.
    """
    default_style = {
        "fontname": "helv",
        "fontsize": 11.0,
        "color": (0, 0, 0),
        "is_fallback_font": True,
        "original_font": "unknown"
    }

    try:
        text_dict = page.get_text("dict")
        for block in text_dict.get("blocks", []):
            if "lines" not in block:
                continue
            for line in block["lines"]:
                for span in line.get("spans", []):
                    span_bbox = fitz.Rect(span["bbox"])
                    # If span overlaps with target rect
                    if span_bbox.intersects(target_rect):
                        font_name = span.get("font", "")
                        fontsize = float(span.get("size", 11.0))
                        color_int = span.get("color", 0)

                        # Convert integer color to RGB tuple (0.0 to 1.0)
                        r = ((color_int >> 16) & 0xFF) / 255.0
                        g = ((color_int >> 8) & 0xFF) / 255.0
                        b = (color_int & 0xFF) / 255.0

                        # Map font names to standard standard PDF base fonts or helvetica
                        clean_font = "helv"
                        is_fallback = True
                        lower_name = font_name.lower()
                        if "times" in lower_name:
                            clean_font = "times-roman"
                            is_fallback = False
                        elif "courier" in lower_name:
                            clean_font = "courier"
                            is_fallback = False
                        elif "helv" in lower_name or "arial" in lower_name or "sans" in lower_name:
                            clean_font = "helv"
                            is_fallback = False

                        return {
                            "fontname": clean_font,
                            "fontsize": max(6.0, fontsize),
                            "color": (r, g, b),
                            "is_fallback_font": is_fallback,
                            "original_font": font_name
                        }
    except Exception:
        pass

    return default_style


def apply_text_replacement(
    filepath: str,
    replacements: List[Dict[str, Any]],
    output_path: str
) -> Dict[str, Any]:
    """
    Applies text replacements using PyMuPDF:
    1. Locates bounding box of old text.
    2. Redacts the old text (blanks it out cleanly).
    3. Inserts new replacement text at the exact same coordinates.
    4. Matches original font size, color, and flags font fallback warning when custom font is not standard.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Input PDF not found: {filepath}")

    doc = fitz.open(filepath)
    warnings: List[str] = []
    replacement_records = []
    total_replaced = 0

    try:
        for rep in replacements:
            find_str = rep.get("find", "")
            replace_str = rep.get("replace_with", "")
            target_page = rep.get("page", None)  # 1-indexed if specified
            case_sensitive = rep.get("case_sensitive", False)

            if not find_str:
                continue

            flags = fitz.TEXT_CASE_SENSITIVE if case_sensitive else 0

            # Determine pages to search
            if target_page is not None and 1 <= target_page <= len(doc):
                pages_to_process = [(target_page - 1, doc[target_page - 1])]
            else:
                pages_to_process = [(i, page) for i, page in enumerate(doc)]

            for page_idx, page in pages_to_process:
                rects = page.search_for(find_str, flags=flags)
                if not rects:
                    continue

                for rect in rects:
                    # Detect style of original text
                    style = _extract_style_at_rect(page, rect)

                    if style["is_fallback_font"]:
                        warning_msg = (
                            f"Page {page_idx + 1}: Original font '{style['original_font']}' "
                            f"is not a standard embedded font; fell back to Helvetica."
                        )
                        if warning_msg not in warnings:
                            warnings.append(warning_msg)

                    # 1. Add redaction annotation to blank out the old text
                    # Fill with white background
                    page.add_redact_annot(rect, fill=(1, 1, 1))

                    # Apply pending redactions on page
                    page.apply_redactions()

                    # 2. Insert new text at exact coordinates
                    # Baseline point calculation: y0 + fontsize * 0.8 to align with original text baseline
                    fontsize = style["fontsize"]
                    baseline_y = rect.y0 + (fontsize * 0.8)
                    point = fitz.Point(rect.x0, baseline_y)

                    page.insert_text(
                        point,
                        replace_str,
                        fontname=style["fontname"],
                        fontsize=fontsize,
                        color=style["color"]
                    )

                    total_replaced += 1
                    replacement_records.append({
                        "page": page_idx + 1,
                        "original": find_str,
                        "replacement": replace_str,
                        "rect": [rect.x0, rect.y0, rect.x1, rect.y1],
                        "font_used": style["fontname"]
                    })

        # Save to output path
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        doc.save(output_path, garbage=4, deflate=True)

    finally:
        doc.close()

    return {
        "success": True,
        "total_replaced": total_replaced,
        "output_path": output_path,
        "warnings": warnings,
        "details": replacement_records
    }


def get_closest_base14_font(font_name: str) -> str:
    """
    Map arbitrary PDF embedded or system font names to closest standard Base-14 writable font in PyMuPDF.
    """
    if not font_name:
        return "helv"
    lower = font_name.lower()
    is_bold = any(k in lower for k in ["bold", "black", "heavy", "bld"])
    is_italic = any(k in lower for k in ["italic", "oblique", "slant"])

    if any(k in lower for k in ["times", "serif", "roman", "georgia", "cambria", "garamond"]):
        if is_bold and is_italic:
            return "times-bolditalic"
        elif is_bold:
            return "times-bold"
        elif is_italic:
            return "times-italic"
        return "times-roman"
    elif any(k in lower for k in ["courier", "mono", "typewriter", "consolas", "menlo"]):
        if is_bold and is_italic:
            return "courier-boldoblique"
        elif is_bold:
            return "courier-bold"
        elif is_italic:
            return "courier-oblique"
        return "courier"
    else:  # Helvetica / Arial / Sans-serif
        if is_bold and is_italic:
            return "hebi"
        elif is_bold:
            return "hebo"
        elif is_italic:
            return "heit"
        return "helv"


def parse_color_to_rgb(color_val: Any) -> tuple:
    """Convert int, hex string ('#RRGGBB'), or tuple to RGB floats (0.0 to 1.0)."""
    if isinstance(color_val, (list, tuple)) and len(color_val) >= 3:
        if any(v > 1.0 for v in color_val[:3]):
            return tuple(min(1.0, max(0.0, v / 255.0)) for v in color_val[:3])
        return tuple(min(1.0, max(0.0, float(v))) for v in color_val[:3])

    if isinstance(color_val, str) and color_val.startswith("#"):
        hex_str = color_val.lstrip("#")
        if len(hex_str) == 6:
            r = int(hex_str[0:2], 16) / 255.0
            g = int(hex_str[2:4], 16) / 255.0
            b = int(hex_str[4:6], 16) / 255.0
            return (r, g, b)

    if isinstance(color_val, int):
        r = ((color_val >> 16) & 0xFF) / 255.0
        g = ((color_val >> 8) & 0xFF) / 255.0
        b = (color_val & 0xFF) / 255.0
        return (r, g, b)

    return (0.0, 0.0, 0.0)


def extract_page_text_elements(filepath: str, page_number: int = 1) -> Dict[str, Any]:
    """
    Extract detailed text block, line, and span elements from a PDF page for WYSIWYG editing.
    Returns page dimensions and a flat list of TextElements with coordinates, font, size, and color.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"PDF not found: {filepath}")

    with fitz.open(filepath) as doc:
        if page_number < 1 or page_number > len(doc):
            raise ValueError(f"Page number {page_number} out of range (1 - {len(doc)}).")

        page = doc[page_number - 1]
        page_rect = page.rect
        page_dict = page.get_text("dict")

        elements = []
        element_idx = 0

        for b_idx, block in enumerate(page_dict.get("blocks", [])):
            if block.get("type", 0) != 0:  # 0 is text block, 1 is image
                continue

            for l_idx, line in enumerate(block.get("lines", [])):
                for s_idx, span in enumerate(line.get("spans", [])):
                    text = span.get("text", "")
                    if not text or not text.strip():
                        continue

                    bbox = span.get("bbox", [0, 0, 0, 0])
                    font_name = span.get("font", "Helvetica")
                    size = float(span.get("size", 11.0))
                    color_int = int(span.get("color", 0))

                    # Format color as hex code
                    color_hex = f"#{((color_int >> 16) & 0xFF):02x}{((color_int >> 8) & 0xFF):02x}{(color_int & 0xFF):02x}"

                    elements.append({
                        "id": f"p{page_number}_b{b_idx}_l{l_idx}_s{s_idx}_{element_idx}",
                        "text": text,
                        "bbox": [round(coord, 2) for coord in bbox],
                        "font": font_name,
                        "size": round(size, 2),
                        "color": color_int,
                        "color_hex": color_hex,
                        "page": page_number
                    })
                    element_idx += 1

        return {
            "page": page_number,
            "total_pages": len(doc),
            "width": round(page_rect.width, 2),
            "height": round(page_rect.height, 2),
            "elements": elements
        }


def apply_exact_replacements(
    filepath: str,
    operations: List[Dict[str, Any]],
    output_path: str
) -> Dict[str, Any]:
    """
    Applies WYSIWYG direct-click text edits (exact_replace, delete_text, add_text)
    as well as legacy string replacements in a single atomic pass.
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Input PDF not found: {filepath}")

    doc = fitz.open(filepath)
    warnings: List[str] = []
    total_modified = 0

    try:
        for op in operations:
            action = op.get("action", "replace_text")
            page_num = op.get("page", 1) or 1
            if page_num < 1 or page_num > len(doc):
                continue

            page = doc[page_num - 1]

            if action == "exact_replace":
                bbox_raw = op.get("bbox")
                if not bbox_raw or len(bbox_raw) != 4:
                    continue

                bbox = fitz.Rect(bbox_raw)
                new_text = op.get("new_text", "")
                font_name = op.get("font", "helv")
                font_size = float(op.get("size", 11.0))
                color_val = op.get("color", "#000000")
                rgb_color = parse_color_to_rgb(color_val)
                target_font = get_closest_base14_font(font_name)

                # 1. Blank out / redact original text span
                redact_rect = fitz.Rect(bbox.x0 - 0.5, bbox.y0 - 0.5, bbox.x1 + 0.5, bbox.y1 + 0.5)
                page.add_redact_annot(redact_rect, fill=(1, 1, 1))
                page.apply_redactions()

                # 2. Insert new text at exact coordinates
                baseline_y = bbox.y0 + (font_size * 0.82)
                point = fitz.Point(bbox.x0, baseline_y)

                try:
                    page.insert_text(
                        point,
                        new_text,
                        fontname=target_font,
                        fontsize=font_size,
                        color=rgb_color
                    )
                except Exception:
                    page.insert_text(
                        point,
                        new_text,
                        fontname="helv",
                        fontsize=font_size,
                        color=rgb_color
                    )
                    warnings.append(f"Fell back to standard Helvetica on page {page_num}.")

                total_modified += 1

            elif action in ("delete_text", "redact_text"):
                bbox_raw = op.get("bbox")
                if bbox_raw and len(bbox_raw) == 4:
                    bbox = fitz.Rect(bbox_raw)
                    redact_rect = fitz.Rect(bbox.x0 - 0.5, bbox.y0 - 0.5, bbox.x1 + 0.5, bbox.y1 + 0.5)
                    page.add_redact_annot(redact_rect, fill=(1, 1, 1))
                    page.apply_redactions()
                    total_modified += 1

            elif action == "add_text":
                x = float(op.get("x", 50.0))
                y = float(op.get("y", 50.0))
                text = op.get("text", "")
                font_name = op.get("font", "helv")
                font_size = float(op.get("size", 12.0))
                color_val = op.get("color", "#000000")
                rgb_color = parse_color_to_rgb(color_val)
                target_font = get_closest_base14_font(font_name)

                point = fitz.Point(x, y)
                page.insert_text(
                    point,
                    text,
                    fontname=target_font,
                    fontsize=font_size,
                    color=rgb_color
                )
                total_modified += 1

            elif action == "replace_text":
                find_str = op.get("find", "")
                replace_str = op.get("replace_with", "")
                if find_str:
                    flags = fitz.TEXT_CASE_SENSITIVE if op.get("case_sensitive", False) else 0
                    rects = page.search_for(find_str, flags=flags)
                    for r in rects:
                        style = _extract_style_at_rect(page, r)
                        page.add_redact_annot(r, fill=(1, 1, 1))
                        page.apply_redactions()
                        baseline_y = r.y0 + (style["fontsize"] * 0.8)
                        point = fitz.Point(r.x0, baseline_y)
                        page.insert_text(
                            point,
                            replace_str,
                            fontname=style["fontname"],
                            fontsize=style["fontsize"],
                            color=style["color"]
                        )
                        total_modified += 1

        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        doc.save(output_path, garbage=4, deflate=True)

    finally:
        doc.close()

    return {
        "success": True,
        "total_replaced": total_modified,
        "output_path": output_path,
        "warnings": warnings
    }
