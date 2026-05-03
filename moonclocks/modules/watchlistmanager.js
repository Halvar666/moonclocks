/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components */

// ====================================================================================
(function(root, factory) {
	"use strict";

	let EXT_URL_MODULE_DIR = 'chrome://moonclocks-modules/content/'; // resource://moonclocks/

	let utils =			(Components.utils.import(EXT_URL_MODULE_DIR + "utils.js", {})).FoxClocks_Utils;
	let TimeFormatter =	(Components.utils.import(EXT_URL_MODULE_DIR + "timeformatter.js", {})).FoxClocks_TimeFormatter;
	let prefManager =	(Components.utils.import(EXT_URL_MODULE_DIR + "prefmanager.js", {})).FoxClocks_PrefManager;
	let Location =		(Components.utils.import(EXT_URL_MODULE_DIR + "zonemanager.js", {})).FoxClocks_Location;

	utils.exportSymbols(root, factory(Components, utils.console, utils, TimeFormatter, prefManager, Location));

}(this,

// ====================================================================================
function(Components, console, utils, TimeFormatter, prefManager, Location) {
	"use strict";

	// ====================================================================================
	var CI = Components.interfaces, CC = Components.classes;

	// ====================================================================================
	function WatchlistItem(location)
	{
		this.location = location;

		this.showClock_statusbar = prefManager.getPref("extensions.moonclocks.clock.bar.clock.new.visible");
		this.showClock_statusbarFlag = prefManager.getPref("extensions.moonclocks.clock.bar.clock.new.showflag");
		this.showClock_statusbarTooltip = prefManager.getPref("extensions.moonclocks.clock.tooltip.clock.new.visible");
		this.showClock_statusbarTooltipFlag = prefManager.getPref("extensions.moonclocks.clock.tooltip.clock.new.showflag");

		this.bold = false;
		this.italic = false;
		this.underline = false;
		this.colour = "";
		this.altColour_enabled = false;
		this.altColour = "";
		this.altColour_startTime = 540; // 9am
		this.altColour_endTime = 1020; // 5pm

		this.customFlagUrl = "";
		this.useCustomFlag = false;

		// AFM - we shouldn't know anything about formatters here, but it's very handy. So hackety hack
		// Currently not supporting per-clock formats in Watchlist
		//
		this._statusbarTimeFormat = ""; // empty -> use global format
		this._tooltipTimeFormat = ""; // empty -> use global format
		this._statusbarTimeFormatter = null;
		this._tooltipTimeFormatter = null;
	}

	// ====================================================================================
	WatchlistItem.prototype =
	{
		// ====================================================================================
		toXml : function(parentNode, nameSpace)
		{
			var doc = parentNode.ownerDocument;

			var watchlistItemNode = doc.createElementNS(nameSpace, "WatchlistItem");
			parentNode.appendChild(watchlistItemNode);

			var locationNode = doc.createElementNS(nameSpace, "Location");
			watchlistItemNode.appendChild(locationNode);

			var zoneNode = doc.createElementNS(nameSpace, "Zone");
			locationNode.appendChild(zoneNode);
			zoneNode.setAttribute("id", this.location.zone.id);

			// AFM - <Name/> will not exist if we're using the default name
			// If a user switches locales when using default names, their locations will be renamed nicely
			// More significantly, because of this the default foxclocks.watchlist param
			// doesn't need to be localised
			//
			if (this.location.getName() !== this.location.zone.defaultLocation.getName())
			{
				var nameNode = doc.createElementNS(nameSpace, "Name");
				locationNode.appendChild(nameNode);
				nameNode.appendChild(doc.createTextNode(this.location.getName()));
			}

			// AFM - <Coordinates/> will not exist unless we have lat/long
			//
			if (this.location.getLatitude() !== null && this.location.getLongitude !== null)
			{
				var coordsNode = doc.createElementNS(nameSpace, "Coordinates");
				locationNode.appendChild(coordsNode);
				coordsNode.setAttribute("latitude", this.location.getLatitude());
				coordsNode.setAttribute("longitude", this.location.getLongitude());
			}

			var styleNode = doc.createElementNS(nameSpace, "Style");
			watchlistItemNode.appendChild(styleNode);

			var statusbarNode = doc.createElementNS(nameSpace, "Statusbar");
			styleNode.appendChild(statusbarNode);

			statusbarNode.setAttribute("visible", this.showClock_statusbar);
			statusbarNode.setAttribute("showflag", this.showClock_statusbarFlag);

			if (this._statusbarTimeFormat !== "")
				statusbarNode.setAttribute("timeformat", this._statusbarTimeFormat);

			var usualStateNode = doc.createElementNS(nameSpace, "UsualState");
			statusbarNode.appendChild(usualStateNode);

			usualStateNode.setAttribute("colour", this.colour);
			usualStateNode.setAttribute("bold", this.bold);
			usualStateNode.setAttribute("italic", this.italic);
			usualStateNode.setAttribute("underline", this.underline);

			var alternateStateNode = doc.createElementNS(nameSpace, "AlternateState");
			statusbarNode.appendChild(alternateStateNode);

			alternateStateNode.setAttribute("enabled", this.altColour_enabled);
			alternateStateNode.setAttribute("colour", this.altColour);
			alternateStateNode.setAttribute("starttime", this.altColour_startTime);
			alternateStateNode.setAttribute("endtime", this.altColour_endTime);

			var statusbarTooltipNode = doc.createElementNS(nameSpace, "StatusbarTooltip");
			styleNode.appendChild(statusbarTooltipNode);

			statusbarTooltipNode.setAttribute("visible", this.showClock_statusbarTooltip);
			statusbarTooltipNode.setAttribute("showflag", this.showClock_statusbarTooltipFlag);

			if (this._tooltipTimeFormat !== "")
				statusbarTooltipNode.setAttribute("timeformat", this._tooltipTimeFormat);

			if (this.customFlagUrl !== "")
			{
				var flagNode = doc.createElementNS(nameSpace, "Flag");
				watchlistItemNode.appendChild(flagNode);

				flagNode.setAttribute("type", "custom");
				flagNode.setAttribute("url", this.customFlagUrl);
				flagNode.setAttribute("in_use", this.useCustomFlag);
			}
		},

		// ====================================================================================
		fromXml : function(zoneData, itemNode)
		{
			// AFM - itemNode should be a WatchlistItem
			//
			var locationNode = utils.getFirstEltByTagAsNode(itemNode, "Location");
			var zoneNode = utils.getFirstEltByTagAsNode(locationNode, "Zone");
			var zoneId = zoneNode.getAttribute("id");

			var zone = zoneData[zoneId];
			if (typeof(zone) === 'undefined')
			{
				console.error("foxclocks.WatchlistItem::fromXml(): could not find zone with id <" + zoneId + ">");
				return false;
			}

			var locationNameNode = utils.getFirstEltByTagAsNode(locationNode, "Name");
			var locationName = locationNameNode !== null ? locationNameNode.firstChild.nodeValue : zone.defaultLocation.getName();

			var latitude = null;
			var longitude = null;

			var coordsNode = utils.getFirstEltByTagAsNode(locationNode, "Coordinates");
			if (coordsNode !== null)
			{
				// AFM - if <Coordinates/> exist, we expect both lat/long attributes
				//
				latitude = coordsNode.getAttribute("latitude");
				longitude = coordsNode.getAttribute("longitude");
			}

			this.location = new Location(zone, locationName, latitude, longitude);

			var styleNode = utils.getFirstEltByTagAsNode(itemNode, "Style");
			var statusbarNode = utils.getFirstEltByTagAsNode(styleNode, "Statusbar");

			var visibleSbarAtt = statusbarNode.getAttribute("visible");
			if (visibleSbarAtt !== null) this.showClock_statusbar = visibleSbarAtt === "true";
			var showFlagAtt = statusbarNode.getAttribute("showflag");
			if (showFlagAtt !== null) this.showClock_statusbarFlag = showFlagAtt === "true";

			this.setStatusbarTimeFormat(statusbarNode.getAttribute("timeformat"));

			var usualStateNode = utils.getFirstEltByTagAsNode(statusbarNode, "UsualState");
			var usualColourAtt = usualStateNode.getAttribute("colour");
			if (usualColourAtt !== null) this.colour = usualColourAtt;

			var usualBoldAtt = usualStateNode.getAttribute("bold");
			if (usualBoldAtt !== null) this.bold = usualBoldAtt === "true";

			var usualItalicAtt = usualStateNode.getAttribute("italic");
			if (usualItalicAtt !== null) this.italic = usualItalicAtt === "true";

			var usualUnderlineAtt = usualStateNode.getAttribute("underline");
			if (usualUnderlineAtt !== null) this.underline = usualUnderlineAtt === "true";

			// AFM - we expect this node to exist right now, but just in case...
			//
			var altStateNode = utils.getFirstEltByTagAsNode(statusbarNode, "AlternateState");
			if (altStateNode !== null)
			{
				var altEnabledAtt = altStateNode.getAttribute("enabled");
				if (altEnabledAtt !== null) this.altColour_enabled = altEnabledAtt === "true";

				var altColourAtt = altStateNode.getAttribute("colour");
				if (altColourAtt !== null) this.altColour = altColourAtt;

				var altStartTimeAtt = altStateNode.getAttribute("starttime");
				if (altStartTimeAtt !== null) this.altColour_startTime = Number(altStartTimeAtt);

				var altEndTimeAtt = altStateNode.getAttribute("endtime");
				if (altEndTimeAtt !== null) this.altColour_endTime = Number(altEndTimeAtt);
			}

			var statusbarTooltipNode = utils.getFirstEltByTagAsNode(styleNode, "StatusbarTooltip");

			// AFM - we expect this node to exist, but the default behaviour is harmless
			//
			this.showClock_statusbarTooltip = statusbarTooltipNode.getAttribute("visible") === "true";

			// AFM - newer node; may not exist
			//
			this.showClock_statusbarTooltipFlag = statusbarTooltipNode.getAttribute("showflag") === "true";

			this.setTooltipTimeFormat(statusbarTooltipNode.getAttribute("timeformat"));

			var flagNode = utils.getFirstEltByTagAsNode(itemNode, "Flag");
			if (flagNode !== null && flagNode.getAttribute("type") === "custom")
			{
				var customFlagUrlAtt = flagNode.getAttribute("url");
				this.customFlagUrl = customFlagUrlAtt !== null ? customFlagUrlAtt : "";

				this.useCustomFlag = flagNode.getAttribute("in_use") === "true";
			}

			return true;
		},

		// ====================================================================================
		getStatusbarTimeFormat : function() { return this._statusbarTimeFormat; },
		getTooltipTimeFormat : function() { return this._tooltipTimeFormat; },
		getStatusbarTimeFormatter : function() { return this._statusbarTimeFormatter; },
		getTooltipTimeFormatter : function() { return this._tooltipTimeFormatter; },

		// ====================================================================================
		setStatusbarTimeFormat : function(formatString)
		{
			if (typeof(formatString) === 'string' && formatString !== "")
			{
				this._statusbarTimeFormat = formatString;
				this._statusbarTimeFormatter = new TimeFormatter(this._statusbarTimeFormat);
			}
			else
			{
				this._statusbarTimeFormat = "";
				this._statusbarTimeFormatter = null;
			}
		},

		// ====================================================================================
		setTooltipTimeFormat : function(formatString)
		{
			if (typeof(formatString) === 'string' && formatString !== "")
			{
				this._tooltipTimeFormat = formatString;
				this._tooltipTimeFormatter = new TimeFormatter(this._tooltipTimeFormat);
			}
			else
			{
				this._tooltipTimeFormat = "";
				this._tooltipTimeFormatter = null;
			}
		},

		// ====================================================================================
		getFlagUrl : function()
		{
			// AFM - checks for existence of image, unlike zone.getFlagUrl()
			//
			var url = this.useCustomFlag ? this.customFlagUrl : this.location.zone.getFlagUrl();

			if (url !== "" && !utils.isUriAvailable(url))
			{
				if (this.useCustomFlag)
					console.warn("foxclocks.WatchlistItem::getFlagUrl(): flag at url <" + url + "> does not exist");

				url = "";
			}

			return url;
		}
	};

	// ====================================================================================
	// WatchlistManager
	// ====================================================================================
	function WatchlistManager()
	{
		this._watchlist = [];
	}

	// ====================================================================================
	WatchlistManager.prototype =
	{
		// ====================================================================================
		getItem: function(i) { return this._watchlist[i]; },
		setItem: function(i, item) { this._watchlist[i] = item; },
		getWatchlist: function() { return this._watchlist; },
		setWatchlist: function(watchlist) { this._watchlist = watchlist; },
		clearWatchlist: function() { this._watchlist = []; },

		// ====================================================================================
		watchlistToXmlString: function()
		{
			var serializer = CC["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(CI.nsIDOMSerializer);
			var watchlistDoc = utils.getDOMImpl().createDocument(null, "Watchlist", null);

			for (var i=0; i < this._watchlist.length; i++)
			{
				var watchlistItem = this._watchlist[i];
				watchlistItem.toXml(watchlistDoc.documentElement, null);
			}

			return serializer.serializeToString(watchlistDoc);
		},

		// ====================================================================================
		watchlistFromXmlString: function(zoneData, xmlString)
		{
			var watchlistItemNodes = CC["@mozilla.org/xmlextras/domparser;1"].createInstance(CI.nsIDOMParser)
					.parseFromString(xmlString, "text/xml")
					.documentElement.getElementsByTagName("WatchlistItem");

			this._watchlist = [];
			for (var i = 0; i < watchlistItemNodes.length; i++)
			{
				var watchlistItem = new WatchlistItem(null);

				// AFM - Fx 2, Tb 2 (ie Gecko 1.8): can't use watchlistItem.fromXml(watchlistItemNodes[i])) - not clear why
				//
				if (watchlistItem.fromXml(zoneData, watchlistItemNodes.item(i).QueryInterface(CI.nsIDOMElement)))
					this._watchlist.push(watchlistItem);
			}
		}
	};

	// ====================================================================================
	return [{name: 'FoxClocks_WatchlistItem', constructor: WatchlistItem, is_service: false},
	        {name: 'FoxClocks_WatchlistManager', constructor: WatchlistManager, is_service: true}];

}));