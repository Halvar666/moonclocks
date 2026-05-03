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

	utils.exportSymbols(root, factory(Components, utils.console, utils, prefManager));

}(this,

// ====================================================================================
function(Components, console, utils, prefManager) {
	"use strict";

	// ====================================================================================
	var CI = Components.interfaces, CC = Components.classes;
	var EXT_URL_DATA_DIR = 'chrome://moonclocks-data/content/'; // resource://moonclocks-data/

	// ====================================================================================
	function Zone(zoneId)
	{
		this.id = zoneId;
		this.country_code = null;
		this.alias_for = null;
		this.transitions = null;
		this.fixed = null;

		this.comments = null;

		this.st_name = "";
		this.st_offset_mins = 0;

		this.dl_name = "";
		this.dl_offset_mins = 0;

		this.dl_start_gmt = null;
		this.dl_end_gmt = null;

		this.defaultLocation = null;
	}

	// ====================================================================================
	Zone.referenceDate = new Date();

	// ====================================================================================
	Zone.prototype =
	{
		// ====================================================================================
		set : function(zone)
		{
			this.country_code = typeof(zone.country_code) === 'string' ? zone.country_code : null;
			this.alias_for = typeof(zone.alias_for) === 'string' ? zone.alias_for : null;
			this.transitions = typeof(zone.transitions) !== 'undefined' ? zone.transitions : null;
			this.fixed = typeof(zone.fixed) !== 'undefined' ? zone.fixed : null;
			this.comments = typeof(zone.comments) !== 'undefined' ? zone.comments : null;

			this.st_name = "???";
			this.st_offset_mins = 0;

			this.dl_name = "";
			this.dl_offset_mins = 0;

			this.dl_start_gmt = null;
			this.dl_end_gmt = null;

			if (this.fixed !== null)
			{
				this.st_name = this.fixed.name;
				this.st_offset_mins = this.fixed.offset_mins;
			}
			else
			{
				var dateEpoch = Zone.referenceDate.getTime();
				var transitions = this.transitions;
				var transitionsLength = transitions.length;

				var dstBeginTransition = null;
				var dstBeginTransitionIndex = -1;

				var stdBeginTransition = null;
				var stdBeginTransitionIndex = -1;

				var transitionIndex = null;

				for (var i = 0; i < transitionsLength; i++)
				{
					// AFM - Transition immediately before the first 'future' transition
					// Note >= - very start of the transition is considered to be in the previous
					// transition, meaning transitionIndex can be -1
					//
					if (transitions[i].epoch >= dateEpoch)
					{
						transitionIndex = i - 1;
						break;
					}
				}

				// AFM - No future transitions - use most recent
				//
				if (transitionIndex === null)
					transitionIndex = transitionsLength - 1;

				if (transitionIndex !== -1)
				{
					var transition = transitions[transitionIndex];

					if (transition.is_dst)
					{
						dstBeginTransition = transition;
						dstBeginTransitionIndex = transitionIndex;
					}
					else
					{
						stdBeginTransition = transition;
						stdBeginTransitionIndex = transitionIndex;
					}

					if (transitions.length > transitionIndex + 1)
					{
						transitionIndex++;

						transition = transitions[transitionIndex];

						if (transition.is_dst)
						{
							dstBeginTransition = transition;
							dstBeginTransitionIndex = transitionIndex;
						}
						else
						{
							stdBeginTransition = transition;
							stdBeginTransitionIndex = transitionIndex;
						}
					}

					if (dstBeginTransition !== null)
					{
						this.dl_name = dstBeginTransition.name;
						this.dl_offset_mins = dstBeginTransition.offset_mins;

						this.dl_start_gmt = new Date(dstBeginTransition.epoch);
						if (transitions.length > dstBeginTransitionIndex + 1)
						{
							var dstEndTransition = transitions[dstBeginTransitionIndex + 1];

							if (dstEndTransition.is_dst === false) // AFM - virtually always true (otherwise name is a lie)
								this.dl_end_gmt = new Date(dstEndTransition.epoch);
						}
					}

					if (stdBeginTransition !== null)
					{
						this.st_name = stdBeginTransition.name;
						this.st_offset_mins = stdBeginTransition.offset_mins;
					}
				}
			}

			this.defaultLocation = new Location(this, null,
					typeof(zone.coords) !== 'undefined' ? zone.coords.lat_decimal : null,
					typeof(zone.coords) !== 'undefined' ? zone.coords.long_decimal : null);

			return this;
		},

		// ====================================================================================
		getInstantInfo : function(date)
		{
			if (this.fixed !== null)
				return { name: this.fixed.name, offset_mins: this.fixed.offset_mins, is_dst: false };

			var transitionIndex = null;
			var transitions = this.transitions;
			var transitionsLength = transitions.length;
			var dateEpoch = date.getTime();

			for (var i = 0; i < transitionsLength; i++)
			{
				if (transitions[i].epoch >= dateEpoch)
				{
					transitionIndex = i - 1;
					break;
				}
			}

			if (transitionIndex === null)
				transitionIndex = transitionsLength - 1;

			if (transitionIndex === -1)
				return null;

			var transition = transitions[transitionIndex];
			return { name: transition.name, offset_mins: transition.offset_mins, is_dst: transition.is_dst };
		},

		// ====================================================================================
		getFlagUrl : function()
		{
			return this.country_code !== null ? "chrome://moonclocks/skin/flags/" + this.country_code.toLowerCase() + ".png" : "";
		}
	};

	// ====================================================================================
	// Location
	// ====================================================================================
	function Location(zone, name, lat, lng)
	{
		this.zone = zone;

		this._name = name;

		this._latitude = null;
		this._lat_degs = 0;
		this._lat_mins = 0;
		this._lat_secs = 0;

		this._longitude = null;
		this._long_degs = 0;
		this._long_mins = 0;
		this._long_secs = 0;

		this.setLatitude(lat);
		this.setLongitude(lng);
	}

	// ====================================================================================
	Location.prototype =
	{
		// ====================================================================================
		getLatitude : function() { return this._latitude; },
		getLongitude : function() { return this._longitude; },
		setName : function(name) { this._name = name; },
		getName : function() { return this._name !== null ? this._name : this.zone.defaultLocation._name; },

		// ====================================================================================
		setLatitude : function(lat)
		{
			// AFM - decimal degrees - 5dp - covers seconds
			//
			// AFM - lat, lng are sometimes strings, sometimes numbers
			//
			if ((typeof(lat) === "string" && lat !== "") || typeof(lat) === "number")
			{
				this._latitude = Math.round(lat*100000)/100000;

				var absLat = Math.abs(this._latitude);

				this._lat_degs = Math.floor(absLat);
				this._lat_mins = Math.floor(60 * (absLat - this._lat_degs));
				this._lat_secs = Math.round(3600 * (absLat - this._lat_degs - this._lat_mins/60));

				// AFM - may round up to 60
				//
				if (this._lat_secs === 60)
				{
					this._lat_mins++;
					this._lat_secs = 0;
				}
			}
			else
			{
				this._latitude = null;
				this._lat_degs = 0;
				this._lat_mins = 0;
				this._lat_secs = 0;
			}
		},

		// ====================================================================================
		setLongitude : function(lng)
		{
			if ((typeof(lng) === "string" && lng !== "") || typeof(lng) === "number")
			{
				this._longitude = Math.round(lng*100000)/100000;

				var absLong = Math.abs(this._longitude);

				this._long_degs = Math.floor(absLong);
				this._long_mins = Math.floor(60 * (absLong - this._long_degs));
				this._long_secs = Math.round(3600 * (absLong - this._long_degs - this._long_mins/60));

				// AFM - may round up to 60
				//
				if (this._long_secs === 60)
				{
					this._long_mins++;
					this._long_secs = 0;
				}
			}
			else
			{
				this._longitude = null;
				this._long_degs = 0;
				this._long_mins = 0;
				this._long_secs = 0;
			}
		},

		// ====================================================================================
		latitudeIsNorth : function() { return this._latitude !== null && this._latitude >= 0; },
		latitudeDegrees : function() { return this._lat_degs; },
		latitudeMins : function() { return this._lat_mins; },
		latitudeSecs : function() { return this._lat_secs; },
		longitudeIsEast : function() { return this._longitude !== null && this._longitude >= 0; },
		longitudeDegrees : function() { return this._long_degs; },
		longitudeMins : function() { return this._long_mins; },
		longitudeSecs : function() { return this._long_secs; }
	};

	// ====================================================================================
	// ZoneManager
	// ====================================================================================
	function ZoneManager()
	{
		this.dataSource = {id: null, name: null, date: null, version: null};
		this.zoneData = null;

		this.zonePickerLocationMap = [];
		this.zonePickerXmlDoc = null;

		this.dataFile = null;
		this.builtinFileUrl = EXT_URL_DATA_DIR + 'zones.json';
	}

	// ====================================================================================
	ZoneManager.prototype =
	{
		// ====================================================================================
		init: function(dataFile)
		{
			this.dataFile = dataFile;
		},

		// ====================================================================================
		loadZoneData: function(callback)
		{
			// Super-hacky shim for Promises
			//
			if (typeof(Promise) === 'undefined')
			{
				var FCPromise = function(fn)
				{
					this._state = 'pending';
					this._rejectReason = null;
					this._fullfillmentValue = null;

					this._onFullfilledArray = [];
					this._onRejectedArray = [];

					var that = this;
					this._resolve = function(value) {

						if (that._state === 'pending')
						{
							that._state = 'resolved';
							that._fullfillmentValue = value;

							that._onFullfilledArray.forEach(function(currOnFullfilled, index) {
								try
								{
									currOnFullfilled(that._fullfillmentValue);
								}
								catch (ex)
								{
									console.error("foxclocks.ZoneManager::FCPromise::_resolve(): failed", ex);
								}
							});
						}
					};

					this._reject = function(reason) {

						if (that._state === 'pending')
						{
							that._state = 'rejected';
							that._rejectReason = reason;

							that._onRejectedArray.forEach(function(currOnRejected, index) {
								try
								{
									currOnRejected(that._rejectReason);
								}
								catch (ex)
								{
									console.error("foxclocks.ZoneManager::FCPromise::_reject(): failed", ex);
								}
							});
						}
					};

					try
					{
						fn(this._resolve, this._reject);
					}
					catch(ex)
					{
						this._reject(ex);
					}
				};

				FCPromise.all = function(promiseArray)
				{
					var promiseFullfillments = [];

					return new FCPromise(function(resolve, reject) {

						promiseArray.forEach(function(currPromise, index) {

							currPromise.then(function(fullfillmentValue) {

								promiseFullfillments[index] = fullfillmentValue;

								if (promiseFullfillments.length === promiseArray.length && promiseFullfillments.every(function(element, index, array) {
									  return typeof(element) !== 'undefined' && element !== null;
								}))
								{
									resolve(promiseFullfillments);
								}

							}).catch(function(reason) {
								reject(reason);
							});
						});
					});
				};

				FCPromise.prototype.then = function(onFullfilled, onRejected)
				{
					var that = this;

					var fn = function(resolve, reject) {

						if (that._state === 'resolved')
						{
							var fullfilledVal = typeof(onFullfilled) === 'function' ? onFullfilled(that._fullfillmentValue) : that._fullfillmentValue;

							if (typeof(fullfilledVal) === 'object' && typeof(fullfilledVal.then) === 'function')
								fullfilledVal.then(function(retVal) { resolve(retVal); });
							else
								resolve(fullfilledVal);
						}
						else
						{
							var rejectedVal = typeof(onRejected) === 'function' ? onRejected(that._rejectReason) : that._rejectReason;

							reject(rejectedVal);
						}
					};

					return new FCPromise(function(resolve, reject) {

						if (that._state === 'pending')
						{
							that._onFullfilledArray.push( function() { fn(resolve, reject);} );
							that._onRejectedArray.push( function() { fn(resolve, reject);} );
						}
						else
						{
							fn(resolve, reject);
						}
					});
				};

				FCPromise.prototype.catch = function(onRejected) { return this.then(null, onRejected); };
			}
			else
			{
				var FCPromise = Promise;
			}

			var loadUrl = function(url) {

				return new FCPromise(function(resolve, reject) {

					var req = CC["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(CI.nsIXMLHttpRequest);
					req.open('GET', url + '?time=' + new Date().getTime(), true);
					req.responseType = 'json';
					req.addEventListener('loadend', function() {

						var data = req.response;
						if (data === null || data.hasOwnProperty('zones') === false)
						{
							reject("Bad response from " + url);
						}
						else
						{
							console.log("foxclocks.ZoneManager::loadZoneData(): loaded zone data from " + url);
							resolve(data);
						}

					}, false);

					req.send(null);
				});
			};

			var promises = [loadUrl(this.builtinFileUrl)];

			if (this.dataFile.exists())
			{
				var dataFileUrl = CC["@mozilla.org/network/io-service;1"].getService(CI.nsIIOService).newFileURI(this.dataFile).spec;
				promises.push(loadUrl(dataFileUrl));
			}

			var self = this;
			FCPromise.all(promises).then(function(resultsArray) {

				var builtinData = resultsArray[0];
				var dataFileData = (resultsArray.length >= 2) ? resultsArray[1] : null;

				if (dataFileData === null || utils.compareTzdbVersions(builtinData.source.version, dataFileData.source.version) > 0)
				{
					utils.writeToFile(JSON.stringify(builtinData), self.dataFile, function(result, success) {

						if (success)
						{
							console.log("foxclocks.ZoneManager::loadZoneData(): copied builtin data");

							self._setZoneDatabase(builtinData);
							callback(true);
						}
						else
						{
							console.error("foxclocks.ZoneManager::loadZoneData(): could not copy builtin data");
							callback(false);
						}
					});
				}
				else
				{
					console.log("foxclocks.ZoneManager::loadZoneData(): no need to copy builtin data",
							builtinData.source.version, dataFileData.source.version);

					self._setZoneDatabase(dataFileData);
					callback(true);
				}

			}).catch(function(err) {
				console.error("foxclocks.ZoneManager::loadZoneData(): error", err);
				callback(false);
			});
		},

		// ====================================================================================
		loadZonePicker: function(callback, force)
		{
			if (this.zonePickerXmlDoc !== null && force !== true)
			{
				callback(true);
				return;
			}

			if (this.zoneData === null)
			{
				console.error("foxclocks.ZoneManager::loadZonePicker(): no zone data");
				callback(false);
				return;
			}

			var self = this;
			this._loadZonePickerUrl(function(success) {

				if (success === false)
				{
					callback(success);
					return;
				}

				self.zonePickerLocationMap = [];

				var goodLeafNodeId = 0;
				var leafNodes = self.zonePickerXmlDoc.documentElement.getElementsByTagName("Leaf");

				for (var i=0; i < leafNodes.length; i++)
				{
					var leafNode = leafNodes.item(i);
					leafNode.QueryInterface(CI.nsIDOMElement);

					var name = leafNode.getAttribute("name");
					var zoneId = leafNode.getAttribute("zone_id");
					var zone = zoneId !== null && self.zoneData.hasOwnProperty(zoneId) ? self.zoneData[zoneId] : null;

					if (name === null || zoneId === null || zone === null)
					{
						console.error("foxclocks.ZoneManager::loadZonePicker(): cannot generate item with zone id <" + zoneId + "> - skipping");
						continue;
					}

					leafNode.setAttribute("leaf_id", goodLeafNodeId++);
					var defaultLocation = zone.defaultLocation;

					// AFM - default location's name was null on creation in loadZoneData(); this is the earliest
					// we can set it, in a locale-independent way
					//
					if (defaultLocation.getName() === null)
						defaultLocation.setName(name);

					var latitude = null;
					var longitude = null;

					var coords = leafNode.getAttribute("coords");
					if (coords !== null)
					{
						var coordsMatch = coords.match(/^([+\-]?[0-9|\.]+), *([+\-]?[0-9|\.]+)$/); // leave heavy lifting to parseFloat()

						if (coordsMatch !== null)
						{
							latitude = parseFloat(coordsMatch[1]);
							longitude = parseFloat(coordsMatch[2]);
						}
						else if (coords !== 'none' && coords !== 'na')
						{
							latitude = defaultLocation.getLatitude();
							longitude = defaultLocation.getLongitude();
						}
					}
					else
					{
						// AFM - legacy support - old-style zonepicker.xml
						//
						var coordsNodes = leafNode.getElementsByTagName("Coordinates");
						if (coordsNodes.length === 1)
						{
							var coordsNode = coordsNodes.item(0);
							coordsNode.QueryInterface(CI.nsIDOMElement);

							latitude = coordsNode.getAttribute("latitude");
							longitude = coordsNode.getAttribute("longitude");
						}
						else
						{
							latitude = defaultLocation.getLatitude();
							longitude = defaultLocation.getLongitude();
						}
					}

					self.zonePickerLocationMap.push(new Location(zone, name, latitude, longitude));
				}

				callback(success);
			});

			console.log("-foxclocks.ZoneManager::loadZonePicker()");
		},

		// ====================================================================================
		_setZoneDatabase: function(data)
		{
			this.zoneData = {};

			var keys = Object.keys(data.zones);
			for (var i=0; i < keys.length; i++)
			{
				var tz_id = keys[i];
				var zone = data.zones[tz_id];

				if (typeof(zone.alias_for) === 'string')
				{
					var aliasedZone = data.zones[zone.alias_for];
					if (typeof(aliasedZone) === 'undefined')
					{
						console.error("foxclocks.ZoneManager::_setZoneDatabase(): zone '" + tz_id + "' is alias for unknown zone '" + zone.alias_for + "' - skipping");
						continue;
					}

					if (typeof(zone.transitions) === 'undefined' && typeof(aliasedZone.transitions) !== 'undefined')
						zone.transitions = aliasedZone.transitions;

					if (typeof(zone.fixed) === 'undefined' && typeof(aliasedZone.fixed) !== 'undefined')
						zone.fixed = aliasedZone.fixed;
				}

				var fc_zone = this.zoneData[tz_id];

				if (typeof(fc_zone) === 'undefined')
				{
					fc_zone = new Zone(tz_id);
					this.zoneData[tz_id] = fc_zone;
				}

				fc_zone.set(zone);
			}

			this.dataSource = {id: data.source.id, name: data.source.name, date: data.source.date, version: data.source.version};

			console.log("foxclocks.ZoneManager::_setZoneDatabase(): done: " + Object.keys(this.zoneData).length + " zones");
		},

		// ====================================================================================
		_loadZonePickerUrl: function(callback)
		{
			var self = this;

			var loadUrl = function(url, loadCallback) {

				try
				{
					var req = CC["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(CI.nsIXMLHttpRequest);
					req.open('GET', url + '?time=' + new Date().getTime(), true);
					req.responseType = 'xml';
					req.addEventListener('loadend', function() {

						if (req.responseXML === null)
							throw "Bad response";

						if (req.responseXML.documentElement.nodeName === "parsererror")
							throw req.responseXML.documentElement.firstChild.nodeValue;

						self.zonePickerXmlDoc = req.responseXML;

						console.log("foxclocks.ZoneManager::_loadZonePickerUrl(): loaded zone picker from " + url);
						loadCallback(true);

					}, false);

					req.send(null);
				}
				catch(ex)
				{
					console.log("foxclocks.ZoneManager::_loadZonePickerUrl(): could not load zone picker from " + url, ex);
					loadCallback(false);
				}
			};

			var zonePickerUrl = prefManager.getPref("extensions.moonclocks.zonepicker.dataurl");

			if (zonePickerUrl === "fc-zonepicker-dataurl-builtin")
				zonePickerUrl = utils.FC_URL_CHROME_ZONEPICKER_BUILTIN;

			loadUrl(zonePickerUrl, function(success) {

				if (success === true || zonePickerUrl === utils.FC_URL_CHROME_ZONEPICKER_BUILTIN)
				{
					callback(success);
				}
				else
				{
					loadUrl(utils.FC_URL_CHROME_ZONEPICKER_BUILTIN, function(success) {
						callback(success);
					});
				}
			});
		},

		// ====================================================================================
		getZoneData: function() { return this.zoneData; },
		getZonePickerLocationMap: function() { return this.zonePickerLocationMap; },
		getZonePickerXmlDoc: function() { return this.zonePickerXmlDoc; }
	};

	// ====================================================================================
	return [{name: 'FoxClocks_Location', constructor: Location, is_service: false},
	        {name: 'FoxClocks_ZoneManager', constructor: ZoneManager, is_service: true}];

}));