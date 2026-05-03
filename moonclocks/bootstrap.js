/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ---------------------------------------------------------
/*global APP_STARTUP, APP_SHUTDOWN, ADDON_ENABLE, ADDON_DISABLE, ADDON_INSTALL, ADDON_UNINSTALL, ADDON_UPGRADE, ADDON_DOWNGRADE, Components */

// ---------------------------------------------------------
(function(root, factory) {
	"use strict";

	let extension_config = {
		EXT_HANDLE: 'moonclocks',
		EXT_URL_CHROME_CONTENT_DIR: 'chrome://moonclocks/content/',
		EXT_URL_MODULE_DIR: 'chrome://moonclocks-modules/content/', // resource://moonclocks/
		EXT_URL_DEFAULTS: 'chrome://moonclocks-defaults/content/preferences/moonclocks-defaults.js', // resource://moonclocks-defaults/preferences/moonclocks-defaults.js
		EXT_MAIN_MODULE_NAME: 'engine.js',
		EXT_MAIN_MODULE_EXPORTS: 'FoxClocks_Engine',

		EXT_MANIFEST: {

			'{29877c1d-27df-4421-9a79-382c31470151}': { // Epyrus
				overlay:	{   'chrome://messenger/content/messenger.xul': 'chrome://moonclocks/content/foxclocksoverlay.xul',
								'chrome://messenger/content/messengercompose/messengercompose.xul': 'chrome://moonclocks/content/foxclocksoverlay.xul' },

				stylesheets:{ 	'chrome://global/content/customizeToolbar.xul': ['chrome://moonclocks/skin/foxclocks.css'] }
			},

			'{8de7fcbb-c55c-4fbe-bfc5-fc555c87dbc4}': { // Pale Moon
				overlay:	{   'chrome://browser/content/browser.xul': 'chrome://moonclocks/content/foxclocksoverlay.xul' },

				stylesheets:{ 	'chrome://global/content/customizeToolbar.xul': ['chrome://moonclocks/skin/foxclocks.css'] }
			}
		}
	};

	let constants = {};
	constants[APP_STARTUP] = 'APP_STARTUP';
	constants[APP_SHUTDOWN] = 'APP_SHUTDOWN';
	constants[ADDON_ENABLE] = 'ADDON_ENABLE';
	constants[ADDON_DISABLE] = 'ADDON_DISABLE';
	constants[ADDON_INSTALL] = 'ADDON_INSTALL';
	constants[ADDON_UNINSTALL] = 'ADDON_UNINSTALL';
	constants[ADDON_UPGRADE] = 'ADDON_UPGRADE';
	constants[ADDON_DOWNGRADE] = 'ADDON_DOWNGRADE';

	let Services =	(Components.utils.import("resource://gre/modules/Services.jsm", {})).Services;
	// let OS =		(Components.utils.import("resource://gre/modules/osfile.jsm", {})).OS;

	let console = null;
	try
	{
		console =	(Components.utils.import("resource://gre/modules/Console.jsm", {})).console;
	}
	catch(ex)
	{
		console =	(Components.utils.import("resource://gre/modules/devtools/Console.jsm", {})).console;
	}

	let objs = factory(Components, Services, /* OS, */ console, constants, extension_config);
	let objKeys = Object.keys(objs);

	for (let i=0; i < objKeys.length; i++)
	{
		root[objKeys[i]] = objs[objKeys[i]];
	}

}(this,

// ---------------------------------------------------------
function(Components, Services, /* OS, */ console, constants, extension_config) {
	"use strict";

	// ---------------------------------------------------------
	let _extension = null;
    let _styleSheetService = Components.classes["@mozilla.org/content/style-sheet-service;1"].getService(Components.interfaces.nsIStyleSheetService);

	// ---------------------------------------------------------
	let _sendMessage = function(window, messageType)
	{
		let event = null;

		if (typeof(Event) === 'function')
		{
			event = new Event(messageType + "." + extension_config.EXT_HANDLE);
		}
		else
		{
			// Legacy - Pale Moon only
			//
			event = window.document.createEvent('Event');
			event.initEvent(messageType + "." + extension_config.EXT_HANDLE, true, true);
		}

		window.dispatchEvent(event);
		console.log(extension_config.EXT_HANDLE + ".bootstrap._sendMessage(): sent", messageType, window.location.href);
	};

	// ---------------------------------------------------------
	let _loadIntoWindow = function(window)
	{
		_sendMessage(window, 'startup');

		let appManifest = extension_config.EXT_MANIFEST[Services.appinfo.ID];
		if (typeof(appManifest) === 'undefined')
		{
			console.error(extension_config.EXT_HANDLE + ".bootstrap._loadIntoWindow(): no manifest for application", Services.appinfo);
			return;
		}

		if (typeof(appManifest.overlay) !== 'undefined' && appManifest.overlay.hasOwnProperty(window.location.href))
		{
			console.log(extension_config.EXT_HANDLE + ".bootstrap._loadIntoWindow(): loading overlay");

			let windowOverlay = appManifest.overlay[window.location.href];
			window.document.loadOverlay(windowOverlay, { observe: function(aSubject, aTopic, aData) {

				// xul-overlay-merged is fired before scripts in overlay are run, so they never catch it. At the point the scripts run, the overlaid elements
				// don't exist in the DOM, even if the script tags are placed at the end of the overlay. Seems like a bug, unless there's some 'correct' event.
				// Workaround is to use MutationObserver to send the overlayready.EXT_HANDLE event at a useful time for the overlay script. The convention
				// is that the overlay should give the last element in the file the class overlay-loaded
				//
				if (window.document.querySelector(".overlay-loaded") !== null)
				{
					// Doesn't currently happen, but might, on xul-overlay-merged event 'fix'
					//
					console.log(extension_config.EXT_HANDLE + ".bootstrap._loadIntoWindow(): got xul-overlay-merged - overlay-loaded immediately exists");
					_sendMessage(window, 'overlayready');
				}
				else
				{
					console.log(extension_config.EXT_HANDLE + ".bootstrap._loadIntoWindow(): got xul-overlay-merged - waiting for overlay-loaded");

					let overlayLoadedObserver = new window.MutationObserver(function(mutations) {

						if (window.document.querySelector(".overlay-loaded") === null)
							return;

						console.log(extension_config.EXT_HANDLE + ".bootstrap._loadIntoWindow(): overlay-loaded exists after mutation");
						_sendMessage(window, 'overlayready');
						overlayLoadedObserver.disconnect();
					});

					overlayLoadedObserver.observe(window.document.documentElement, { childList: true} );
				}
			}});
		}

		if (typeof(appManifest.stylesheets) !== 'undefined' && appManifest.stylesheets.hasOwnProperty(window.location.href))
		{
			let windowStylesheets = appManifest.stylesheets[window.location.href];

			for (let i = 0; i < windowStylesheets.length; i++)
			{
				let styleSheetURI = Services.io.newURI(windowStylesheets[i], null, null);
				_styleSheetService.loadAndRegisterSheet(styleSheetURI, _styleSheetService.AUTHOR_SHEET);
			}
		}
	};

	// ---------------------------------------------------------
	let _unloadFromWindow = function(window)
	{
		console.log("+" + extension_config.EXT_HANDLE + ".bootstrap._unloadFromWindow():", window.location.href);

		_sendMessage(window, 'shutdown');

		let appManifest = extension_config.EXT_MANIFEST[Services.appinfo.ID];
		if (typeof(appManifest) === 'undefined')
		{
			console.error(extension_config.EXT_HANDLE + ".bootstrap._unloadFromWindow(): no manifest for application", Services.appinfo);
			return;
		}

		if (typeof(appManifest.overlay) !== 'undefined' && appManifest.overlay.hasOwnProperty(window.location.href))
		{
			let windowOverlay = appManifest.overlay[window.location.href];

			// No window.document.unloadOverlay() - https://bugzilla.mozilla.org/show_bug.cgi?id=607384
			//
			let unloadables = window.document.querySelectorAll(".overlay-unloadable");

			for (let i = 0; i < unloadables.length; i++)
			{
				let unloadable = unloadables[i];
				unloadable.parentNode.removeChild(unloadable);
			}
		}

		if (typeof(appManifest.stylesheets) !== 'undefined' && appManifest.stylesheets.hasOwnProperty(window.location.href))
		{
			let windowStylesheets = appManifest.stylesheets[window.location.href];

			for (let i = 0; i < windowStylesheets.length; i++)
			{
				let styleSheetURI = Services.io.newURI(windowStylesheets[i], null, null);

				if (_styleSheetService.sheetRegistered(styleSheetURI, _styleSheetService.AUTHOR_SHEET))
					_styleSheetService.unregisterSheet(styleSheetURI, _styleSheetService.AUTHOR_SHEET);
			}
		}

		console.log("-" + extension_config.EXT_HANDLE + ".bootstrap._unloadFromWindow():", window.location.href);
	};

	// ---------------------------------------------------------
	let _forEachOpenWindow = function(todo)
	{
		let windows = Services.wm.getEnumerator(null);

		while (windows.hasMoreElements())
			todo(windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindow));
	};

	// ---------------------------------------------------------
	let _windowListener =
	{
		onOpenWindow: function(xulWindow)
		{
			let window = xulWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindow);

			let onWindowLoad = function() {
				console.log(extension_config.EXT_HANDLE + ".bootstrap._windowListener(): got window load", window.location.href);

				window.removeEventListener("load", onWindowLoad);
				_loadIntoWindow(window);
			};

			window.addEventListener("load", onWindowLoad);
		},

		onCloseWindow: function(xulWindow) { },
		onWindowTitleChange: function(xulWindow, newTitle) { }
	};

	// ---------------------------------------------------------
	let _copyIcons = function(installPath)
	{
		// Incomplete. Silent failure when extension is packed (packed extensions don't support icons anyway); permission denied when unpacked, or browser hang
		//

		/*
		console.log("+" + extension_config.EXT_HANDLE + ".bootstrap._copyIcons()");

		let iconsDir = installPath; // nsIFile
		iconsDir.append('chrome');
		iconsDir.append('icons');
		iconsDir.append('default');

		OS.File.exists(iconsDir.path).then(function(iconsDirExists) {

			if (iconsDirExists !== true || iconsDir.directoryEntries.hasMoreElements() === false)
				return;

			let appIconsDir = Services.dirsvc.get('AChrom', Components.interfaces.nsIFile);
			appIconsDir.append('icons');
			appIconsDir.append('default');

			console.log(extension_config.EXT_HANDLE + ".bootstrap._copyIcons(): copying icons to", appIconsDir.path);

			OS.File.makeDir(appIconsDir.path, {ignoreExisting: true}).then(function() {

				while (iconsDir.directoryEntries.hasMoreElements())
				{
					let iconFile = iconsDir.directoryEntries.getNext().QueryInterface(Components.interfaces.nsIFile);
					let destPath = OS.Path.join(appIconsDir.path, iconFile.leafName);

					console.log(extension_config.EXT_HANDLE + ".bootstrap._copyIcons(): copying icon", iconFile.leafName);
					OS.File.copy(iconFile.path, destPath, {noOverwrite: false}).catch(function(reason) {
						console.error(extension_config.EXT_HANDLE + ".bootstrap._copyIcons(): failed to copy icon", iconFile.leafName, reason);
					});
				}

    	    }, function(reason) {
    	    	console.error(extension_config.EXT_HANDLE + ".bootstrap._copyIcons(): failed to create directory", appIconsDir.path, reason);
			});
    	}, function(reason) {
		console.error(extension_config.EXT_HANDLE + ".bootstrap._copyIcons(): failed check existence of icons direcoty", iconsDir.path, reason);
    	});

		console.log("-" + extension_config.EXT_HANDLE + ".bootstrap._copyIcons()");
		*/
	};

	// ---------------------------------------------------------
	let _startup = function(data, reason)
	{
	    let reasonText = constants[reason];
		console.log("+" + extension_config.EXT_HANDLE + ".bootstrap._startup()", reasonText, data, Services.appinfo);

        // Bootstrapped extensions don't get default prefs... https://bugzilla.mozilla.org/show_bug.cgi?id=564675
		//
	    let branch = Services.prefs.getDefaultBranch('');

	    Services.scriptloader.loadSubScript(extension_config.EXT_URL_DEFAULTS, {pref: function(prefName, value) {
			switch (typeof value)
			{
				case "string":
					let complexValue = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
					complexValue.data = value;

					branch.setComplexValue(prefName, Components.interfaces.nsISupportsString, complexValue);
					return;

				case "number":
					branch.setIntPref(prefName, value);
					return;

				case "boolean":
					branch.setBoolPref(prefName, value);
					return;
			}
		}});

	    if (reasonText === 'ADDON_INSTALL' || reasonText === 'ADDON_UPGRADE' || reasonText === 'ADDON_DOWNGRADE')
			_copyIcons(data.installPath);

		console.log(extension_config.EXT_HANDLE + ".bootstrap._startup(): importing and starting up main module", extension_config.EXT_MAIN_MODULE_NAME);

		_extension = (Components.utils.import(extension_config.EXT_URL_MODULE_DIR + extension_config.EXT_MAIN_MODULE_NAME, {}))[extension_config.EXT_MAIN_MODULE_EXPORTS];
		_extension.startup(data, reasonText, function() {

			console.log(extension_config.EXT_HANDLE + ".bootstrap._startup(): startup done for main module", extension_config.EXT_MAIN_MODULE_NAME);

			_forEachOpenWindow(reasonText === 'APP_STARTUP' ? _windowListener.onOpenWindow : _loadIntoWindow);
			Services.wm.addListener(_windowListener);
		});

		console.log("-" + extension_config.EXT_HANDLE + ".bootstrap._startup()");
	};

	// ---------------------------------------------------------
	let _unloadModules = function()
	{
		let moduleDirURI = Services.io.newURI(extension_config.EXT_URL_MODULE_DIR, null, null);

		let localModuleDirURI = Components.classes["@mozilla.org/chrome/chrome-registry;1"].getService(Components.interfaces.nsIChromeRegistry)
			.convertChromeURL(moduleDirURI);

		// See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIChromeRegistry#convertChromeURL()
		// This is actually done in nsIIOService::newURI() (Services.io). Hard to believe...
		//
		let badFileName = moduleDirURI.host + '.xul';
		let badFileNameIndex = localModuleDirURI.spec.indexOf(badFileName, localModuleDirURI.spec.length - badFileName.length);

		if (badFileNameIndex !== -1)
			localModuleDirURI.spec = localModuleDirURI.spec.substring(0, badFileNameIndex);

		if (localModuleDirURI.scheme === "file")
		{
			let localModuleDirFile = Components.classes["@mozilla.org/network/protocol;1?name=file"].getService(Components.interfaces.nsIFileProtocolHandler)
				.getFileFromURLSpec(localModuleDirURI.spec);

			let localModuleDirFileEnumerator = localModuleDirFile.directoryEntries;
			while (localModuleDirFileEnumerator.hasMoreElements())
			{
				let currFileName = localModuleDirFileEnumerator.getNext().QueryInterface(Components.interfaces.nsIFile).leafName;

				Components.utils.unload(extension_config.EXT_URL_MODULE_DIR + currFileName);
				console.log(extension_config.EXT_HANDLE + ".bootstrap._unloadModules(): (file) unloaded", extension_config.EXT_URL_MODULE_DIR + currFileName);
			}
		}
		else if (localModuleDirURI.scheme === "jar")
		{
			let zr = Components.classes["@mozilla.org/libjar/zip-reader;1"].createInstance(Components.interfaces.nsIZipReader);

			try
			{
				localModuleDirURI.QueryInterface(Components.interfaces.nsIJARURI);

				zr.open(localModuleDirURI.JARFile.QueryInterface(Components.interfaces.nsIFileURL).file);

				let entries = zr.findEntries('*');

				while (entries.hasMore())
			    {
					let currEntry = entries.getNext();

					if (currEntry.indexOf(localModuleDirURI.JAREntry) === 0)
					{
						let currFileName = currEntry.substring(localModuleDirURI.JAREntry.length);

						Components.utils.unload(extension_config.EXT_URL_MODULE_DIR + currFileName);
						console.log(extension_config.EXT_HANDLE + ".bootstrap._unloadModules(): (jar) unloaded", extension_config.EXT_URL_MODULE_DIR + currFileName);
					}
				}
			}
			catch (ex)
			{
				console.error(extension_config.EXT_HANDLE + ".bootstrap._unloadModules(): failed to unload modules from jar", ex);
			}
			finally
			{
				zr.close();
			}
		}
		else
		{
			console.error(extension_config.EXT_HANDLE + ".bootstrap._unloadModules(): unknown module directory scheme", localModuleDirURI.scheme);
		}
	};

	// ---------------------------------------------------------
	let _shutdown = function(data, reason)
	{
	    let reasonText = constants[reason];
		console.log("+" + extension_config.EXT_HANDLE + ".bootstrap._shutdown()", reasonText, data);

		if (reasonText !== 'APP_SHUTDOWN')
		{
			// ADDON_DISABLE, ADDON_UNINSTALL, ADDON_UPGRADE, or ADDON_DOWNGRADE
			//

			Services.wm.removeListener(_windowListener);

			_forEachOpenWindow(function(window) {

				_unloadFromWindow(window);

				if (window.location.href.indexOf(extension_config.EXT_URL_CHROME_CONTENT_DIR) === 0)
					window.close();
			});

			if (_extension !== null)
				_extension.shutdown(data, reasonText);

			_unloadModules();

			Services.obs.notifyObservers(null, "chrome-flush-caches", null);
		}

		console.log("-" + extension_config.EXT_HANDLE + ".bootstrap._shutdown()");
	};

	// ---------------------------------------------------------
	return {
		startup: _startup,
		shutdown: _shutdown,
		install: function(data, reason) {},
		uninstall: function(data, reason) {}
	};
}));