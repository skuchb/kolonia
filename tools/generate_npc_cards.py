from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PORTRAITS = ROOT / "pictures" / "portraits_gothic1"
NPC_DIR = (
    ROOT
    / "data-src"
    / "g1"
    / "Unified-PL"
    / "_work"
    / "Data"
    / "Scripts"
    / "Content"
    / "Story"
    / "NPC"
)
OUT_DIR = ROOT / "cards"

CARD_IDS = [100, 1000, 101, 102, 1037]

W, H = 1024, 1536

FONT_REG = Path(r"C:\Windows\Fonts\GARA.TTF")
FONT_BOLD = Path(r"C:\Windows\Fonts\GARABD.TTF")


@dataclass
class Npc:
    id: int
    file: Path
    name: str
    level: int
    strength: int
    dexterity: int
    mana: int
    mana_max: int
    hp: int
    hp_max: int
    talent: str
    talent_level: int
    tactic: str
    equipment: list[str]


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


F_TITLE = font(FONT_BOLD, 54)
F_HEAD = font(FONT_BOLD, 42)
F_LABEL = font(FONT_BOLD, 31)
F_VALUE = font(FONT_BOLD, 45)
F_SMALL = font(FONT_REG, 27)
F_BODY = font(FONT_REG, 32)
F_LOGO = font(FONT_BOLD, 64)


def read_npc_file(path: Path) -> str:
    return path.read_text(encoding="cp1250", errors="ignore")


def find_npc_file(npc_id: int) -> Path:
    for path in NPC_DIR.glob("*.d"):
        text = read_npc_file(path)
        match = re.search(r"(?mi)^\s*id\s*=\s*(\d+)\s*;", text)
        if match and int(match.group(1)) == npc_id:
            return path
    raise FileNotFoundError(f"No NPC file with id={npc_id}")


def one(pattern: str, text: str, default: str = "") -> str:
    match = re.search(pattern, text, re.MULTILINE | re.IGNORECASE)
    return match.group(1).strip() if match else default


def number(pattern: str, text: str, default: int = 0) -> int:
    value = one(pattern, text, "")
    return int(value) if value.isdigit() else default


def clean_name(raw: str, fallback: str) -> str:
    raw = raw.strip()
    if raw.startswith('"') and raw.endswith('"'):
        return raw[1:-1]
    constants = {
        "NAME_BAUER": "Bauer",
        "NAME_BUDDLER": "Kopacz",
    }
    return constants.get(raw.upper(), fallback)


TALENTS = {
    "NPC_TALENT_1H": "Broń jednoręczna",
    "NPC_TALENT_2H": "Broń dwuręczna",
    "NPC_TALENT_BOW": "Łuk",
    "NPC_TALENT_CROSSBOW": "Kusza",
    "NPC_TALENT_PICKLOCK": "Otwieranie zamków",
    "NPC_TALENT_SNEAK": "Skradanie",
    "NPC_TALENT_MAGE": "Magia",
}


TACTICS = {
    "FAI_HUMAN_COWARD": "Coward",
    "FAI_HUMAN_STRONG": "Strong",
    "FAI_HUMAN_MASTER": "Master",
    "FAI_HUMAN_NORMAL": "Normal",
}


def parse_npc(npc_id: int) -> Npc:
    path = find_npc_file(npc_id)
    text = read_npc_file(path)
    fallback = path.stem.split("_", 2)[-1]
    raw_name = one(r"^\s*name\s*=\s*(.+?)\s*;", text, fallback)
    talents = re.findall(
        r"Npc_SetTalentSkill\s*\(\s*self\s*,\s*(NPC_TALENT_[A-Z0-9_]+)\s*,\s*(\d+)\s*\)",
        text,
        re.IGNORECASE,
    )
    talent_code, talent_level = ("", "0")
    if talents:
        talent_code, talent_level = talents[0]
    equipment = re.findall(
        r"(?:EquipItem|CreateInvItems?)\s*\(\s*self\s*,\s*([A-Za-z0-9_]+)",
        text,
        re.IGNORECASE,
    )
    return Npc(
        id=npc_id,
        file=path,
        name=clean_name(raw_name, fallback),
        level=number(r"^\s*level\s*=\s*(\d+)\s*;", text, 0),
        strength=number(r"attribute\s*\[\s*ATR_STRENGTH\s*\]\s*=\s*(\d+)\s*;", text, 0),
        dexterity=number(r"attribute\s*\[\s*ATR_DEXTERITY\s*\]\s*=\s*(\d+)\s*;", text, 0),
        mana=number(r"attribute\s*\[\s*ATR_MANA\s*\]\s*=\s*(\d+)\s*;", text, 0),
        mana_max=number(r"attribute\s*\[\s*ATR_MANA_MAX\s*\]\s*=\s*(\d+)\s*;", text, 0),
        hp=number(r"attribute\s*\[\s*ATR_HITPOINTS\s*\]\s*=\s*(\d+)\s*;", text, 0),
        hp_max=number(r"attribute\s*\[\s*ATR_HITPOINTS_MAX\s*\]\s*=\s*(\d+)\s*;", text, 0),
        talent=TALENTS.get(talent_code.upper(), "—"),
        talent_level=int(talent_level),
        tactic=TACTICS.get(one(r"^\s*fight_tactic\s*=\s*([A-Z0-9_]+)\s*;", text, "—").upper(), "—"),
        equipment=equipment[:4],
    )


def textured_rect(size: tuple[int, int], base: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", size, base)
    noise = Image.effect_noise(size, 34).convert("L")
    noise = ImageEnhance.Contrast(noise).enhance(1.8)
    tint = Image.new("RGB", size, (22, 18, 13))
    img = Image.blend(img, tint, 0.22)
    img.putalpha(noise.point(lambda p: int(p * 0.18)))
    bg = Image.new("RGBA", size, base + (255,))
    bg.alpha_composite(img)
    return bg


def draw_line(draw: ImageDraw.ImageDraw, y: int, x1: int, x2: int) -> None:
    draw.line((x1, y, x2, y), fill=(94, 74, 48), width=2)
    draw.line((x1, y + 2, x2, y + 2), fill=(22, 17, 13), width=1)


def fit_text(draw: ImageDraw.ImageDraw, text: str, font_path: Path, max_width: int, start_size: int) -> ImageFont.FreeTypeFont:
    size = start_size
    while size > 18:
        candidate = font(font_path, size)
        if draw.textbbox((0, 0), text, font=candidate)[2] <= max_width:
            return candidate
        size -= 2
    return font(font_path, size)


def cover_image(path: Path, size: tuple[int, int]) -> Image.Image:
    img = Image.open(path).convert("RGB")
    target_ratio = size[0] / size[1]
    ratio = img.width / img.height
    if ratio > target_ratio:
        new_w = int(img.height * target_ratio)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))
    else:
        new_h = int(img.width / target_ratio)
        top = max(0, (img.height - new_h) // 2)
        img = img.crop((0, top, img.width, top + new_h))
    img = img.resize(size, Image.Resampling.LANCZOS)
    img = ImageEnhance.Color(img).enhance(0.78)
    img = ImageEnhance.Contrast(img).enhance(1.12)
    img = ImageEnhance.Brightness(img).enhance(0.86)
    vignette = Image.new("L", size, 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse((-size[0] * 0.28, -size[1] * 0.08, size[0] * 1.28, size[1] * 1.04), fill=210)
    vignette = vignette.filter(ImageFilter.GaussianBlur(85))
    dark = Image.new("RGB", size, (10, 8, 6))
    return Image.composite(img, dark, vignette)


def draw_icon(draw: ImageDraw.ImageDraw, center: tuple[int, int], label: str) -> None:
    x, y = center
    draw.regular_polygon((x, y, 28), n_sides=4, rotation=45, fill=(43, 35, 25), outline=(103, 79, 49), width=3)
    draw.text((x, y - 1), label, anchor="mm", fill=(229, 214, 185), font=font(FONT_BOLD, 25))


def render_card(npc: Npc) -> Path:
    portrait = PORTRAITS / f"{npc.id}.jpg"
    card = textured_rect((W, H), (17, 14, 10))
    draw = ImageDraw.Draw(card)

    # Outer iron frame
    for i, color in enumerate([(48, 42, 32), (132, 104, 65), (21, 18, 14), (86, 69, 45)]):
        draw.rounded_rectangle((18 + i * 7, 18 + i * 7, W - 18 - i * 7, H - 18 - i * 7), radius=24 - i * 3, outline=color, width=3)

    # Red torn header without guild or ID.
    header = textured_rect((W - 126, 132), (89, 28, 14))
    mask = Image.new("L", header.size, 0)
    md = ImageDraw.Draw(mask)
    md.rectangle((0, 14, header.width, 112), fill=235)
    for x in range(0, header.width, 31):
        md.rectangle((x, 104 + (x % 17), x + 18, 122), fill=0)
    card.paste(header, (63, 70), mask)
    name_font = fit_text(draw, npc.name.upper(), FONT_BOLD, 760, 72)
    draw.text((W // 2, 126), npc.name.upper(), anchor="mm", fill=(226, 205, 164), font=name_font)
    draw.text((W // 2, 170), "KARTA POSTACI", anchor="mm", fill=(151, 126, 87), font=F_SMALL)

    # Left portrait panel
    px, py, pw, ph = 70, 226, 430, 868
    draw.rectangle((px - 8, py - 8, px + pw + 8, py + ph + 8), fill=(14, 12, 9), outline=(106, 82, 50), width=3)
    photo = cover_image(portrait, (pw, ph))
    card.alpha_composite(photo.convert("RGBA"), (px, py))
    draw.rectangle((px, py, px + pw, py + ph), outline=(55, 48, 36), width=4)
    draw.line((px + pw - 24, py, px + pw - 24, py + ph), fill=(14, 12, 10), width=6)
    draw.polygon([(px + pw - 22, py + ph), (px + pw + 92, py + ph), (px + pw - 22, py + ph - 118)], fill=(17, 14, 10), outline=(85, 67, 43))

    # Right attributes panel
    rx, ry, rw, rh = 542, 252, 410, 652
    draw.rectangle((rx, ry, rx + rw, ry + rh), fill=(17, 15, 11), outline=(58, 47, 33), width=2)
    draw.text((rx + rw // 2, ry + 54), "ATRYBUTY", anchor="mm", fill=(203, 181, 145), font=F_HEAD)
    draw_line(draw, ry + 88, rx + 44, rx + rw - 44)
    rows = [
        ("S", "SIŁA", str(npc.strength)),
        ("Z", "ZRĘCZNOŚĆ", str(npc.dexterity)),
        ("M", "MANA", str(npc.mana_max or npc.mana)),
        ("P", "PUNKTY ŻYCIA", f"{npc.hp} / {npc.hp_max}"),
    ]
    y = ry + 148
    for icon, label, value in rows:
        draw_icon(draw, (rx + 64, y + 6), icon)
        label_font = fit_text(draw, label, FONT_BOLD, 194, 31)
        draw.text((rx + 112, y - 18), label, fill=(196, 176, 141), font=label_font)
        value_font = fit_text(draw, value, FONT_BOLD, 118, 45)
        draw.text((rx + rw - 44, y - 18), value, anchor="ra", fill=(225, 172, 74), font=value_font)
        draw_line(draw, y + 48, rx + 44, rx + rw - 44)
        y += 88

    draw.text((rx + rw // 2, ry + 484), "POZIOM", anchor="mm", fill=(203, 181, 145), font=F_HEAD)
    draw_line(draw, ry + 516, rx + 92, rx + rw - 92)
    draw.regular_polygon((rx + rw // 2, ry + 592, 56), n_sides=4, rotation=45, fill=(32, 25, 18), outline=(106, 82, 50), width=4)
    level_font = fit_text(draw, str(npc.level), FONT_BOLD, 92, 66)
    draw.text((rx + rw // 2, ry + 592), str(npc.level), anchor="mm", fill=(225, 172, 74), font=level_font)

    # Equipment boxes
    ex, ey = 536, 946
    draw.text((ex + 210, ey - 28), "WYPOSAŻENIE", anchor="mm", fill=(203, 181, 145), font=font(FONT_BOLD, 36))
    items = npc.equipment or ["—"]
    for idx in range(4):
        x = ex + idx * 105
        draw.rectangle((x, ey, x + 92, ey + 118), fill=(13, 11, 8), outline=(91, 70, 43), width=3)
        text = items[idx] if idx < len(items) else ""
        short = text.replace("It", "").replace("_", "")[:8]
        if short:
            small = fit_text(draw, short, FONT_REG, 76, 19)
            draw.text((x + 46, ey + 58), short, anchor="mm", fill=(185, 159, 116), font=small)

    # Bottom parchment area
    parch = textured_rect((W - 126, 184), (154, 126, 83))
    card.alpha_composite(parch, (63, 1138))
    draw.rectangle((63, 1138, W - 63, 1322), outline=(73, 51, 31), width=3)
    draw.line((W // 2, 1166, W // 2, 1290), fill=(92, 66, 42), width=2)
    draw.text((250, 1188), "TALENTY", anchor="mm", fill=(30, 22, 15), font=F_HEAD)
    draw_line(draw, 1220, 118, 430)
    talent_text = f"{npc.talent}  {npc.talent_level}" if npc.talent != "—" else "—"
    talent_font = fit_text(draw, talent_text, FONT_BOLD, 330, 30)
    draw.text((118, 1264), talent_text, fill=(40, 27, 17), font=talent_font)
    draw.text((730, 1188), "TAKTYKA", anchor="mm", fill=(30, 22, 15), font=F_HEAD)
    draw_line(draw, 1220, 610, 906)
    tactic_font = fit_text(draw, npc.tactic, FONT_BOLD, 280, 32)
    draw.text((626, 1264), npc.tactic, fill=(86, 35, 25), font=tactic_font)

    # Logo
    draw.text((W // 2, 1402), "GOTHIC", anchor="mm", fill=(203, 190, 164), font=F_LOGO, stroke_width=2, stroke_fill=(33, 27, 21))

    # Final grunge overlay
    overlay = Image.effect_noise((W, H), 18).convert("L")
    card.putalpha(255)
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shade.putalpha(overlay.point(lambda p: 22 if p > 156 else 0))
    card.alpha_composite(shade)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{npc.id}.png"
    card.convert("RGB").save(out, quality=95)
    return out


def main() -> None:
    for npc_id in CARD_IDS:
        npc = parse_npc(npc_id)
        out = render_card(npc)
        print(f"{npc_id}: {npc.name} -> {out}")


if __name__ == "__main__":
    main()
