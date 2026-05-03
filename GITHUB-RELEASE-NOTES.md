# MoonClocks 1.0.2

Third public MoonClocks release.

This is a small branding-cleanup and release-notes hotfix release. It includes the MoonClocks 1.0.1 timezone database update channel unchanged.

## Changes since 1.0.1

- Fixed the bundled update/release information panel so it shows MoonClocks 1.0.2.
- Renamed main internal helper functions from `openFoxClocks*` to `openMoonClocks*`.
- Renamed `getFoxClocksVersion()` to `getMoonClocksVersion()`.
- Added MoonClocks-named constants for the extension ID, local release-note URLs and settings extension.
- Updated call sites to use the new MoonClocks-named helpers.
- Kept the old `openFoxClocks*`, `getFoxClocksVersion()` and related constants as temporary compatibility aliases.
- Left deep legacy XUL file names, CSS IDs, DTD entity names and exported module symbols unchanged for safety.
- No timezone database change; bundled database remains IANA tzdb 2026b.

## Notes

The timezone database update channel is only for timezone database files. It is not an XPI/add-on update mechanism.

Automatic timezone database updates remain disabled by default.

## License

MoonClocks is distributed under GPL-2.0-or-later.

The bundled timezone database was regenerated from the public IANA Time Zone Database.

No source files from the FoxClocks WebExtension version were used.
