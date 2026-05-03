# MoonClocks

MoonClocks is a Pale Moon and Epyrus XUL extension that shows configurable world clocks in the status bar or toolbar.

It is based on the GPL-licensed FoxClocks 4.2.3 XUL codebase.

## Features

- World clocks in the Pale Moon / Epyrus status bar or toolbar
- Configurable watchlist and display formats
- IANA timezone database 2026b
- MoonClocks timezone database update channel
- OpenStreetMap links for locations
- Updated Pale Moon compatibility for current versions
- Added Epyrus support

## Upgrade note

MoonClocks is a separate fork and uses a different extension ID than the original FoxClocks.

Before installing MoonClocks, back up your profile and clock settings. Then uninstall the original FoxClocks extension, or any earlier FoxClocks Legacy / MoonClocks test build, restart the application, and install MoonClocks.

## Timezone database updates

MoonClocks includes a manifest-based update channel for timezone database files only. This is not an XPI/add-on update mechanism.

The bundled timezone database remains the fallback.

## MoonClocks 1.0.2

MoonClocks 1.0.2 fixes the bundled update/release information panel and performs a safe branding cleanup of the main internal install/update/help helper functions.

The old `openFoxClocks*`, `getFoxClocksVersion()` and related constants are kept as temporary compatibility aliases. Deep legacy XUL file names, CSS IDs, DTD entity names and exported module symbols are intentionally left unchanged for now.

## License

MoonClocks is based on FoxClocks 4.2.3 and is distributed under GPL-2.0-or-later.

The bundled timezone database was regenerated from the public IANA Time Zone Database.

No source files from the FoxClocks WebExtension version were used.

## Icon

The MoonClocks icon is based on the Europe icon by Icons8 and is used with attribution.

https://icons8.com/icon/APGJ1BQp3nID/europe
