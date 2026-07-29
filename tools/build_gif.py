#!/usr/bin/env python3
"""Render the pixel-π mascot routines into a looping demo.gif — no dependencies.

Ports the mascot frame logic from extensions/pi-mascot.ts and writes an
animated GIF89a (own LZW encoder) so it renders anywhere without Pillow/ffmpeg.
"""
import struct

W, H, SCALE = 14, 10, 14
BG = (20, 13, 36)
COLORS = {
    ".": BG, "B": (46, 127, 255), "b": (31, 111, 255), "E": (244, 239, 255),
    "P": (10, 16, 48), "C": (0, 234, 255), "O": (235, 150, 60), "N": (255, 47, 176),
    "G": (43, 255, 136), "Y": (255, 207, 58), "V": (178, 107, 255), "W": (170, 180, 200),
}
KEYS = list(COLORS)                 # index 0 == "." == background
IDX = {k: i for i, k in enumerate(KEYS)}


def frame(p):
    g = [["." for _ in range(W)] for _ in range(H)]
    ox, oy = p.get("ox", 0), p.get("oy", 0)

    def b(x0, x1, y0, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                xx, yy = x + ox, y + oy
                if 0 <= yy < H and 0 <= xx < W:
                    g[yy][xx] = ch

    def s(x, y, ch):
        if 0 <= y < H and 0 <= x < W:
            g[y][x] = ch

    # arms
    if p.get("armL") == "up": b(1, 2, 0, 1, "b")
    else: b(1, 1, 2, 4, "b")
    if p.get("armR") == "up": b(11, 12, 0, 1, "b")
    elif p.get("armR") == "mid": b(11, 12, 2, 3, "b")
    else: b(12, 12, 2, 4, "b")
    b(2, 11, 1, 4, "B")  # bar
    # eyes
    if p.get("blink"):
        b(4, 6, 3, 3, "P"); b(8, 10, 3, 3, "P")
    else:
        b(4, 6, 2, 3, "E"); b(8, 10, 2, 3, "E")
        dx = p.get("look", 0)
        b(5 + dx, 5 + dx, 2, 3, "P"); b(9 + dx, 9 + dx, 2, 3, "P")
    # mouth
    if p.get("smile"): b(5, 8, 4, 4, "P")
    else: b(6, 7, 4, 4, "P")
    # legs + foot
    b(4, 5, 5, 8, "b"); b(8, 9, 5, 8, "b")
    if p.get("step") == 1: b(3, 5, 7, 8, "b")
    else: b(8, 11, 7, 8, "b")
    # props
    if "ball" in p: b(11, 12, p["ball"], p["ball"] + 1, "O")
    if p.get("think"): s(12, 1, "C"); s(13, 0, "C")
    if "confetti" in p:
        sets = [
            [(2, 0, "N"), (5, 0, "Y"), (9, 1, "C"), (12, 0, "V")],
            [(3, 1, "G"), (6, 0, "N"), (10, 0, "Y"), (12, 1, "C")],
            [(2, 1, "V"), (5, 1, "C"), (8, 0, "N"), (11, 0, "G")],
            [(4, 0, "Y"), (7, 1, "V"), (9, 0, "G"), (12, 0, "N")],
        ][p["confetti"] % 4]
        for x, y, ch in sets: s(x, y, ch)
    if p.get("lift"):
        row = 0 if p["lift"] == "up" else 1 if p["lift"] == "mid" else 5
        b(2, 3, row, row, "W"); b(10, 11, row, row, "W"); b(4, 9, row, row, "C")
        if p["lift"] == "up": b(1, 2, 0, 1, "b"); b(11, 12, 0, 1, "b")
        elif p["lift"] == "mid": b(1, 1, 1, 2, "b"); b(12, 12, 1, 2, "b")
    if "flag" in p:
        b(11, 12, 0, 1, "b"); b(12, 12, 0, 4, "W")
        shapes = [
            [(13, 0, "N"), (13, 1, "N")],
            [(13, 0, "N"), (12, 1, "N"), (13, 2, "Y")],
            [(13, 1, "N"), (13, 2, "Y")],
        ][p["flag"] % 3]
        for x, y, ch in shapes: s(x, y, ch)
    if "zzz" in p:
        pts = [[(11, 1)], [(11, 1), (12, 0)], [(12, 0), (13, 0)]][p["zzz"] % 3]
        for x, y in pts: s(x, y, "C")
    return g


ROUTINES = {
    "walk": [{"step": 0, "ox": -1}, {"step": 1, "oy": -1}, {"step": 0, "ox": 1}, {"step": 1, "oy": -1}],
    "dance": [{"ox": -1, "armL": "up", "smile": True}, {"smile": True}, {"ox": 1, "armR": "up", "smile": True}, {"smile": True}],
    "gym": [{"lift": "down"}, {"lift": "mid"}, {"lift": "up", "smile": True}, {"lift": "up", "smile": True}, {"lift": "mid"}],
    "dribble": [{"ball": 5, "armR": "mid"}, {"ball": 7, "armR": "mid"}, {"ball": 8, "armR": "down"}, {"ball": 7, "armR": "mid"}],
    "flag": [{"flag": 0}, {"flag": 1}, {"flag": 2}, {"flag": 1}],
    "confetti": [{"confetti": 0, "armL": "up", "armR": "up", "smile": True}, {"confetti": 1, "smile": True}, {"confetti": 2, "armL": "up", "armR": "up", "smile": True}, {"confetti": 3, "smile": True}],
    "wave": [{"armR": "up", "smile": True}, {"armR": "mid", "smile": True}, {"armR": "up", "smile": True}, {"armR": "mid", "smile": True}],
    "jump": [{"oy": 0, "smile": True}, {"oy": -2, "armL": "up", "armR": "up", "smile": True}, {"oy": -3, "armL": "up", "armR": "up", "smile": True}, {"oy": -1, "smile": True}],
    "think": [{"think": True}, {"think": True, "look": 1}, {"think": True}, {"think": True, "blink": True}],
    "cheer": [{"armL": "up", "armR": "up", "smile": True}, {"smile": True}, {"armL": "up", "armR": "up", "smile": True}, {"blink": True, "smile": True}],
    "sleep": [{"zzz": 0, "blink": True}, {"zzz": 1, "blink": True}, {"zzz": 2, "blink": True}, {"zzz": 1, "blink": True}],
    "spin": [{"look": -1}, {"look": 0}, {"look": 1}, {"look": 0, "blink": True}],
}
ORDER = ["walk", "dance", "gym", "dribble", "flag", "confetti", "wave", "jump", "think", "cheer", "sleep", "spin"]


def to_pixels(grid):
    """grid(HxW chars) -> scaled index buffer (bytes), width, height."""
    out = bytearray()
    for row in grid:
        line = bytes(IDX[c] for c in row)
        big = bytes(b for c in line for b in (c,) * SCALE)
        for _ in range(SCALE):
            out += big
    return bytes(out), W * SCALE, H * SCALE


# ── minimal GIF89a + LZW encoder ─────────────────────────────────────────────
def lzw_encode(indices, min_code_size):
    clear, end = 1 << min_code_size, (1 << min_code_size) + 1
    code_size = min_code_size + 1
    table = {bytes([i]): i for i in range(1 << min_code_size)}
    next_code = end + 1
    out, cur, nbits = bytearray(), 0, 0

    def emit(code):
        nonlocal cur, nbits
        cur |= code << nbits
        nbits += code_size
        while nbits >= 8:
            out.append(cur & 0xFF); cur >>= 8; nbits -= 8

    emit(clear)
    w = bytes([indices[0]])
    for k in indices[1:]:
        wk = w + bytes([k])
        if wk in table:
            w = wk
        else:
            emit(table[w])
            table[wk] = next_code; next_code += 1
            if next_code == (1 << code_size) and code_size < 12:
                code_size += 1
            if next_code > 4095:
                emit(clear)
                table = {bytes([i]): i for i in range(1 << min_code_size)}
                next_code = end + 1; code_size = min_code_size + 1
            w = bytes([k])
    emit(table[w]); emit(end)
    if nbits > 0:
        out.append(cur & 0xFF)
    return bytes(out)


def block(data):
    out = bytearray()
    for i in range(0, len(data), 255):
        chunk = data[i:i + 255]
        out.append(len(chunk)); out += chunk
    out.append(0)
    return bytes(out)


def write_gif(path, frames, width, height, delay_cs=15):
    # palette padded to 16 colors (min code size 4)
    pal = bytearray()
    for k in KEYS:
        pal += bytes(COLORS[k])
    while len(pal) < 16 * 3:
        pal += b"\x00\x00\x00"
    with open(path, "wb") as f:
        f.write(b"GIF89a")
        f.write(struct.pack("<HH", width, height))
        f.write(bytes([0xF3, 0, 0]))  # global color table, 16 entries
        f.write(pal)
        f.write(b"\x21\xFF\x0B" + b"NETSCAPE2.0" + b"\x03\x01\x00\x00\x00")  # loop forever
        for buf in frames:
            f.write(b"\x21\xF9\x04\x00" + struct.pack("<H", delay_cs) + b"\x00\x00")
            f.write(b"\x2C" + struct.pack("<HHHH", 0, 0, width, height) + b"\x00")
            f.write(bytes([4]))
            f.write(block(lzw_encode(buf, 4)))
        f.write(b"\x3B")


def main():
    frames, w, h = [], 0, 0
    for name in ORDER:
        for _ in range(2):  # two loops per routine so each reads clearly
            for pose in ROUTINES[name]:
                buf, w, h = to_pixels(frame(pose))
                frames.append(buf)
    write_gif("demo.gif", frames, w, h, delay_cs=14)
    print(f"wrote demo.gif  {w}x{h}  {len(frames)} frames")


if __name__ == "__main__":
    main()
