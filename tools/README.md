# MoonClocks tools

`generate-zones-json.py` regenerates `data/zones.json` from the public IANA
Time Zone Database into the legacy FoxClocks schema 1.2 format.

The generated timezone database in this XPI was built from IANA tzdb 2026b.
No source file from the WebExtension version of FoxClocks was used.

Example:

```sh
zic -b fat -d compiled-fat africa antarctica asia australasia europe northamerica southamerica etcetera backward
python3 tools/generate-zones-json.py /path/to/tzdb-2026b /path/to/compiled-fat data/zones.json
```

The `-b fat` zic option is important for this legacy XUL codebase because it
keeps upcoming transitions explicit in the TZif files.

## Fork licensing note

This helper script is distributed as part of MoonClocks under the same
GPL-2.0-or-later terms as the GPL/XUL FoxClocks 4.2.3 base, unless a file
states otherwise.
