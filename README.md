# MoonClocks

MoonClocks is a Pale Moon and Epyrus XUL extension that shows configurable world clocks in the status bar.

It is based on the GPL-licensed FoxClocks 4.2.3 XUL codebase.

## Features

- World clocks in the Pale Moon and Epyrus status bar
- Configurable watchlist and display formats
- IANA timezone database 2026b metadata and the 2026b British Columbia / America/Vancouver update
- OpenStreetMap links for locations
- Pale Moon and Epyrus support

## Compatibility

MoonClocks targets:

- Pale Moon 27.0 to 34.*
- Epyrus 2.0 to 2.*

## Upgrade note

MoonClocks is a separate fork and uses a different extension ID than the original FoxClocks.

Before installing MoonClocks, uninstall the original FoxClocks extension or earlier FoxClocks Legacy test builds, restart the application, and then install MoonClocks.

## Timezone database

The bundled `data/zones.json` file uses the legacy FoxClocks schema 1.2 format.

The timezone data was regenerated from the public IANA Time Zone Database during the MoonClocks/FoxClocks Legacy work. The current 1.0.0 build carries IANA tzdb 2026b metadata and includes the 2026b British Columbia / America/Vancouver change.

No source files from the FoxClocks WebExtension version were used.

Future timezone database updates are intended to be served through the MoonClocks tzdb update channel under `docs/tzdb/`. This is only for timezone database data; it is not an XPI/add-on update mechanism and does not require `em:updateURL` in `install.rdf`.

## License

MoonClocks is based on FoxClocks 4.2.3 and is distributed under GPL-2.0-or-later.

The original FoxClocks copyright and GPL license text are preserved in `readme.txt` and `licence.txt`. A standard repository-level `COPYING` file is also provided.

## Icon

The MoonClocks icon is based on the Europe icon by Icons8 and is used with attribution.

https://icons8.com/icon/APGJ1BQp3nID/europe

## Repository layout

- `chrome/` - XUL windows, overlays, locale files, and skin assets
- `modules/` - MoonClocks runtime modules
- `data/zones.json` - bundled timezone database in legacy FoxClocks schema 1.2
- `defaults/preferences/` - default preferences
- `tools/` - timezone database generation tooling
- `docs/tzdb/` - planned static timezone database update channel
