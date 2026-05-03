/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components */

// ====================================================================================
(function(root, factory) {
	"use strict";

	let EXT_URL_MODULE_DIR = 'chrome://moonclocks-modules/content/'; // resource://moonclocks/

	let utils =			(Components.utils.import(EXT_URL_MODULE_DIR + "utils.js", {})).FoxClocks_Utils;
	let prefManager =	(Components.utils.import(EXT_URL_MODULE_DIR + "prefmanager.js", {})).FoxClocks_PrefManager;
	let zoneManager =	(Components.utils.import(EXT_URL_MODULE_DIR + "zonemanager.js", {})).FoxClocks_ZoneManager;

	utils.exportSymbols(root, factory(Components, utils.console, utils, prefManager, zoneManager));

}(this,

// ====================================================================================
function(Components, console, utils, prefManager, zoneManager) {
	"use strict";

	// ====================================================================================
	let CI = Components.interfaces, CC = Components.classes;
	var UPDATE_INTERVAL_SECS = 604800; // week

	// ====================================================================================
	function UpdateManager()
	{
		this._nextUpdateDate = null; // null if automatic updates disabled
		this._lastUpdateResult = { result: "NONE", server_time: null }; // result: "ERROR", "OK_NEW", "OK_NO"
		this._lastUpdateDate = null;

		this._timer = CC["@mozilla.org/timer;1"].createInstance(CI.nsITimer);
		this._remoteUrl = null;
		this._remoteUrlIsRawData = false;
	}

	// ====================================================================================
	UpdateManager.prototype =
	{
		// ====================================================================================
		init: function(enabled, remoteUrl, remoteUrlIsRawData)
		{
			this._remoteUrl = remoteUrl;
			this._remoteUrlIsRawData = remoteUrlIsRawData;
			this._setUpdateDates(enabled);
		},

		// ====================================================================================
		updateNow: function(type)
		{
			var url = this._remoteUrl;

			var _addQueryParam = function(url, name, value)
			{
				return url + (url.indexOf('?') === -1 ? '?' : '&') + name + '=' + encodeURIComponent(value);
			};

			if (url === null || url === "")
			{
				console.log("foxclocks.UpdateManager::updateNow(): no update URL configured");
				this._onResponse({ source: zoneManager.dataSource, zones: {} });
				return;
			}

			if (false)
				url = _addQueryParam(url, 'test', 'true');

			if (type === 'manual')
				url = _addQueryParam(url, 'time', new Date().getTime());

			try
			{
				var self = this;
				var req = CC["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(CI.nsIXMLHttpRequest);
				req.open('GET', url, true);
				req.responseType = 'json';
				req.addEventListener('loadend', function(e) { self._onResponse(req.response); } );
				req.send(null);

				console.log("foxclocks.UpdateManager::updateNow(): " + type + " request sent to url " + url);
			}
			catch (ex)
			{
				console.error("foxclocks.UpdateManager::updateNow(): failed", ex);
				this._onResponse(null);
			}
		},

		// ====================================================================================
		getNextUpdateDate: function() { return this._nextUpdateDate; },
		getLastUpdateResult: function() { return this._lastUpdateResult; },
		getLastUpdateDate: function() { return this._lastUpdateDate; },

		// ====================================================================================
		_onResponse: function(response)
		{
			var serverTime = null;
			var self = this;

			var _onResponseProcessed = function(result)
			{
				self._lastUpdateResult = { result: result, server_time: serverTime };
				self._setUpdateDates();

				CC["@mozilla.org/observer-service;1"].getService(CI.nsIObserverService)
					.notifyObservers(self, "moonclocks", "updatemanager:update-complete");
			};

			try
			{
				if (response === null)
					throw 'Bad response';

				var tz_db = null;

				if (this._remoteUrlIsRawData === false)
				{
					console.log("foxclocks.UpdateManager::_onResponse(): status: " + JSON.stringify(response.response_status));

					if (typeof(response.response_status.current_time) === 'string')
						serverTime = new Date(response.response_status.current_time);

					if (response.response_status.error)
						throw response.response_status.error;

					if (typeof(response.tz_db) !== 'undefined')
						tz_db = response.tz_db;
				}
				else
				{
					tz_db = response;
				}

				if (tz_db !== null && tz_db.source.version > zoneManager.dataSource.version)
				{
					utils.writeToFile(JSON.stringify(tz_db), zoneManager.dataFile, function(result, success) {

						if (success)
						{
							_onResponseProcessed("OK_NEW");
						}
						else
						{
							console.error("foxclocks.UpdateManager::_onResponse()", result);
							_onResponseProcessed("ERROR");
						}
					});
				}
				else
				{
					_onResponseProcessed("OK_NO");
				}
			}
			catch (ex)
			{
				console.error("foxclocks.UpdateManager::_onResponse()", ex);
				_onResponseProcessed("ERROR");
			}
		},

		// ====================================================================================
		_setUpdateDates: function(enabled)
		{
			enabled = (typeof(enabled) === 'boolean' ? enabled : this._nextUpdateDate !== null);
			var prevUpdatePref = "extensions." + utils.FC_GUID_FOXCLOCKS + ".data.update.prevupdate";
			var now = new Date();
			var millisToNextUpdate = null;

			if (this._lastUpdateDate === null)
			{
				var prevUpdateSecs = prefManager.getPref(prevUpdatePref);

				if (prevUpdateSecs === 0)
				{
					this._lastUpdateDate = now;
					millisToNextUpdate = 0;
				}
				else
				{
					this._lastUpdateDate = new Date(prevUpdateSecs * 1000);
					millisToNextUpdate = Math.max(this._lastUpdateDate.getTime() - now.getTime() + (UPDATE_INTERVAL_SECS * 1000), 0);
				}
			}
			else
			{
				this._lastUpdateDate = now;
				millisToNextUpdate = UPDATE_INTERVAL_SECS * 1000;
			}

			prefManager.setPref(prevUpdatePref, Math.round(this._lastUpdateDate.getTime()/1000));

			if (enabled !== false)
			{
				this._nextUpdateDate = new Date(now.getTime() + millisToNextUpdate);

				// AFM - implicitly cancels an outstanding timer
				//
				var self = this;
				this._timer.initWithCallback(function() { self.updateNow('automatic'); }, millisToNextUpdate, CI.nsITimer.TYPE_ONE_SHOT);

				console.log("foxclocks.UpdateManager::_setUpdateDates(): auto-update enabled: next update", this._nextUpdateDate.toLocaleString());
			}
			else if (this._nextUpdateDate !== null)
			{
				this._nextUpdateDate = null;
				this._timer.cancel();
				console.log("foxclocks.UpdateManager::_setUpdateDates(): auto-update disabled");
			}
		}
	};

	// ====================================================================================
	return [{name: 'FoxClocks_UpdateManager', constructor: UpdateManager, is_service: true}];

}));