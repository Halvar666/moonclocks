LICENCE
=======
FoxClocks for Mozilla Firefox/Thunderbird.
Copyright (c) 2015 Andy McDonald. All rights reserved.

This program is free software; you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation; either version 2 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should be able to obtain a copy of the GNU General Public License from
https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt; if not, write to the
Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.

The full text of the GNU General Public License version 2 can be found in the file licence.txt.


FLAG IMAGES
===========
Most flag images in FoxClocks were created by Mark James (http://famfamfam.com/); John Crepezzi (http://seejohncode.com/),
Juan Rodas, Will (Coke) Coleda and Ed Sanders added more. The images are in the public domain.


NOTES FOR TRANSLATORS
=====================
FOXCLOCKS.DTD
A few long entity values have pipes ('|') in them - these will be treated as newlines by MoonClocks. Feel
free to move the pipes wherever you like to achieve a reasonable line length.

FOXCLOCKS.PROPERTIES
The options.format.standard.* values determine the formats available in the standard formats dropdown menu in the
options window. Feel free to add or remove any number of standard formats, but make sure the numbers at the
end of the property names are continuous and start from 0 (eg options.format.standard.0, options.format.standard.1,
options.format.standard.3 is not ok).

The options.format.custom.*.value properties determine the 'special' values that can be entered as part of a custom
format (e.g. in English, <d-s> will expand to the short form of the current day). Feel free to translate these
however you like (in French the corresponding property is <j-ab>), but make sure to use these values in the
options.format.standard.* properties and in the properties in defaults.properties.

DEFAULTS.PROPERTIES
defaults.properties contains localised default parameters. The extensions.moonclocks@halvar666.description
entry is the extension description appearing in the application's Extensions/Add-ons window. The extensions.moonclocks.format.* values
determine the default format parameters for the statusbar clock, statusbar clock tooltip etc. They also determine
the initial set-up of the drop-down menus in the options window: please make sure that the extensions.moonclocks.format.*.standard
values correspond to one of the options.format.standard.* values in foxclocks.properties; MoonClocks prepends the
location placeholder, a colon and a space ('<l>: ' in English) to standard formats when applied to the
statusbar/toolbar clocks.

ZONEPICKER.XML
Hopefully zonepicker.xml is self-explanatory. zonepicker.xml describes the *shape* of the zonepicker. NB do NOT translate
the value of the attribute zone_id (eg "Europe/London").

TESTING
Please test every window:
	main MoonClocks window
	about window
	options window
	zoneinfo window (double-click on a location in the watchlist or a zone in the zone picker)
	various alerts (import/export, etc)

OTHER
Translated files should retain the copyright notice and spacing of the originals where possible.

Thanks,
Andy McDonald


MoonClocks fork notes
=====================

MoonClocks is a Pale Moon/Epyrus XUL fork based on FoxClocks 4.2.3.

This fork is based on FoxClocks 4.2.3, licensed under GPL-2.0-or-later.
The timezone database file was regenerated from the public IANA Time Zone
Database during the MoonClocks/FoxClocks Legacy work. No source files from the
WebExtension version of FoxClocks were used.

MoonClocks uses its own version line starting at 1.0.0 and uses a different
extension ID:

moonclocks@halvar666

Before installing MoonClocks over the original FoxClocks or earlier FoxClocks
Legacy test builds, back up your profile and clock settings, uninstall the older
extension, restart the application, and install MoonClocks.

MoonClocks 1.0.0 notes:
- First public MoonClocks release.
- Renamed from the FoxClocks Legacy test builds to MoonClocks.
- Uses MoonClocks chrome namespace and preference branch.
- Supports Pale Moon and Epyrus.
- Bundles IANA tzdb 2026b metadata and the 2026b British Columbia / America/Vancouver data update.
- Uses OpenStreetMap for location links instead of the old Google Earth KML workflow.
- Includes an attributed Icons8-based MoonClocks icon.

Icon:
The MoonClocks icon is based on the Europe icon by Icons8 and is used with attribution.
https://icons8.com/icon/APGJ1BQp3nID/europe
