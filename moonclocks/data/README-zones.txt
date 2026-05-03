MoonClocks timezone database
============================

This data/zones.json file uses the legacy FoxClocks schema 1.2 format.

It is based on the public IANA Time Zone Database data path used for the
MoonClocks/FoxClocks Legacy fork. The previous generated 2026a database was
updated for the IANA tzdb 2026b data change affecting British Columbia /
America/Vancouver.

No data/zones.json file or other source file from the WebExtension version of
FoxClocks was copied into this fork.

Current bundled metadata:
- IANA release: 2026b
- Source reference: https://data.iana.org/time-zones/tzdb-2026b/
- Output schema: FoxClocks zones.json schema_version 1.2
- Notable 2026b data change included: British Columbia / America/Vancouver
  moves to permanent UTC-07 from the 2026-11-01 transition point used by
  IANA tzdb 2026b.

IANA licensing note:
The IANA tzdb source files are public domain unless otherwise noted by IANA.
