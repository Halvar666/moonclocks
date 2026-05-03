# MoonClocks 1.0.1

Second public MoonClocks release.

This release adds the first public MoonClocks timezone database update channel. The channel is only for timezone database files; it is not an XPI/add-on update mechanism.

## Changes since 1.0.0

- Added a manifest-based updater for the timezone database.
- Added default manifest URL: `https://halvar666.github.io/moonclocks/tzdb/latest.json`
- Added support for update manifests using schema `moonclocks-tzdb-update-1`.
- Added validation of database schema 1.2 before installing a downloaded database.
- Added SHA-256 and file-size verification for downloaded timezone database files.
- Added hidden tester override: `extensions.moonclocks.data.update.rawurl`
- Added standard manifest preference: `extensions.moonclocks.data.update.manifesturl`
- Kept automatic database updates disabled by default: `extensions.moonclocks.data.update.auto.enabled = false`
- Bundled timezone database remains IANA tzdb 2026b and remains the fallback if remote update fails.
- Updated release/source documentation for the tzdb update channel.

## Notes for this release

The bundled database and the first public update manifest both provide IANA tzdb 2026b. Therefore, a manual “Check now” should normally report that no newer database is available. A real download should only happen once the manifest offers a higher version, for example a future 2026c.

## License

MoonClocks is distributed under GPL-2.0-or-later.

The bundled timezone database was regenerated from the public IANA Time Zone Database.

No source files from the FoxClocks WebExtension version were used.
