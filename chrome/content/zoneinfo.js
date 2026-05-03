/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components, foxclocks */

// ====================================================================================
(function(root) {
	"use strict";

	// ====================================================================================
	function ZoneInfo(timeFormatter, mode, watchlistItem, retVals)
	{
		this.timeFormatter = timeFormatter;

		// AFM - only prefs used in this window. We don't bother handling pref changes
		//
		this.isIconMode = foxclocks.prefManager.getPref("extensions.moonclocks.clock.style") == "fc-clock-style-icon";
		// this.showAdvancedTzData = foxclocks.prefManager.getPref("extensions.moonclocks.zoneinfo.tzdata.advanced.hidden") == false;

		// AFM - modes are "ZONE", "ADD_AS" and "LOCATION",
		// which basically determine which tabs are visible
		//
		this.mode = mode;
		this.watchlistItem = watchlistItem;
		this.workingLocation = new foxclocks.Location(
				watchlistItem.location.zone, watchlistItem.location.getName(),
				watchlistItem.location.getLatitude(), watchlistItem.location.getLongitude());
		this.retVals = retVals;

		this.zoneCaption = null;

		this.standardZoneValue = null;
		this.daylightZoneValue = null;

		this.dstBeginLabel = null;
		this.dstEndLabel = null;

		this.dstBeginsText = null;
		this.dstBeganText = null;

		this.dstEndsText = null;
		this.dstEndedText = null;

		this.acceptButton = null;
		this.applyButton = null;
		this.googleEarthButton = null;
		this.textboxName = null;

		this.northAsLocaleString = null;
		this.southAsLocaleString = null;
		this.eastAsLocaleString = null;
		this.westAsLocaleString = null;
	}

	// ====================================================================================
	ZoneInfo.prototype =
	{
		// ====================================================================================
		onLoad : function()
		{
			// AFM - missing locale strings
			//
			var groupBoxes = document.getElementsByTagName("groupbox");

			for (var i=0; i < groupBoxes.length; i++)
			{
				var currGroupBox = groupBoxes[i];

				var checkChild = currGroupBox.getAttribute("check_child_caption_label");
				if (	checkChild == "true" && currGroupBox.firstChild != null &&
						currGroupBox.firstChild.getAttribute("label") == "")
				{
					currGroupBox.setAttribute("collapsed", "true");
				}
			}

			// AFM - set up various labels - not sure why we're not using DTD here
			//
			var hFoxClocksBundle = document.getElementById("foxclocks-bundle");
			document.getElementById("fc-zoneinfo-addas-menu-north").setAttribute("label", hFoxClocksBundle.getString("misc.north"));
			document.getElementById("fc-zoneinfo-addas-menu-south").setAttribute("label", hFoxClocksBundle.getString("misc.south"));
			document.getElementById("fc-zoneinfo-addas-menu-east").setAttribute("label", hFoxClocksBundle.getString("misc.east"));
			document.getElementById("fc-zoneinfo-addas-menu-west").setAttribute("label", hFoxClocksBundle.getString("misc.west"));
			document.getElementById("fc-zoneinfo-addas-menulist-ns").setAttribute("label", hFoxClocksBundle.getString("misc.north"));
			document.getElementById("fc-zoneinfo-addas-menulist-ew").setAttribute("label", hFoxClocksBundle.getString("misc.east"));
			document.getElementById("fc-zoneinfo-start-ampm-menuitem-am").setAttribute("label", hFoxClocksBundle.getString("misc.am.upper"));
			document.getElementById("fc-zoneinfo-start-ampm-menuitem-pm").setAttribute("label", hFoxClocksBundle.getString("misc.pm.upper"));
			document.getElementById("fc-zoneinfo-end-ampm-menuitem-am").setAttribute("label", hFoxClocksBundle.getString("misc.am.upper"));
			document.getElementById("fc-zoneinfo-end-ampm-menuitem-pm").setAttribute("label", hFoxClocksBundle.getString("misc.pm.upper"));

			this.northAsLocaleString = hFoxClocksBundle.getString("misc.north");
			this.southAsLocaleString = hFoxClocksBundle.getString("misc.south");
			this.eastAsLocaleString = hFoxClocksBundle.getString("misc.east");
			this.westAsLocaleString = hFoxClocksBundle.getString("misc.west");

			// AFM - various data members
			//

			this.zoneCaption = document.getElementById("fc-zoneinfo-zone-caption");

			this.standardZoneValue = document.getElementById("fc-zoneinfo-standard-zone-value");
			this.daylightZoneValue = document.getElementById("fc-zoneinfo-daylight-zone-value");

			this.dstBeginLabel = document.getElementById("fc-zoneinfo-daylightsaving-begin");
			this.dstEndLabel = document.getElementById("fc-zoneinfo-daylightsaving-end");

			this.dstBeginsText = document.getElementById("fc-zoneinfo-daylightsaving-begins-data").getAttribute("value");
			this.dstBeganText = document.getElementById("fc-zoneinfo-daylightsaving-began-data").getAttribute("value");

			this.dstEndsText = document.getElementById("fc-zoneinfo-daylightsaving-ends-data").getAttribute("value");
			this.dstEndedText = document.getElementById("fc-zoneinfo-daylightsaving-ended-data").getAttribute("value");

			this.textboxName = document.getElementById("fc-zoneinfo-addas-textbox-name");

			this.acceptButton = document.documentElement.getButton("accept");
			this.applyButton = document.documentElement.getButton("extra1");
			this.googleEarthButton = document.documentElement.getButton("extra2");

			// AFM - build zone caption text
			//
			var zoneCaptionText = "id: " + this.workingLocation.zone.id;
			var comments = this.workingLocation.zone.comments;

			if (comments !== null)
			{
				var lang = Object.keys(comments)[0];

				if (typeof(lang) === 'string' && lang.split('-')[0] === foxclocks.utils.getAppLocale().major)
					zoneCaptionText += " - " + comments[lang];
			}

			var countryCode = this.workingLocation.zone.country_code;
			if (countryCode != null)
				 zoneCaptionText += " (" + countryCode + ")";

			document.getElementById("fc-zoneinfo-zone-extendedinfo").setAttribute("label", zoneCaptionText);

			var noneFlagRadio = document.getElementById("fc-zoneinfo-display-flag-radio-none");
			var standardFlagRadio = document.getElementById("fc-zoneinfo-display-flag-radio-standard");

			var imageURL = this.workingLocation.zone.getFlagUrl();
			if (foxclocks.utils.isUriAvailable(imageURL))
			{
				this.zoneCaption.setAttribute("image", imageURL);

				// AFM - identify the image we've just added to the caption, which is anonymous,
				// in order to style it
				//
				var anonImage = document.getAnonymousElementByAttribute(this.zoneCaption, "src", imageURL);
				anonImage.setAttribute("class", anonImage.getAttribute("class") + " fc-zoneinfo-zone-caption-flag");

				noneFlagRadio.setAttribute("hidden", "true");
			}
			else
			{
				standardFlagRadio.setAttribute("hidden", "true");
			}

			var dstBeginValue = document.getElementById("fc-zoneinfo-daylightsaving-begin-value");
			var dstEndValue = document.getElementById("fc-zoneinfo-daylightsaving-end-value");

			this.standardZoneValue.value = "GMT/UTC" +
				foxclocks.utils.getZoneOffsetString(this.workingLocation.zone.st_offset_mins).replace(/^-/, foxclocks.utils.FC_MINUS_SYMBOL) +
				" (" + this.workingLocation.zone.st_name + ")";

			if (this.workingLocation.zone.dl_start_gmt)
			{
				this.daylightZoneValue.value = "GMT/UTC" +
					foxclocks.utils.getZoneOffsetString(this.workingLocation.zone.dl_offset_mins).replace(/^-/, foxclocks.utils.FC_MINUS_SYMBOL) +
					" (" + this.workingLocation.zone.dl_name + ")";

				// AFM - the location's name can change during the life of the window, and that's
				// not reflected here - oh well. In fact the zoneinfo.dst.format shouldn't have the
				// location name in it anyway...
				//

				var formatString = hFoxClocksBundle.getString("zoneinfo.dst.format");
				dstBeginValue.value = foxclocks.TimeFormatter.getTimeStringFromFormat(this.workingLocation, this.workingLocation.zone.dl_start_gmt, formatString);

				if (this.workingLocation.zone.dl_end_gmt !== null)
					dstEndValue.value = foxclocks.TimeFormatter.getTimeStringFromFormat(this.workingLocation, this.workingLocation.zone.dl_end_gmt, formatString);
			}

			var defaultLocation = foxclocks.zoneManager.getZoneData()[this.workingLocation.zone.id].defaultLocation;
			if (defaultLocation.getLatitude() != null && defaultLocation.getLongitude() != null)
			{
				document.getElementById("fc-zoneinfo-defaultlocation-coords").value =
					this.latitudeAsLocaleString(defaultLocation) + ", " + this.longitudeAsLocaleString(defaultLocation);
			}

			// document.getElementById("fc-zoneinfo-tzdata-advanced-box").setAttribute("hidden", this.showAdvancedTzData == false);
			// var tzAdvDesc = document.getElementById("fc-zoneinfo-tzdata-advanced-desc");
			// var tzAdvDescInitWidth = tzAdvDesc.boxObject.width;
			// tzAdvDesc.appendChild(document.createTextNode(zoneCaptionText));
			// tzAdvDesc.setAttribute("width", tzAdvDescInitWidth);

			// AFM - init values in location tab
			//
			this.textboxName.value = this.workingLocation.getName();

			if (this.workingLocation.getLatitude() != null && this.workingLocation.getLongitude() != null)
			{
				document.getElementById("fc-zoneinfo-addas-menulist-ns").selectedIndex = this.workingLocation.latitudeIsNorth() ? 0 : 1;
				document.getElementById("fc-zoneinfo-addas-textbox-lat-deg").value = this.workingLocation.latitudeDegrees();
				document.getElementById("fc-zoneinfo-addas-textbox-lat-min").value = this.workingLocation.latitudeMins();
				document.getElementById("fc-zoneinfo-addas-textbox-lat-sec").value = this.workingLocation.latitudeSecs();
				document.getElementById("fc-zoneinfo-addas-menulist-ew").selectedIndex = this.workingLocation.longitudeIsEast() ? 0 : 1;
				document.getElementById("fc-zoneinfo-addas-textbox-long-deg").value = this.workingLocation.longitudeDegrees();
				document.getElementById("fc-zoneinfo-addas-textbox-long-min").value = this.workingLocation.longitudeMins();
				document.getElementById("fc-zoneinfo-addas-textbox-long-sec").value = this.workingLocation.longitudeSecs();
			}

			if (this.isIconMode)
			{
				// AFM - presumably there's a better way to get text to wrap based on the current size
				// of the window...
				//
				var displayPanel = document.getElementById("fc-zoneinfo-tab-display-tabpanel");
				var displayDescription = document.createElement("description");
				var displayDescriptionData = document.getElementById("fc-zoneinfo-display-description-data");

				displayPanel.appendChild(displayDescription);

				var initWidth = displayDescription.boxObject.width;
				displayDescription.appendChild(document.createTextNode(displayDescriptionData.getAttribute("label")));

				displayDescription.setAttribute("width", initWidth);
			}

			// AFM - set up states of checkboxes etc on display tab
			//
			document.getElementById("fc-zoneinfo-display-showclock-checkbox-statusbar").checked = this.watchlistItem.showClock_statusbar;
			document.getElementById("fc-zoneinfo-display-showclock-checkbox-tooltip").checked = this.watchlistItem.showClock_statusbarTooltip;
			document.getElementById("fc-zoneinfo-display-style-checkbox-bold").checked = this.watchlistItem.bold;
			document.getElementById("fc-zoneinfo-display-style-checkbox-italic").checked = this.watchlistItem.italic;
			document.getElementById("fc-zoneinfo-display-style-checkbox-underline").checked = this.watchlistItem.underline;
			document.getElementById("fc-zoneinfo-display-style-checkbox-flag").checked = this.watchlistItem.showClock_statusbarFlag;
			document.getElementById("fc-zoneinfo-display-style-colour-standard-picker").color = this.watchlistItem.colour;
			document.getElementById("fc-zoneinfo-display-style-colour-alternate-checkbox").checked = this.watchlistItem.altColour_enabled;
			document.getElementById("fc-zoneinfo-display-style-colour-alternate-picker").color = this.watchlistItem.altColour;

			// AFM - set up states of start/end time dropdowns. Not beautiful
			//
			var start_time = this.watchlistItem.altColour_startTime;
			var start_min = start_time%60;
			var start_hour = (start_time - start_min)/60;
			var start_ispm = false;
			if (start_hour >= 12) { start_ispm = true; start_hour -= 12; }

			document.getElementById("fc-zoneinfo-start-hour-list").selectedIndex = start_hour == 0 ? 11 : start_hour - 1;
			document.getElementById("fc-zoneinfo-start-min-list").selectedIndex = start_min/5;

			// AFM - workaround some bug; without deselecting all (-1), we can't set the selected
			// index to be 0. No idea why
			//
			document.getElementById("fc-zoneinfo-start-ampm-list").selectedIndex = -1;
			document.getElementById("fc-zoneinfo-start-ampm-list").selectedIndex = (start_ispm ? 1 : 0);

			var end_time = this.watchlistItem.altColour_endTime;
			var end_min = end_time%60;
			var end_hour = (end_time - end_min)/60;
			var end_ispm = false;
			if (end_hour >= 12) { end_ispm = true; end_hour -= 12; }

			document.getElementById("fc-zoneinfo-end-hour-list").selectedIndex = end_hour == 0 ? 11 : end_hour - 1;
			document.getElementById("fc-zoneinfo-end-min-list").selectedIndex = end_min/5;
			document.getElementById("fc-zoneinfo-end-ampm-list").selectedIndex = -1;
			document.getElementById("fc-zoneinfo-end-ampm-list").selectedIndex = (end_ispm ? 1 : 0);

			document.getElementById("fc-zoneinfo-display-style-custformat-sbar-textbox").value = this.watchlistItem.getStatusbarTimeFormat();
			document.getElementById("fc-zoneinfo-display-style-custformat-tooltip-textbox").value = this.watchlistItem.getTooltipTimeFormat();

			document.getElementById("fc-zoneinfo-custflag-textbox-url").value = this.watchlistItem.customFlagUrl;

			var displayFlagRadioGroup = document.getElementById("fc-zoneinfo-display-flag-radiogroup");

			if (this.watchlistItem.useCustomFlag == true)
				displayFlagRadioGroup.selectedItem = document.getElementById("fc-zoneinfo-display-flag-radio-custom");
			else if (standardFlagRadio.getAttribute("hidden") != "true")
				displayFlagRadioGroup.selectedItem = standardFlagRadio;
			else
				displayFlagRadioGroup.selectedItem = noneFlagRadio;

			// AFM - disable stuff irrelevant to icon mode. We don't bother handling changes to this pref
			//
			document.getElementById("fc-zoneinfo-display-showclock-checkbox-statusbar").setAttribute("disabled", (this.isIconMode ? "true" : "false"));

			var title = document.getElementById("fc-zoneinfo-title-location").getAttribute("label");

			// AFM - workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=256024
			//
			var tabBox = document.getElementById("fc-zoneinfo-tabbox");
			tabBox.selectedIndex = tabBox.getAttribute("selectedtabworkaround");

			if (this.mode == "ZONE")
			{
				title = document.getElementById("fc-zoneinfo-title-zone").getAttribute("label");
				document.documentElement.getButton("cancel").hidden = true; // only informational
				this.applyButton.hidden = true;
				var displayTab = document.getElementById("fc-zoneinfo-tab-display");
				displayTab.hidden = true;

				// AFM - collapsed vs hidden is important here
				//
				document.getElementById("fc-zoneinfo-tab-display-tabpanel").setAttribute("collapsed", "true");

				// AFM - location is non-editable
				//
				document.getElementById("fc-zoneinfo-location-disabled").setAttribute("disabled", "true");

				// AFM - could have persisted display tab when this window opened on location in
				// Watchlist
				//
				if (tabBox.selectedTab == displayTab)
					tabBox.selectedTab = document.getElementById("fc-zoneinfo-tab-location");
			}
			else if (this.mode == "ADD_AS")
			{
				// AFM - show 'Location' tab when adding as
				//
				tabBox.selectedTab = document.getElementById("fc-zoneinfo-tab-location");
				this.applyButton.hidden = true;
			}

			this.acceptButton.focus();

			// AFM - disabled for now
			// TODO - make apply work: need to propagate apply (accept) event to foxclocks window
			//
			this.applyButton.hidden = true;

			document.title = title;
			this.onTabsSelect();
			// this.onFlagSelect(); - AFM - should be triggered above in selecting correct radio
			this.onShowClockCheckboxCommand();
			this.onShowTooltipCheckboxCommand();
			this.setStates();

			/* AFM - commented out - just playing for now

			// q = query
			// iwloc - info window location
			// hl - lang - leave blank
			// z= zoom
			// layer=t Activates the traffic overlay
			// t = "m" map, "k" satellite, "h" hybrid
			// spn - span
			// om - overview map

			/*
			var mapUrl = "https://maps.google.com/maps?om=1&iwloc=addr&f=q&ie=UTF8&ll=" +
			this.workingLocation.getLatitude()  + "," + this.workingLocation.getLongitude() +
			// "&q=" + this.workingLocation.getName() +
			"&z=5";

			mapUrl = encodeURI(mapUrl);

			var mapsIframe = document.getElementById("fc-zoneinfo-location-iframe");
			mapsIframe.setAttribute("src", mapUrl);
			*/

			var flagImagesDir = foxclocks.utils.FC_URL_CHROME_FLAG_IMAGES_DIR;
			var flagImages = foxclocks.utils.getFlagImages();
			var flagContainer = document.getElementById("fc-zoneinfo-display-preset-flag-container");

			var self = this;
			var clickHandler = function(event) { self.setCustomFlagUrl(this.getAttribute('src')); };

			for (var i=0; i < flagImages.length; i++)
			{
				var currFlagImageUrl = flagImagesDir + flagImages[i];

				var currFlagImageElement = document.createElement("image");
				currFlagImageElement.setAttribute("src", currFlagImageUrl);
				currFlagImageElement.setAttribute("tooltiptext", currFlagImageUrl);
				currFlagImageElement.setAttribute("class", "fc-zoneinfo-display-preset-flag");
				currFlagImageElement.addEventListener('click', clickHandler, false);

				flagContainer.appendChild(currFlagImageElement);
			}

			Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService).addObserver(this, "moonclocks", false);
			this.onTimer();
		},

		// ====================================================================================
		onUnload : function()
		{
			// AFM - workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=256024
			//
			var tabBox = document.getElementById("fc-zoneinfo-tabbox");
			tabBox.setAttribute("selectedtabworkaround", tabBox.selectedIndex);

			Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService).removeObserver(this, "moonclocks");
		},

		// ====================================================================================
		latitudeAsLocaleString : function(location)
		{
			// AFM - convert e.g. 52.367 to 52{deg. symbol}22' North
			//
			var latitudeAsString = "";
			if (location.getLatitude() !== null)
			{
				latitudeAsString = location.latitudeDegrees() + foxclocks.utils.FC_DEGREE_SYMBOL + foxclocks.utils.asTwoDigit(location.latitudeMins()) + "'";
				latitudeAsString += " " + (location.latitudeIsNorth() ? this.northAsLocaleString : this.southAsLocaleString);
			}

			return latitudeAsString;
		},

		// ====================================================================================
		longitudeAsLocaleString : function(location)
		{
			// AFM - convert e.g. -52.367 to 52{deg. symbol}22' West
			//
			var longitudeAsString = "";
			if (location.getLongitude() !== null)
			{
				longitudeAsString = location.longitudeDegrees() + foxclocks.utils.FC_DEGREE_SYMBOL + foxclocks.utils.asTwoDigit(location.longitudeMins()) + "'";
				longitudeAsString += " " + (location.longitudeIsEast() ? this.eastAsLocaleString : this.westAsLocaleString);
			}

			return longitudeAsString;
		},

		// ====================================================================================
		onAccept : function()
		{
			this.watchlistItem.showClock_statusbar = document.getElementById("fc-zoneinfo-display-showclock-checkbox-statusbar").checked == true;
			this.watchlistItem.showClock_statusbarTooltip = document.getElementById("fc-zoneinfo-display-showclock-checkbox-tooltip").checked == true;
			this.watchlistItem.bold = document.getElementById("fc-zoneinfo-display-style-checkbox-bold").checked == true;
			this.watchlistItem.italic = document.getElementById("fc-zoneinfo-display-style-checkbox-italic").checked == true;
			this.watchlistItem.underline = document.getElementById("fc-zoneinfo-display-style-checkbox-underline").checked == true;
			this.watchlistItem.showClock_statusbarFlag = document.getElementById("fc-zoneinfo-display-style-checkbox-flag").checked == true;
			this.watchlistItem.colour = document.getElementById("fc-zoneinfo-display-style-colour-standard-picker").color;
			this.watchlistItem.altColour_enabled = document.getElementById("fc-zoneinfo-display-style-colour-alternate-checkbox").checked == true;
			this.watchlistItem.altColour = document.getElementById("fc-zoneinfo-display-style-colour-alternate-picker").color;
			this.watchlistItem.setStatusbarTimeFormat(document.getElementById("fc-zoneinfo-display-style-custformat-sbar-textbox").value);
			this.watchlistItem.setTooltipTimeFormat(document.getElementById("fc-zoneinfo-display-style-custformat-tooltip-textbox").value);

			var start_hour = Number(document.getElementById("fc-zoneinfo-start-hour-list").selectedItem.getAttribute("value"))%12;
			var start_min = Number(document.getElementById("fc-zoneinfo-start-min-list").selectedItem.getAttribute("value"));
			var start_ispm = document.getElementById("fc-zoneinfo-start-ampm-list").selectedItem.getAttribute("value") == "pm";
			this.watchlistItem.altColour_startTime = start_hour * 60 + start_min + (start_ispm ? 720 : 0);

			var end_hour = Number(document.getElementById("fc-zoneinfo-end-hour-list").selectedItem.getAttribute("value"))%12;
			var end_min = Number(document.getElementById("fc-zoneinfo-end-min-list").selectedItem.getAttribute("value"));
			var end_ispm = document.getElementById("fc-zoneinfo-end-ampm-list").selectedItem.getAttribute("value") == "pm";
			this.watchlistItem.altColour_endTime = end_hour * 60 + end_min + (end_ispm ? 720 : 0);

			this.watchlistItem.customFlagUrl = document.getElementById("fc-zoneinfo-custflag-textbox-url").value;

			var displayFlagRadioGroup = document.getElementById("fc-zoneinfo-display-flag-radiogroup");
			this.watchlistItem.useCustomFlag = (displayFlagRadioGroup.selectedItem.getAttribute("id") ==
									"fc-zoneinfo-display-flag-radio-custom");

			// AFM - specifically, location won't be set if the user cancels this dialog
			//
			this.retVals.location = this.workingLocation;
		},

		// ====================================================================================
		// AFM - implementing nsIObserver
		//
		observe : function(subject, topic, data)
		{
			this.onTimer();
		},

		// ====================================================================================
		onTimer : function()
		{
			var nowDate = new Date();
			document.getElementById("fc-zoneinfo-current-time").value = this.timeFormatter.getTimeString(this.workingLocation, nowDate);

			var zone = this.workingLocation.zone;
			var instantInfo = zone.getInstantInfo(nowDate);

			if (zone.dl_start_gmt)
			{
				this.dstBeginLabel.value = (nowDate >= zone.dl_start_gmt ? this.dstBeganText : this.dstBeginsText);

				if (zone.dl_end_gmt !== null)
					this.dstEndLabel.value = (nowDate >= zone.dl_end_gmt ? this.dstEndedText : this.dstEndsText);

				var unstyledValue = instantInfo.is_dst ? this.standardZoneValue : this.daylightZoneValue;
				var styledValue = instantInfo.is_dst ? this.daylightZoneValue : this.standardZoneValue;

				unstyledValue.removeAttribute("class");
				styledValue.setAttribute("class", "foxclocks-curr-zone");
			}

			this.zoneCaption.label = instantInfo !== null ? (this.zoneCaption.getAttribute("initlabel") + ": " + instantInfo.name) : '';
		},

		// ====================================================================================
		onGoogleCmd : function() { foxclocks.utils.openOpenStreetMap(this.workingLocation); },
		onAddAsTextboxNameInput : function() { this.setStates(); },
		onAddAsTextboxLatDegInput : function() { this.setStates(); },
		onAddAsTextboxLatMinInput : function() { this.setStates(); },
		onAddAsTextboxLatSecInput : function() { this.setStates(); },
		onAddAsTextboxLongDegInput : function() { this.setStates(); },
		onAddAsTextboxLongMinInput : function() { this.setStates(); },
		onAddAsTextboxLongSecInput : function() { this.setStates(); },
		onNESWChange : function() { this.setStates(); }, // to update this.workingLocation

		// ====================================================================================
		onTabsSelect : function()
		{
			// AFM - nothing right now
		},

		// ====================================================================================
		onFlagSelect : function()
		{
			// AFM - onselect handlers seem to run before onload, which is disastrous; use this.zoneCaption to test for onLoad() having run
			//
			if (this.zoneCaption == null)
				return;

			this.setStates();

			// AFM - work around window.sizeToContent() failing if previously called when not necessary
			//
			var flagBrowseBox = document.getElementById("fc-zoneinfo-display-flag-custom-browse-box");
			var currFlagBrowseBoxHiddenAtt = flagBrowseBox.getAttribute("hidden");
			if (currFlagBrowseBoxHiddenAtt == null)
				currFlagBrowseBoxHiddenAtt = "false";

			var displayFlagRadioGroup = document.getElementById("fc-zoneinfo-display-flag-radiogroup");
			var customFlagSelected = (displayFlagRadioGroup.selectedItem.getAttribute("id") == "fc-zoneinfo-display-flag-radio-custom");
			var newFlagBrowseBoxHiddenAtt = customFlagSelected ? "false" : "true";

			if (currFlagBrowseBoxHiddenAtt != newFlagBrowseBoxHiddenAtt)
			{
				flagBrowseBox.setAttribute("hidden", newFlagBrowseBoxHiddenAtt);
				window.sizeToContent();
			}
		},

		// ====================================================================================
		onShowClockCheckboxCommand : function()
		{
			var statusbarChecked = document.getElementById("fc-zoneinfo-display-showclock-checkbox-statusbar").getAttribute("checked") == "true";
			var clockStyleEnabled = statusbarChecked && this.isIconMode == false;

			this.enableClockStyle(clockStyleEnabled);

			this.onEnableAltColourCheckboxCommand();
		},

		// ====================================================================================
		onShowTooltipCheckboxCommand : function()
		{
			var showTooltipChecked = document.getElementById("fc-zoneinfo-display-showclock-checkbox-tooltip").getAttribute("checked") == "true";
			var tooltipStyleDisabledBcaster = document.getElementById("fc-zoneinfo-display-style-tooltip-disabled");

			if (showTooltipChecked)
				tooltipStyleDisabledBcaster.removeAttribute("disabled");
			else
				tooltipStyleDisabledBcaster.setAttribute("disabled", "true");
		},

		// ====================================================================================
		onEnableAltColourCheckboxCommand : function()
		{
			var styleEnabled = document.getElementById("fc-zoneinfo-display-style-clock-disabled").getAttribute("disabled") != "true";
			var altChecked = document.getElementById("fc-zoneinfo-display-style-colour-alternate-checkbox").getAttribute("checked") == "true";

			this.enableAltColour(styleEnabled && altChecked);
		},

		// ====================================================================================
		enableClockStyle : function(truth)
		{
			var clockStyleDisabledBcaster = document.getElementById("fc-zoneinfo-display-style-clock-disabled");

			if (truth)
				clockStyleDisabledBcaster.removeAttribute("disabled");
			else
				clockStyleDisabledBcaster.setAttribute("disabled", "true");

			document.getElementById("fc-zoneinfo-display-style-colour-standard-picker").disabled = (truth == false);

			// AFM - special handling for this checkbox: we don't want to stomp on the 'disabled' state set due to
			// unavailable flag
			//
			if (truth == true && !document.getElementById("fc-zoneinfo-display-flag-image").hasAttribute("src"))
				document.getElementById("fc-zoneinfo-display-style-checkbox-flag").disabled = true;
		},

		// ====================================================================================
		enableAltColour : function(truth)
		{
			var colourAltDisabledBcaster = document.getElementById("fc-zoneinfo-display-style-colour-alternate-disabled");

			if (truth)
				colourAltDisabledBcaster.removeAttribute("disabled");
			else
				colourAltDisabledBcaster.setAttribute("disabled", "true");

			document.getElementById("fc-zoneinfo-display-style-colour-alternate-picker").disabled = (truth == false);
		},

		// ====================================================================================
		setCustomFlagUrl : function(flagUrlString)
		{
			document.getElementById("fc-zoneinfo-custflag-textbox-url").value = flagUrlString;
			this.setStates();
		},

		// ====================================================================================
		onCustomFlagBrowseCmd : function()
		{
			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, null, nsIFilePicker.modeOpen);
			fp.appendFilters(nsIFilePicker.filterImages);
			fp.appendFilters(nsIFilePicker.filterAll);

			if (fp.show() != nsIFilePicker.returnOK)
				return;

			try
			{
				var urlString = Components.classes["@mozilla.org/network/protocol;1?name=file"]
					.getService(Components.interfaces.nsIFileProtocolHandler)
					.getURLSpecFromFile(fp.file);

				this.setCustomFlagUrl(urlString);
			}
			catch(ex)
			{
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
				var promptText = "Error: " + ex.message;
				// var promptText = document.getElementById("fc-dialog-import-failure").getAttribute("label") + ": " + ex.message;
				promptService.alert(window, "MoonClocks", promptText);
			}
		},

		// ====================================================================================
		setStates : function()
		{
			// AFM - throw all validation in here
			//
			var locationTab = document.getElementById("fc-zoneinfo-tab-location");
			var locationNameLabel = document.getElementById("fc-zoneinfo-addas-textbox-name-label");
			var latitudeLabel = document.getElementById("fc-zoneinfo-addas-latitude-label");
			var longitudeLabel = document.getElementById("fc-zoneinfo-addas-longitude-label");

			locationTab.removeAttribute("class");
			locationNameLabel.removeAttribute("class");
			latitudeLabel.removeAttribute("class");
			longitudeLabel.removeAttribute("class");

			var textboxLatDeg = document.getElementById("fc-zoneinfo-addas-textbox-lat-deg").value;
			var textboxLatMin = document.getElementById("fc-zoneinfo-addas-textbox-lat-min").value;
			var textboxLatSec = document.getElementById("fc-zoneinfo-addas-textbox-lat-sec").value;
			var textboxLongDeg = document.getElementById("fc-zoneinfo-addas-textbox-long-deg").value;
			var textboxLongMin = document.getElementById("fc-zoneinfo-addas-textbox-long-min").value;
			var textboxLongSec = document.getElementById("fc-zoneinfo-addas-textbox-long-sec").value;

			// AFM - don't want to re-enable these labels if the location tab is non-editable (ie when viewing
			// a location in the Zone Picker)
			//
			var locationTabDisabled = (document.getElementById("fc-zoneinfo-location-disabled").getAttribute("disabled") == "true");
			latitudeLabel.disabled = locationTabDisabled || (textboxLatDeg == "" && textboxLatMin == "" && textboxLatSec == "");
			longitudeLabel.disabled = locationTabDisabled || (textboxLongDeg == "" && textboxLongMin == "" && textboxLongSec == "");

			var textboxNameValid = this.textboxName.value != "";

			if (!textboxNameValid)
				locationNameLabel.setAttribute("class", "foxclocks-errorstate");

			// AFM - represents any error in name/lat/long as entered by user
			//
			var locationError = false;

			if (latitudeLabel.disabled && longitudeLabel.disabled)
			{
				locationError = !textboxNameValid;
			}
			else
			{
				var textboxLatDegValid = foxclocks.utils.FC_REGEXP_VALID_LATDEG.test(textboxLatDeg) && Number(textboxLatDeg) <= 90;
				var textboxLatMinValid = foxclocks.utils.FC_REGEXP_VALID_MIN_SEC.test(textboxLatMin) && Number(textboxLatMin) < 60;
				if (textboxLatDegValid && Number(textboxLatDeg) == 90 && Number(textboxLatMin) > 0)
					textboxLatMinValid = false;
				var textboxLatSecValid = foxclocks.utils.FC_REGEXP_VALID_MIN_SEC.test(textboxLatSec) && Number(textboxLatSec) < 60;
				if (textboxLatDegValid && Number(textboxLatDeg) == 90 && Number(textboxLatSec) > 0)
					textboxLatSecValid = false;

				if (!textboxLatDegValid || !textboxLatMinValid || !textboxLatSecValid)
					latitudeLabel.setAttribute("class", "foxclocks-errorstate");

				var textboxLongDegValid = foxclocks.utils.FC_REGEXP_VALID_LONGDEG.test(textboxLongDeg) && Number(textboxLongDeg) <= 180;
				var textboxLongMinValid = foxclocks.utils.FC_REGEXP_VALID_MIN_SEC.test(textboxLongMin) && Number(textboxLongMin) < 60;
				if (textboxLongDegValid && Number(textboxLongDeg) == 180 && Number(textboxLongMin) > 0)
					textboxLongMinValid = false;
				var textboxLongSecValid = foxclocks.utils.FC_REGEXP_VALID_MIN_SEC.test(textboxLongSec) && Number(textboxLongSec) < 60;
				if (textboxLongDegValid && Number(textboxLongDeg) == 180 && Number(textboxLongSec) > 0)
					textboxLongSecValid = false;

				if (!textboxLongDegValid || !textboxLongMinValid || !textboxLongSecValid)
					longitudeLabel.setAttribute("class", "foxclocks-errorstate");

				locationError = !(	textboxLatDegValid && textboxLatMinValid && textboxLatSecValid &&
									textboxLongDegValid && textboxLongMinValid && textboxLongSecValid &&
									textboxNameValid);
			}

			if (!locationError)
			{
				this.workingLocation.setName(this.textboxName.value);

				if (textboxLatDeg != "" && textboxLatMin != "" && textboxLatSec != "")
				{
					var isNorth = document.getElementById("fc-zoneinfo-addas-menulist-ns").selectedItem.getAttribute("value") == "N";
					this.workingLocation.setLatitude(
						(Number(textboxLatDeg) + Number(textboxLatMin)/60 + Number(textboxLatSec)/3600) * (isNorth ? 1 : -1));
				}
				else
					this.workingLocation.setLatitude(null);

				if (textboxLongDeg != "" && textboxLongMin != "" && textboxLongSec != "")
				{
					var isEast = document.getElementById("fc-zoneinfo-addas-menulist-ew").selectedItem.getAttribute("value") == "E";
					this.workingLocation.setLongitude(
						(Number(textboxLongDeg) + Number(textboxLongMin)/60 + Number(textboxLongSec)/3600) * (isEast ? 1 : -1));
				}
				else
					this.workingLocation.setLongitude(null);

				var currLocation = document.getElementById("fc-zoneinfo-currentlocation-caption");
				currLocation.label = this.workingLocation.getName();

				if (this.workingLocation.getLatitude() != null && this.workingLocation.getLongitude() != null)
				{
					currLocation.label += " (" + this.latitudeAsLocaleString(this.workingLocation) + ", ";
					currLocation.label += this.longitudeAsLocaleString(this.workingLocation) + ")";
				}
			}
			else
			{
				locationTab.setAttribute("class", "foxclocks-errorstate");
			}

			var displayFlagRadioGroup = document.getElementById("fc-zoneinfo-display-flag-radiogroup");
	 		var flagImage = document.getElementById("fc-zoneinfo-display-flag-image");
			var showFlagCheckbox = document.getElementById("fc-zoneinfo-display-style-checkbox-flag");
			var customFlagUrlTextBox = document.getElementById("fc-zoneinfo-custflag-textbox-url");

			var flagUrlString = "";
			if (displayFlagRadioGroup.selectedItem.getAttribute("id") == "fc-zoneinfo-display-flag-radio-custom")
				flagUrlString = customFlagUrlTextBox.value;
			else if (displayFlagRadioGroup.selectedItem.getAttribute("id") == "fc-zoneinfo-display-flag-radio-standard")
				flagUrlString = this.workingLocation.zone.getFlagUrl();

			if (foxclocks.utils.isUriAvailable(flagUrlString))
			{
				flagImage.setAttribute("src", flagUrlString);
				flagImage.setAttribute("tooltiptext", flagUrlString);

				if (!document.getElementById("fc-zoneinfo-display-style-clock-disabled").hasAttribute("disabled"))
					showFlagCheckbox.disabled = false;
			}
			else
			{
				flagImage.removeAttribute("src");
				flagImage.removeAttribute("tooltiptext");
				showFlagCheckbox.disabled = true;
			}

			var customFlagError = displayFlagRadioGroup.selectedItem.getAttribute("id") ==
									"fc-zoneinfo-display-flag-radio-custom" && !flagImage.hasAttribute("src");

			if (customFlagError)
				customFlagUrlTextBox.setAttribute("class", "foxclocks-errorstate");
			else
				customFlagUrlTextBox.removeAttribute("class");

			this.acceptButton.disabled = locationError || customFlagError;
			this.applyButton.disabled = locationError || customFlagError;

			if (this.workingLocation.getLatitude() != null && this.workingLocation.getLongitude() != null)
				this.googleEarthButton.disabled = locationError;
			else
				this.googleEarthButton.disabled = true;
		}
	};

	// ====================================================================================
	var zoneManager = window.arguments[0];
	var mode = window.arguments[1];
	var watchlistItem = window.arguments[2];
	var retVals = window.arguments[3];

	root.foxclocks.zoneInfo = new ZoneInfo(zoneManager, mode, watchlistItem, retVals);

})(this);