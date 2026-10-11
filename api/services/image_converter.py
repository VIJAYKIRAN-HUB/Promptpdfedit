import os
import tempfile
from typing import List, Dict, Any, Optional
from PIL import Image, ImageOps
try:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    A4_WIDTH_PT = float(A4[0])   # 595.28
    A4_HEIGHT_PT = float(A4[1])  # 841.89
except ImportError:
    canvas = None
    A4_WIDTH_PT = 595.28
    A4_HEIGHT_PT = 841.89


def normalize_image_to_rgb(img: Image.Image) -> Image.Image:
    """
    1. Correct EXIF orientation transpose (mobile cameras).
    2. Normalize RGBA/transparent PNGs to RGB with a clean white background.
    """
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba_img = img.convert("RGBA")
        white_bg = Image.new("RGBA", rgba_img.size, (255, 255, 255, 255))
        composite = Image.alpha_composite(white_bg, rgba_img)
        return composite.convert("RGB")
    elif img.mode != "RGB":
        return img.convert("RGB")

    return img


def convert_images_to_pdf_with_reportlab(
    sheet_items: List[Dict[str, Any]],
    output_path: str,
    global_settings: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate a professional multi-sheet PDF using ReportLab canvas.Canvas and Pillow.
    Each sheet item contains:
    - filepath: path to the uploaded image file
    - fit_mode: 'fit' (Fit to Page), 'fill' (Fill Page with crop), or 'original' (Original size)
    - margin: margin in PDF points (default 20)
    """
    if not sheet_items:
        raise ValueError("At least one image sheet item must be provided.")

    global_settings = global_settings or {}
    default_margin = float(global_settings.get("margin", 20.0))

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    if canvas is None:
        raise RuntimeError("The 'reportlab' package is required. Please install it using: pip install reportlab")

    pdf_canvas = canvas.Canvas(output_path, pagesize=A4)
    pw, ph = A4_WIDTH_PT, A4_HEIGHT_PT
    processed_count = 0
    temp_files_to_cleanup = []

    try:
        for idx, item in enumerate(sheet_items):
            img_path = item.get("filepath", "")
            if not img_path or not os.path.exists(img_path):
                continue

            fit_mode = item.get("fit_mode", "fit").lower()
            margin = float(item.get("margin", default_margin))

            with Image.open(img_path) as raw_img:
                norm_img = normalize_image_to_rgb(raw_img)
                img_w, img_h = norm_img.size

                # Save sanitized image to temp file for ReportLab drawImage
                temp_fd, temp_file = tempfile.mkstemp(suffix=".jpg")
                os.close(temp_fd)
                norm_img.save(temp_file, "JPEG", quality=95)
                temp_files_to_cleanup.append(temp_file)

                # FIT LOGIC 1: Fit to Page (preserve aspect ratio, show whole image within margins)
                if fit_mode == "fit":
                    avail_w = max(10.0, pw - (2 * margin))
                    avail_h = max(10.0, ph - (2 * margin))
                    scale = min(avail_w / float(img_w), avail_h / float(img_h))
                    draw_w = img_w * scale
                    draw_h = img_h * scale
                    x = (pw - draw_w) / 2.0
                    y = (ph - draw_h) / 2.0

                    pdf_canvas.drawImage(
                        temp_file,
                        x,
                        y,
                        width=draw_w,
                        height=draw_h,
                        preserveAspectRatio=True
                    )

                # FIT LOGIC 2: Fill Page (scale to cover full target dimensions, crop overflow)
                elif fit_mode == "fill":
                    target_w = pw - (2 * margin)
                    target_h = ph - (2 * margin)
                    img_aspect = img_h / float(img_w)
                    page_aspect = target_h / float(target_w)

                    if img_aspect > page_aspect:
                        # Image is taller than page aspect: match width, overflow height
                        draw_w = target_w
                        draw_h = target_w * img_aspect
                        x = margin
                        y = margin + (target_h - draw_h) / 2.0
                    else:
                        # Image is wider than page aspect: match height, overflow width
                        draw_h = target_h
                        draw_w = target_h / img_aspect
                        x = margin + (target_w - draw_w) / 2.0
                        y = margin

                    # Clip to target printable box
                    pdf_canvas.saveState()
                    clip_path = pdf_canvas.beginPath()
                    clip_path.rect(margin, margin, target_w, target_h)
                    pdf_canvas.clipPath(clip_path, stroke=0, fill=0)
                    pdf_canvas.drawImage(
                        temp_file,
                        x,
                        y,
                        width=draw_w,
                        height=draw_h
                    )
                    pdf_canvas.restoreState()

                # FIT LOGIC 3: Original Size (center without scaling at 72 DPI, clamp to page if larger)
                else:
                    scale = 1.0
                    max_allowed_w = pw - (2 * margin)
                    max_allowed_h = ph - (2 * margin)
                    if img_w > max_allowed_w or img_h > max_allowed_h:
                        scale = min(max_allowed_w / float(img_w), max_allowed_h / float(img_h))

                    draw_w = img_w * scale
                    draw_h = img_h * scale
                    x = (pw - draw_w) / 2.0
                    y = (ph - draw_h) / 2.0

                    pdf_canvas.drawImage(
                        temp_file,
                        x,
                        y,
                        width=draw_w,
                        height=draw_h,
                        preserveAspectRatio=True
                    )

                pdf_canvas.showPage()
                processed_count += 1

        pdf_canvas.save()

    finally:
        for t in temp_files_to_cleanup:
            try:
                if os.path.exists(t):
                    os.remove(t)
            except Exception:
                pass

    if processed_count == 0:
        raise RuntimeError("No valid images could be rendered into the PDF canvas.")

    return {
        "success": True,
        "output_path": output_path,
        "page_count": processed_count
    }


# Backwards compatibility alias
def convert_images_to_pdf(
    image_paths: List[str],
    output_path: str,
    settings: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    items = [{"filepath": p, "fit_mode": "fit"} for p in image_paths]
    return convert_images_to_pdf_with_reportlab(items, output_path, settings)


def invert_y_axis(y_top: float, element_height: float, page_height: float = A4_HEIGHT_PT) -> float:
    """
    Convert CSS/DOM top-left Y coordinate to ReportLab bottom-left coordinate system.
    Formula: reportlab_y = page_height - y_top - element_height
    """
    return float(page_height) - float(y_top) - float(element_height)


def convert_freeform_pages_to_pdf_with_reportlab(
    pages_payload: List[Dict[str, Any]],
    file_map: Dict[str, str],
    output_path: str
) -> Dict[str, Any]:
    """
    Generate a Word-style freeform multi-page PDF where each page can contain multiple
    images placed at specific (X, Y) coordinates and scaled to exact (width, height) dimensions.
    """
    if not pages_payload:
        raise ValueError("At least one page must be provided.")

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    if canvas is None:
        raise RuntimeError("The 'reportlab' package is required. Please install it using: pip install reportlab")

    pdf_canvas = canvas.Canvas(output_path, pagesize=A4)
    pw, ph = A4_WIDTH_PT, A4_HEIGHT_PT
    temp_files_to_cleanup = []
    total_images_rendered = 0

    try:
        for page_data in pages_payload:
            images_list = page_data.get("images", [])

            for img_conf in images_list:
                file_id = img_conf.get("file_id") or img_conf.get("filename")
                src_path = file_map.get(file_id)

                if not src_path or not os.path.exists(src_path):
                    # Try matching by base name
                    for k, v in file_map.items():
                        if os.path.basename(k) == os.path.basename(str(file_id)):
                            src_path = v
                            break

                if not src_path or not os.path.exists(src_path):
                    continue

                x = float(img_conf.get("x", 0.0))
                y_top = float(img_conf.get("y", 0.0))
                w = float(img_conf.get("width", 200.0))
                h = float(img_conf.get("height", 150.0))

                # Exact Y-axis inversion math from CSS top-left to ReportLab bottom-left
                reportlab_y = invert_y_axis(y_top, h, ph)

                # Process image with Pillow for orientation and clean RGB background
                with Image.open(src_path) as raw_img:
                    norm_img = normalize_image_to_rgb(raw_img)
                    temp_fd, temp_file = tempfile.mkstemp(suffix=".jpg")
                    os.close(temp_fd)
                    norm_img.save(temp_file, "JPEG", quality=95)
                    temp_files_to_cleanup.append(temp_file)

                # Draw image onto ReportLab canvas at exact coordinates
                pdf_canvas.drawImage(
                    temp_file,
                    x,
                    reportlab_y,
                    width=w,
                    height=h,
                    preserveAspectRatio=True
                )
                total_images_rendered += 1

            # Advance to next page
            pdf_canvas.showPage()

        pdf_canvas.save()

    finally:
        for t in temp_files_to_cleanup:
            try:
                if os.path.exists(t):
                    os.remove(t)
            except Exception:
                pass

    return {
        "success": True,
        "output_path": output_path,
        "page_count": len(pages_payload),
        "total_images": total_images_rendered
    }
