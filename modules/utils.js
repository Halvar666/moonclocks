/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components */

// ====================================================================================
(function(root, factory) {
	"use strict";

	let EXT_URL_MODULE_DIR = 'chrome://moonclocks-modules/content/'; // resource://moonclocks/

	let console = null;
	try
	{
		console =	(Components.utils.import("resource://gre/modules/Console.jsm", {})).console;
	}
	catch(ex)
	{
		console =	(Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console;
	}

	let NetUtil =		(Components.utils.import("resource://gre/modules/NetUtil.jsm", {})).NetUtil;
	let AddonManager =	(Components.utils.import("resource://gre/modules/AddonManager.jsm", {})).AddonManager;

	let objArray = factory(Components, console, NetUtil, AddonManager);

	root.EXPORTED_SYMBOLS = [];
	for (let i=0; i < objArray.length; i++)
	{
		let currObj = objArray[i];
		root.EXPORTED_SYMBOLS.push(currObj.name);
		root[currObj.name] = currObj.is_service === false ? currObj.constructor : new currObj.constructor();
	}

}(this,

// ====================================================================================
function(Components, console, NetUtil, AddonManager) {
	"use strict";

	// ====================================================================================
	var CI = Components.interfaces, CC = Components.classes;

	// AFM - see http://boring.youngpup.net/2005/0918015401
	//
	var _domImpl = CC["@mozilla.org/xmlextras/domparser;1"].createInstance(CI.nsIDOMParser)
			.parseFromString("<foo/>", "text/xml").implementation;

	// ====================================================================================
	function Utils()
	{
		this.FC_GUID_FIREFOX = "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}";
		this.FC_GUID_THUNDERBIRD = "{3550f703-e582-4d05-9a08-453d09bdfdc6}";
		this.FC_GUID_EPYRUS = "{29877c1d-27df-4421-9a79-382c31470151}";
		this.FC_GUID_SEAMONKEY = "{92650c4d-4b8e-4d2a-b7eb-24ecf4f6b63a}";
		this.FC_GUID_PALE_MOON = "{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}";
		this.MC_GUID_MOONCLOCKS = "moonclocks@halvar666";
		// Legacy alias kept temporarily for older internal call sites and imported profiles.
		this.FC_GUID_FOXCLOCKS = this.MC_GUID_MOONCLOCKS;
		this.FC_GUID_STATUSBAR_EXTENSIONS = ["status4evar@caligonstudios.com", "the-addon-bar@GeekInTraining-GiT"];

		this.FC_XML_DEC = '<?xml version="1.0" encoding="UTF-8"?>';
		this.FC_DEGREE_SYMBOL = "\u00b0";
		this.FC_MINUS_SYMBOL = "\u2212"; // AFM - prefer to hyphen-minus

		// MoonClocks: show bundled local notes instead of old upstream install/help pages.
		this.MC_URL_RELEASE_NOTES = 'chrome://moonclocks/content/release-notes.xhtml';
		this.MC_URL_HOME = this.MC_URL_RELEASE_NOTES;
		this.MC_URL_INSTALL = this.MC_URL_RELEASE_NOTES;
		this.MC_URL_UPDATE = this.MC_URL_RELEASE_NOTES;
		this.MC_URL_HELP = this.MC_URL_RELEASE_NOTES;
		this.MC_URL_DATABASE_UPDATE = this.MC_URL_RELEASE_NOTES;
		this.FC_URL_ICONS8_MOONCLOCKS_ICON = 'https://icons8.com/icon/APGJ1BQp3nID/europe';

		// Legacy FoxClocks URL aliases kept temporarily for older internal call sites.
		this.FC_URL_FOXCLOCKS_RELEASE_NOTES = this.MC_URL_RELEASE_NOTES;
		this.FC_URL_FOXCLOCKS_HOME = this.MC_URL_HOME;
		this.FC_URL_FOXCLOCKS_INSTALL = this.MC_URL_INSTALL;
		this.FC_URL_FOXCLOCKS_UPDATE = this.MC_URL_UPDATE;
		this.FC_URL_FOXCLOCKS_HELP = this.MC_URL_HELP;
		this.FC_URL_FOXCLOCKS_DATABASE_UPDATE = this.MC_URL_DATABASE_UPDATE;

		// MoonClocks uses its own manifest-based timezone database channel.
		// The manifest URL lives in extensions.moonclocks.data.update.manifesturl.
		// This constant is kept empty so the old FoxClocks server updater is never used.
		this.MC_URL_DATABASE_UPDATE_CHECK = '';
		this.FC_URL_DATABASE_UPDATE_CHECK = this.MC_URL_DATABASE_UPDATE_CHECK;

		this.FC_URL_CHROME_ZONEPICKER_BUILTIN = "chrome://moonclocks/locale/zonepicker.xml";
		this.FC_URL_CHROME_FLAG_IMAGES_DIR = "chrome://moonclocks/skin/flags/";

		this.FC_REGEXP_FLAGDIR_IMAGE = /\.png$/;
		this.FC_REGEXP_VALID_LATDEG = /^\d{1,2}$/;
		this.FC_REGEXP_VALID_LONGDEG = /^\d{1,3}$/;
		this.FC_REGEXP_VALID_MIN_SEC =  /^\d{1,2}$/;
		this.FC_REGEXP_VALID_STATBARPOSN_INDEX = /^\d{1,}$/;
		this.FC_REGEXP_OPTIONSFORMATSTANDARD = /^options\.format\.standard\.(\d{1,})$/;

		this.MC_SETTINGS_EXTENSION = "mcl";
		this.FC_FOXCLOCKS_SETTINGS_EXTENSION = this.MC_SETTINGS_EXTENSION; // Legacy alias.
		this.FC_FOXCLOCKS_SEARCH_MAX_OPEN_NODES = 8; // AFM - heuristic. Not worth a param

		this.console = console;

		this._flagImages = [];
	}

	// ====================================================================================
	Utils.prototype =
	{
		// ====================================================================================
		exportSymbols: function(scope, symbolsArray)
		{
			scope.EXPORTED_SYMBOLS = [];
			for (let i=0; i < symbolsArray.length; i++)
			{
				let currObj = symbolsArray[i];
				scope.EXPORTED_SYMBOLS.push(currObj.name);
				scope[currObj.name] = currObj.is_service === false ? currObj.constructor : new currObj.constructor();
			}
		},

		// ====================================================================================
		getMoonClocksVersion: function(callback)
		{
			AddonManager.getAddonByID(this.MC_GUID_MOONCLOCKS, function(addon) {
				callback(addon.version);
			});
		},

		// Legacy alias kept temporarily for code that still calls the old helper name.
		getFoxClocksVersion: function(callback)
		{
			return this.getMoonClocksVersion(callback);
		},

		// ====================================================================================
		getFlagImages: function()
		{
			if (this._flagImages.length > 0)
				return this._flagImages;

			try
			{
				var chromeFlagDirURI = CC["@mozilla.org/network/io-service;1"]
						.getService(CI.nsIIOService).newURI(this.FC_URL_CHROME_FLAG_IMAGES_DIR, null, null);

				var localFlagDirURI = CC["@mozilla.org/chrome/chrome-registry;1"]
						.getService(CI.nsIChromeRegistry)
						.convertChromeURL(chromeFlagDirURI);

				if (localFlagDirURI.scheme === "file" || localFlagDirURI.scheme === "resource")
				{
					var flagUrlSpec = null;

					if (localFlagDirURI.scheme === "file")
					{
						flagUrlSpec = localFlagDirURI.spec;
					}
					else
					{
						flagUrlSpec = CC["@mozilla.org/network/protocol;1?name=resource"]
								.getService(CI.nsIResProtocolHandler)
								.resolveURI(localFlagDirURI);
					}

					var flagDirFile = CC["@mozilla.org/network/protocol;1?name=file"]
							.getService(CI.nsIFileProtocolHandler)
							.getFileFromURLSpec(flagUrlSpec);

					var flagDirFileEnumerator = flagDirFile.directoryEntries;
					while (flagDirFileEnumerator.hasMoreElements())
					{
						var currFileName = flagDirFileEnumerator.getNext().QueryInterface(CI.nsIFile).leafName;

						if (this.FC_REGEXP_FLAGDIR_IMAGE.test(currFileName))
							this._flagImages.push(currFileName);
					}
				}
				else if (localFlagDirURI.scheme === "jar")
				{
					var zr = CC["@mozilla.org/libjar/zip-reader;1"].createInstance(CI.nsIZipReader);

					try
					{
						localFlagDirURI.QueryInterface(CI.nsIJARURI);
						zr.open(localFlagDirURI.JARFile.QueryInterface(CI.nsIFileURL).file);

						var entries = zr.findEntries('*');

						while (entries.hasMore())
					    {
							var currZipFileName = entries.getNext().substring(localFlagDirURI.JAREntry.length);

							if (this.FC_REGEXP_FLAGDIR_IMAGE.test(currZipFileName))
								this._flagImages.push(currZipFileName);
						}
					}
					catch (ex)
					{
						console.error("foxclocks.Utils::getFlagImages(): flag load failed", ex);
					}
					finally
					{
						zr.close();
					}
				}
				else
				{
					throw "Unknown URI scheme '" + localFlagDirURI.scheme + "'";
				}

				this._flagImages.sort();
			}
			catch (ex)
			{
				console.error("foxclocks.Utils::getFlagImages(): flag load failed", ex);
			}

			return this._flagImages;
		},

		// ====================================================================================
		getAppLocale: function()
		{
			// AFM - don't use nsILocaleService.getApplicationLocale()
			//
			var appLocale = CC["@mozilla.org/preferences-service;1"].getService(CI.nsIPrefBranch).getCharPref("general.useragent.locale");
			var appLocaleArray = appLocale.split('-');

			return {major: appLocaleArray[0], minor: (appLocaleArray.length > 1 ? appLocaleArray[1] : null), string: appLocale};
		},

		// ====================================================================================
		getFirstEltByTagAsNode: function(node, tag)
		{
			var elts = node.getElementsByTagName(tag);

			return elts.length !== 0 ? elts.item(0).QueryInterface(CI.nsIDOMElement) : null;
		},

		// ====================================================================================
		writeToFile: function(data, file, callback)
		{
			var unicodeConverter = CC["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(CI.nsIScriptableUnicodeConverter);
			unicodeConverter.charset = 'UTF-8';
			var inStream = unicodeConverter.convertToInputStream(data);

			var outStream = CC["@mozilla.org/network/file-output-stream;1"].createInstance(CI.nsIFileOutputStream);
			outStream.init(file, -1, -1, 0);

			NetUtil.asyncCopy(inStream, outStream, function(result) {
				inStream.close();
				outStream.close();
				callback(result, Components.isSuccessCode(result));
			});
		},

		// ====================================================================================
		isHttpsUrl: function(url)
		{
			return typeof(url) === 'string' && /^https:\/\//i.test(url);
		},

		// ====================================================================================
		sha256String: function(data)
		{
			var unicodeConverter = CC["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(CI.nsIScriptableUnicodeConverter);
			unicodeConverter.charset = 'UTF-8';

			var result = {};
			var bytes = unicodeConverter.convertToByteArray(data, result);

			var hash = CC["@mozilla.org/security/hash;1"].createInstance(CI.nsICryptoHash);
			hash.init(hash.SHA256);
			hash.update(bytes, bytes.length);

			var binaryHash = hash.finish(false);
			var hex = "";
			for (var i=0; i < binaryHash.length; i++)
			{
				var charHex = binaryHash.charCodeAt(i).toString(16);
				if (charHex.length < 2)
					charHex = "0" + charHex;
				hex += charHex;
			}

			return hex;
		},

		// ====================================================================================
		compareTzdbVersions: function(a, b)
		{
			if (a === b)
				return 0;

			var parse = function(v)
			{
				if (typeof(v) !== 'string')
					v = String(v);

				var match = v.match(/^(\d{4})([a-z]+)$/);
				if (match === null)
					return null;

				return { year: parseInt(match[1], 10), suffix: match[2] };
			};

			var parsedA = parse(a);
			var parsedB = parse(b);

			if (parsedA !== null && parsedB !== null)
			{
				if (parsedA.year !== parsedB.year)
					return parsedA.year > parsedB.year ? 1 : -1;

				if (parsedA.suffix !== parsedB.suffix)
					return parsedA.suffix > parsedB.suffix ? 1 : -1;

				return 0;
			}

			return String(a) > String(b) ? 1 : -1;
		},

		// ====================================================================================
		openOpenStreetMap : function(location)
		{
			console.log("+foxclocks.Utils::openOpenStreetMap()");

			if (!location || location.getLatitude() === null || location.getLongitude() === null)
			{
				console.error("foxclocks.Utils::openOpenStreetMap(): location has no coordinates");
				return;
			}

			var latitude = location.getLatitude();
			var longitude = location.getLongitude();
			var zoom = 8;
			var url = "https://www.openstreetmap.org/?mlat=" + encodeURIComponent(latitude) +
				"&mlon=" + encodeURIComponent(longitude) +
				"#map=" + zoom + "/" + encodeURIComponent(latitude) + "/" + encodeURIComponent(longitude);

			this._openURL(url, true);
			console.log("-foxclocks.Utils::openOpenStreetMap()");
		},

		// Legacy wrapper: old command IDs may still use the historical Google Earth name.
		openGoogleEarth : function(location)
		{
			this.openOpenStreetMap(location);
		},
		// ====================================================================================
		getAppInfo: function()
		{
			var appInfo = CC["@mozilla.org/xre/app-info;1"].getService(CI.nsIXULAppInfo);

			var retVal = {appVersion: appInfo.version};

			if (appInfo.ID === this.FC_GUID_FIREFOX)
				retVal.appName = "Firefox";
			else if (appInfo.ID === this.FC_GUID_THUNDERBIRD || appInfo.ID === this.FC_GUID_EPYRUS)
				retVal.appName = "Thunderbird";
			else if (appInfo.ID === this.FC_GUID_SEAMONKEY)
				retVal.appName = "SeaMonkey";
			else if (appInfo.ID === this.FC_GUID_PALE_MOON)
				retVal.appName = "Pale Moon";
			else
				retVal.appName = "";

			return retVal;
		},

		// ====================================================================================
		openChromeWindow : function(url, internalName, displayFlags)
		{
			try
			{
				var mediatorService = CC["@mozilla.org/appshell/window-mediator;1"].getService(CI.nsIWindowMediator);
				var enumerator = mediatorService.getEnumerator(null);
				while (enumerator.hasMoreElements())
				{
					var currWindow = enumerator.getNext();
					currWindow = currWindow.QueryInterface(CI.nsIDOMWindow);

					if (url === currWindow.location.href) // rhs is chrome:// URL
					{
						currWindow.focus();
						return currWindow;
					}
				}
			}
			catch (ex) { /* do nothing */ }

			CC["@mozilla.org/embedcomp/window-watcher;1"].getService(CI.nsIWindowWatcher).openWindow(null, url, internalName, displayFlags, null);
		},

		// ====================================================================================
		_openURL: function(url, disableBlankReuse)
		{
			try
			{
				var mediatorService = CC["@mozilla.org/appshell/window-mediator;1"].getService(CI.nsIWindowMediator);
				var protocolSvc = CC["@mozilla.org/uriloader/external-protocol-service;1"].getService(CI.nsIExternalProtocolService);
				var nsURI = CC["@mozilla.org/network/io-service;1"].getService(CI.nsIIOService).newURI(url, null, null);

				var appInfo = this.getAppInfo();

				if (appInfo.appName === 'Thunderbird')
				{
					mediatorService.getMostRecentWindow("mail:3pane").document.getElementById("tabmail").openTab("contentTab", {contentPage: url});
				}
				else if (!protocolSvc.isExposedProtocol(nsURI.scheme))
				{
					// AFM - if we're not a browser, use the external protocol service to load the URI
					// This can silently fail in some circumstances.
					// isExposedProtocol() returns true for Thunderbird 3+, but getMostRecentWindow() doesn't
					// return a window
					//
					protocolSvc.loadUrl(nsURI);
				}
				else
				{
					var mrBrowserWindow = mediatorService.getMostRecentWindow("navigator:browser");

					if (mrBrowserWindow !== null)
					{
						var browser = mrBrowserWindow.getBrowser();
						var loc = browser.currentURI.spec;

						// console.log("foxclocks.Utils::_openURL(): url, loc", url, loc, browser.currentURI);

						if ((loc === "about:home" || loc === "about:blank" || loc === "about:newtab") && (typeof(disableBlankReuse) !== 'boolean' || disableBlankReuse === false))
						{
							browser.loadURI(url);
						}
						else if (loc !== url) // would like to do this ignoring protocol
						{
							// AFM - could cycle through the tabs looking for the url, I suppose
							// See https://developer.mozilla.org/en/Code_snippets/Tabbed_browser
							//

							browser.selectedTab = browser.addTab(url);
						}

						mrBrowserWindow.focus();
					}
					else
					{
						var mrWindow = mediatorService.getMostRecentWindow(null);
						mrWindow.open(url, "", "");
					}
				}
			}
			catch(ex)
			{
				console.error("foxclocks.Utils::_openURL(): " + ex);
			}
		},


		// ====================================================================================
		_openBrowserTab: function(url, disableBlankReuse)
		{
			try
			{
				var mediatorService = CC["@mozilla.org/appshell/window-mediator;1"].getService(CI.nsIWindowMediator);
				var mrBrowserWindow = mediatorService.getMostRecentWindow("navigator:browser");

				if (mrBrowserWindow !== null)
				{
					var browser = mrBrowserWindow.getBrowser();
					var loc = browser.currentURI.spec;

					if ((loc === "about:home" || loc === "about:blank" || loc === "about:newtab") && (typeof(disableBlankReuse) !== 'boolean' || disableBlankReuse === false))
					{
						browser.loadURI(url);
					}
					else if (loc !== url)
					{
						browser.selectedTab = browser.addTab(url);
					}

					mrBrowserWindow.focus();
				}
				else
				{
					this.openChromeWindow(url, "", "chrome,centerscreen,resizable=yes");
				}
			}
			catch(ex)
			{
				console.error("foxclocks.Utils::_openBrowserTab(): " + ex);
			}
		},

		// ====================================================================================
		isUriAvailable : function(uriString)
		{
			// AFM - essentially intended to check whether file:// or chrome:// flag images exist
			// - may not be appropriate outside this scope
			//

			if (uriString === '')
				return false;

			var available = false;
			var stream = null;

			try
			{
				var ioService = CC["@mozilla.org/network/io-service;1"].getService(CI.nsIIOService);
				var uri = ioService.newURI(uriString, null, null);

				// AFM - if the uri does not exist: the open() fails for jarred chrome,
				// otherwise available() fails
				//
				stream = ioService.newChannelFromURI(uri).open();
				available = stream.available() > 0;
			}
			catch (ex)
			{
				console.log("foxclocks.Utils::isUriAvailable(): exception on URI <" + uriString + ">", ex);
			}

			if (stream !== null)
				stream.close();

			return available;
		},

		// ====================================================================================
		getZoneOffsetString: function(offsetMins)
		{
			var hrs = Math.floor(Math.abs(offsetMins)/60);
			var mins = Math.abs(offsetMins)%60;

			return (offsetMins < 0 ? "-" : "+") + (hrs < 10 ? "0" + hrs : hrs) + ":" + (mins < 10 ? "0" + mins : mins);
		},

		// ====================================================================================
		openChromeSimpleInfo: function(owningWindow, title, message) { owningWindow.openDialog("chrome://moonclocks/content/simpleinfo.xul", "", "chrome,modal,centerscreen,resizable=no", title, message); },
		openChromeMoonClocks: function() { this.openChromeWindow("chrome://moonclocks/content/foxclocks.xul", "", "chrome,centerscreen,resizable=yes"); },
		openChromeOptions: function() { this.openChromeWindow("chrome://moonclocks/content/options.xul", "", "chrome,centerscreen,resizable=yes"); },
		openChromeAbout: function() { this.openChromeWindow("chrome://moonclocks/content/about.xul", "", "chrome,modal,centerscreen,resizable=no"); },
		openMoonClocksHome: function() { this._openURL(this.MC_URL_HOME); },
		openMoonClocksReleaseNotes: function() { this._openBrowserTab(this.MC_URL_RELEASE_NOTES, true); },
		openMoonClocksHelp: function() { this.openMoonClocksReleaseNotes(); },
		// MoonClocks: replace old upstream install/update web pages with bundled local release notes.
		openMoonClocksInstall: function(version) { this.openMoonClocksReleaseNotes(); },
		openMoonClocksUpdate: function(version, prevRunVersion) { this.openMoonClocksReleaseNotes(); },
		openMoonClocksDbUpdate: function(){ this._openURL(this.MC_URL_DATABASE_UPDATE); },

		// Legacy aliases kept temporarily while the deep XUL file/ID cleanup remains out of scope.
		openChromeFoxClocks: function() { return this.openChromeMoonClocks(); },
		openFoxClocksHome: function() { return this.openMoonClocksHome(); },
		openFoxClocksReleaseNotes: function() { return this.openMoonClocksReleaseNotes(); },
		openFoxClocksHelp: function() { return this.openMoonClocksHelp(); },
		openFoxClocksInstall: function(version) { return this.openMoonClocksInstall(version); },
		openFoxClocksUpdate: function(version, prevRunVersion) { return this.openMoonClocksUpdate(version, prevRunVersion); },
		openFoxClocksDbUpdate: function(){ return this.openMoonClocksDbUpdate(); },
		openIcons8MoonClocksIcon: function(){ this._openURL(this.FC_URL_ICONS8_MOONCLOCKS_ICON, true); },
		as12hr: function(i) { return (i === 0 || i === 12) ? "12" : i % 12; },
		asTwoDigit: function(i) { return (i > 9) ? i : "0" + i; },
		asThreeDigit: function(i) { return i < 10 ? '00' + i : (i < 100 ? '0' + i : i); },
		getDOMImpl: function() { return _domImpl; }
	};

	// ====================================================================================
	return [{name: 'FoxClocks_Utils', constructor: Utils, is_service: true}];

}));