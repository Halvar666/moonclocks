# MoonClocks timezone database update channel

This directory publishes the MoonClocks timezone database update channel through GitHub Pages.

This channel is only for timezone database updates. It is not an XPI/add-on update mechanism and does not use `em:updateURL` in `install.rdf`.

## Files

- `latest.json` - manifest describing the latest available MoonClocks timezone database
- `zones-YYYYx.json` - generated timezone database in the legacy FoxClocks schema 1.2 format
- `zones-YYYYx.sha256` - SHA-256 checksum for the generated database file

## Current database

`zones-2026b.json` was generated from the public IANA Time Zone Database 2026b using `tools/generate-zones-json.py`.

No source files from the FoxClocks WebExtension version were used.

## Update flow

MoonClocks may:

1. download `latest.json`
2. verify the manifest schema
3. compare the available IANA tzdb version with the local bundled version
4. download the referenced `zones-YYYYx.json`
5. verify its SHA-256 checksum and size
6. validate schema version 1.2
7. install the updated database into the user profile

The bundled database in the XPI remains the fallback.
