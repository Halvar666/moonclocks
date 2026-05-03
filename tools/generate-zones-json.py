#!/usr/bin/env python3
"""
Generate FoxClocks schema 1.2 data/zones.json from the public IANA tzdb.

This is original helper code for the MoonClocks GPL fork.  It does not
use or copy files from the WebExtension version of FoxClocks.

Usage:
  mkdir -p compiled-fat
  zic -b fat -d compiled-fat africa antarctica asia australasia europe northamerica southamerica etcetera backward
  python3 tools/generate-zones-json.py /path/to/tzdb-2026b /path/to/compiled-fat /path/to/zones.json
"""

import datetime
import json
import re
import struct
import sys
from pathlib import Path

SOURCE_FILES = [
    "africa", "antarctica", "asia", "australasia", "europe",
    "northamerica", "southamerica", "etcetera", "backward",
]

SOURCE_DATE = datetime.datetime(2026, 4, 22, tzinfo=datetime.timezone.utc)
END_DATE = datetime.datetime(2028, 4, 22, tzinfo=datetime.timezone.utc)

def parse_coord(coord):
    match = re.match(r"^([+-]\d{4}(?:\d{2})?)([+-]\d{5}(?:\d{2})?)$", coord)
    if not match:
        raise ValueError("Unsupported coordinate: %s" % coord)

    def one(value, is_lat):
        sign = -1 if value[0] == "-" else 1
        digits = value[1:]
        deg_len = 2 if is_lat else 3
        degrees = int(digits[:deg_len])
        minutes = int(digits[deg_len:deg_len + 2]) if len(digits) >= deg_len + 2 else 0
        seconds = int(digits[deg_len + 2:deg_len + 4]) if len(digits) >= deg_len + 4 else 0
        return round(sign * (degrees + minutes / 60.0 + seconds / 3600.0), 5)

    return {
        "lat_decimal": one(match.group(1), True),
        "long_decimal": one(match.group(2), False),
    }

def read_zone_tab(tzdb):
    metadata = {}
    for raw in (tzdb / "zone.tab").read_text(encoding="utf-8").splitlines():
        if not raw or raw.startswith("#"):
            continue
        parts = raw.split("\t")
        if len(parts) < 3:
            continue
        country_code, coords, zone = parts[:3]
        comments = parts[3] if len(parts) >= 4 and parts[3] else ""
        item = {"country_code": country_code, "coords": parse_coord(coords)}
        if comments:
            item["comments"] = {"en": comments}
        metadata[zone] = item
    return metadata

def read_tzdb_index(tzdb):
    zones = set()
    links = {}

    for filename in SOURCE_FILES:
        for raw in (tzdb / filename).read_text(encoding="utf-8").splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line:
                continue
            parts = line.split()
            if parts[0] == "Zone" and len(parts) >= 2:
                zones.add(parts[1])
            elif parts[0] == "Link" and len(parts) >= 3:
                links[parts[2]] = parts[1]

    return zones, links

def resolve_link(name, links):
    seen = set()
    current = name
    while current in links and current not in seen:
        seen.add(current)
        current = links[current]
    return current

def parse_tzif(path):
    data = Path(path).read_bytes()

    def read_header(position):
        if data[position:position + 4] != b"TZif":
            raise ValueError("Not a TZif file: %s" % path)
        version = data[position + 4:position + 5].decode("ascii", "ignore")
        counts = struct.unpack(">6l", data[position + 20:position + 44])
        keys = ["ttisgmtcnt", "ttisstdcnt", "leapcnt", "timecnt", "typecnt", "charcnt"]
        return version, dict(zip(keys, counts)), position + 44

    def block_size(counts, time_size):
        return (
            counts["timecnt"] * time_size +
            counts["timecnt"] +
            counts["typecnt"] * 6 +
            counts["charcnt"] +
            counts["leapcnt"] * (time_size + 4) +
            counts["ttisstdcnt"] +
            counts["ttisgmtcnt"]
        )

    version, counts, position = read_header(0)
    time_size = 4

    if version in ("2", "3", "4"):
        position = position + block_size(counts, 4)
        version, counts, position = read_header(position)
        time_size = 8

    transition_count = counts["timecnt"]

    if transition_count:
        fmt = ">%dq" % transition_count if time_size == 8 else ">%dl" % transition_count
        step = 8 if time_size == 8 else 4
        transition_times = list(struct.unpack(fmt, data[position:position + step * transition_count]))
        position += step * transition_count
    else:
        transition_times = []

    transition_types = list(data[position:position + transition_count])
    position += transition_count

    ttinfos = []
    for _ in range(counts["typecnt"]):
        utoff, isdst, abbr_index = struct.unpack(">lbb", data[position:position + 6])
        position += 6
        ttinfos.append({"utoff": utoff, "isdst": bool(isdst), "abbr_index": abbr_index})

    abbreviations = data[position:position + counts["charcnt"]]

    def abbreviation_at(index):
        if index < 0 or index >= len(abbreviations):
            return ""
        end = abbreviations.find(b"\0", index)
        if end == -1:
            end = len(abbreviations)
        return abbreviations[index:end].decode("ascii", "replace")

    for info in ttinfos:
        info["abbr"] = abbreviation_at(info["abbr_index"])

    return [(transition_times[i], ttinfos[transition_types[i]]) for i in range(transition_count)], ttinfos

def build_zone_object(compiled, metadata, name):
    transitions, ttinfos = parse_tzif(compiled / name)

    source_epoch = int(SOURCE_DATE.timestamp())
    end_epoch = int(END_DATE.timestamp())

    result = {}
    if name in metadata:
        result.update(metadata[name])

    selected = []
    last_before_source = None

    for epoch, ttinfo in transitions:
        if epoch <= source_epoch:
            last_before_source = (epoch, ttinfo)
        elif epoch < end_epoch:
            selected.append((epoch, ttinfo))

    if selected:
        if last_before_source:
            selected = [last_before_source] + selected
        result["transitions"] = [
            {
                "name": ttinfo["abbr"],
                "offset_mins": int(ttinfo["utoff"] // 60),
                "is_dst": bool(ttinfo["isdst"]),
                "epoch": int(epoch * 1000),
            }
            for epoch, ttinfo in selected
        ]
    else:
        active = None
        for epoch, ttinfo in transitions:
            if epoch <= source_epoch:
                active = ttinfo
            else:
                break
        if active is None:
            active = next((item for item in ttinfos if not item["isdst"]), ttinfos[0])
        result["fixed"] = {
            "name": active["abbr"],
            "offset_mins": int(active["utoff"] // 60),
        }

    return result

def main(argv):
    if len(argv) != 4:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    tzdb = Path(argv[1])
    compiled = Path(argv[2])
    output = Path(argv[3])

    version = (tzdb / "version").read_text(encoding="utf-8").strip()
    metadata = read_zone_tab(tzdb)
    zone_names, links = read_tzdb_index(tzdb)

    compiled_names = {
        str(path.relative_to(compiled))
        for path in compiled.rglob("*")
        if path.is_file()
    }

    canonical = {name for name in zone_names if (compiled / name).exists()}
    canonical.update(name for name in compiled_names if name not in links)

    zones = {}
    for name in sorted(canonical):
        zones[name] = build_zone_object(compiled, metadata, name)

    for alias in sorted(links):
        target = resolve_link(alias, links)
        if target not in zones and target in compiled_names:
            zones[target] = build_zone_object(compiled, metadata, target)
        item = {"alias_for": target}
        if alias in metadata:
            item.update(metadata[alias])
        zones[alias] = item

    for name in sorted(compiled_names):
        if name not in zones:
            zones[name] = build_zone_object(compiled, metadata, name)

    payload = {
        "schema_version": 1.2,
        "source": {
            "id": "https://data.iana.org/time-zones/tzdb-%s/" % version,
            "name": "IANA Time Zone Database",
            "version": version,
            "date": SOURCE_DATE.strftime("%Y-%m-%d"),
        },
        "zones": zones,
    }

    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("Wrote %s zones to %s" % (len(zones), output))
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
