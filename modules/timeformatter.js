/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components */

// ====================================================================================
(function(root, factory) {
	"use strict";

	let EXT_URL_MODULE_DIR = 'chrome://moonclocks-modules/content/'; // resource://moonclocks/

	let utils =		(Components.utils.import(EXT_URL_MODULE_DIR + "utils.js", {})).FoxClocks_Utils;

	utils.exportSymbols(root, factory(Components, utils.console, utils));

}(this,

// ====================================================================================
function(Components, console, utils) {
	"use strict";

	// ====================================================================================
	let CI = Components.interfaces, CC = Components.classes;

	var _formatFunctions = {};
	var _formatsRegexp = /(?:)/;

	(function() { // AFM - static init

		var bundleHash = {};
		var bundleEnum =  CC["@mozilla.org/intl/stringbundle;1"].getService(CI.nsIStringBundleService).createBundle("chrome://moonclocks/locale/foxclocks.properties").getSimpleEnumeration();
		while (bundleEnum.hasMoreElements())
		{
			var bundlePropElt = bundleEnum.getNext().QueryInterface(CI.nsIPropertyElement);
			bundleHash[bundlePropElt.key] = bundlePropElt.value;
		}

		var amLower = bundleHash['misc.am.lower'];
		var pmLower = bundleHash['misc.pm.lower'];
		var amUpper = bundleHash['misc.am.upper'];
		var pmUpper = bundleHash['misc.pm.upper'];
		var monthNameLongArray = bundleHash['misc.list.month.name.long'].split(',');
		var monthNameShortArray = bundleHash['misc.list.month.name.short'].split(',');
		var dayNameLongArray = bundleHash['misc.list.day.name.long'].split(',');
		var dayNameShortArray = bundleHash['misc.list.day.name.short'].split(',');
		var dayOrdinalArray = bundleHash['misc.list.day.ordinal'].split(',');
		var defaultLocation = bundleHash['misc.default.location'];
		var defaultOffset = bundleHash['misc.default.offset'];
		var defaultZoneName = bundleHash['misc.default.zonename'];

		// May not exist
		//
		var dayRelativeArray = bundleHash['misc.list.day.relative'] ? bundleHash['misc.list.day.relative'].split(',') : ['?', '?', '?'];
		var defaultDayRelativeString = bundleHash['options.format.custom.day.relative.label'] ? '[' + bundleHash['options.format.custom.day.relative.label'] + ']' : '?';
		var defaultAlignmentPosition = bundleHash['misc.default.alignpos'] ? bundleHash['misc.default.alignpos'] : '?';

		var formatLocaleConfig = {
			'secs': function(date) { return utils.asTwoDigit(date.getUTCSeconds()); },
			'mins': function(date) { return utils.asTwoDigit(date.getUTCMinutes()); },
			'hours.12.1': function(date) { return utils.as12hr(date.getUTCHours()); },
			'hours.12.2': function(date) { return utils.asTwoDigit(utils.as12hr(date.getUTCHours())); },
			'hours.24.1': function(date) { return date.getUTCHours(); },
			'hours.24.2': function(date) { return utils.asTwoDigit(date.getUTCHours()); },
			'am.lower': function(date) { return date.getUTCHours() < 12 ? amLower : pmLower; },
			'am.upper': function(date) { return date.getUTCHours() < 12 ? amUpper : pmUpper; },
			'year.4': function(date) { return date.getUTCFullYear(); },
			'year.2': function(date) { return date.getUTCFullYear().toString().substr(2, 2); },
			'month.num.1': function(date) { return date.getUTCMonth() + 1; },
			'month.num.2': function(date) { return utils.asTwoDigit(date.getUTCMonth() + 1); },
			'month.name.long': function(date) { return monthNameLongArray[date.getUTCMonth()]; },
			'month.name.short': function(date) { return monthNameShortArray[date.getUTCMonth()]; },
			'day.num.1': function(date) { return date.getUTCDate(); },
			'day.num.2': function(date) { return utils.asTwoDigit(date.getUTCDate()); },
			'day.name.long': function(date) { return dayNameLongArray[date.getUTCDay()]; },
			'day.name.short': function(date) { return dayNameShortArray[date.getUTCDay()]; },
			'day.ordinal':function(date) { return dayOrdinalArray[date.getUTCDate() - 1]; },
			'day.ofyear': function(date) { return _getDayOfYear(date); },
			'day.ofyear.3': function(date) { return utils.asThreeDigit(_getDayOfYear(date)); },
			'day.relative': _makeFormatDayRelativeFunction(dayRelativeArray, defaultDayRelativeString),
			'day.relative.numeric': _makeFormatDayRelativeFunction(['-1', '', '+1'], '[-1/+1]'),
			'other.location': function(date, instantInfo, location) { if (location) return location.getName(); else return defaultLocation; },
			'other.offset': function(date, instantInfo) { if (instantInfo) return utils.getZoneOffsetString(instantInfo.offset_mins); else return defaultOffset; },
			'other.zone': function(date, instantInfo) { if (instantInfo) return instantInfo.name; else return defaultZoneName; },
			'other.dstindic': function(date, instantInfo) { if (instantInfo) return (instantInfo.is_dst ? "*" : ""); else return '[*]'; },
			'other.alignpos': function(date, instantInfo) { return instantInfo ? "\t" : defaultAlignmentPosition; },
			'week.iso.1': function(date) { return _getISOWeekNumber(date); },
			'week.iso.2': function(date) { return utils.asTwoDigit(_getISOWeekNumber(date)); },
			'week.na.1': function(date) { return _getNAWeekNumber(date); },
			'week.na.2': function(date) { return utils.asTwoDigit(_getNAWeekNumber(date)); }
		};

		var formatsRegexpString = "";

		var localeConfigKeys = Object.keys(formatLocaleConfig);
		for (var j=0; j < localeConfigKeys.length; j++)
		{
			var localeConfigKey = localeConfigKeys[j];
			var placeholderKey = 'options.format.custom.' + localeConfigKey + '.value';

			var placeholder = bundleHash[placeholderKey];

			if (typeof(placeholder) === 'undefined')
			{
				console.warn("foxclocks.TimeFormatter::init(): skipping untranslated placeholder", placeholderKey);
				continue;
			}

			_formatFunctions[placeholder] = formatLocaleConfig[localeConfigKey];

			if (formatsRegexpString !== '')
				formatsRegexpString += '|';

			formatsRegexpString += placeholder;
		}

		_formatsRegexp = new RegExp(formatsRegexpString, 'g');
	})();

	// ====================================================================================
	function TimeFormatter(formatString)
	{
		this.formatArray = [];
		this.setTimeFormat(formatString);
	}

	// ====================================================================================
	TimeFormatter.prototype =
	{
		getTimeString: function(location, date) { return _getTimeString(location, date, this.formatArray); },
		setTimeFormat: function(formatString) { this.formatArray = _createFormatArray(formatString); }
	};

	// ====================================================================================
	TimeFormatter.getTimeStringFromFormat = function(location, date, formatString) { return _getTimeString(location, date, _createFormatArray(formatString)); };
	TimeFormatter.getUTCTimeStringFromFormat = function(date, formatString) { return _getTimeString(null, date, _createFormatArray(formatString)); };
	TimeFormatter.getLocalTimeStringFromFormat = function(date, formatString) { return _getTimeString(null, date, _createFormatArray(formatString), true); };

	// ====================================================================================
	var _getTimeString = function(location, date, formatArray, defaultToLocal)
	{
		var timeString = "";

		if (formatArray.length > 0)
		{
			var instantInfo = null;
			var offset_mins = null;

			if (location !== null)
			{
				instantInfo = location.zone.getInstantInfo(date);

				if (instantInfo !== null)
					offset_mins = instantInfo.offset_mins;
			}
			else if (defaultToLocal === true)
			{
				offset_mins = -1 * date.getTimezoneOffset();
			}
			else
			{
				offset_mins = 0;
			}

			if (offset_mins !== null)
			{
				var adjDate = new Date(date.getTime() + offset_mins * 1000 * 60);

				for (var i=0; i < formatArray.length; i++)
				{
					var format = formatArray[i];
					timeString += typeof(format) === 'function' ? format(adjDate, instantInfo, location) : format;
				}
			}
		}

		return timeString;
	};

	// ====================================================================================
	var _createFormatArray = function(formatString)
	{
		var formatArray = [];

		if (typeof(formatString) === 'string')
		{
			var nextMatchIndex = 0;

			formatString.replace(_formatsRegexp, function(str, p1, p2, offset, s) {
				if (nextMatchIndex < p1)
				{
					var unmatchedText = formatString.substr(nextMatchIndex, (p1 - nextMatchIndex));
					formatArray.push(unmatchedText);
				}
				formatArray.push(_formatFunctions[str]);

				nextMatchIndex = p1 + str.length;
			});

			// AFM - check for text after the last match
			//
			if (nextMatchIndex <= formatString.length - 1)
				formatArray.push(formatString.substr(nextMatchIndex));
		}

		return formatArray;
	};

	// ====================================================================================
	function _getDayOfYear(date)
	{
		var DAYS_IN_MONTH_NORMAL = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		var DAYS_IN_MONTH_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

		var month = date.getUTCMonth();
		var year = date.getUTCFullYear();

		var isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 !== 0);
		var monthArray = isLeapYear ? DAYS_IN_MONTH_LEAP : DAYS_IN_MONTH_NORMAL;

		var dayOfYear = date.getUTCDate();
		for (var i=0; i < month; i++)
		{
			dayOfYear += monthArray[i];
		}

		return dayOfYear;
	}

	// ====================================================================================
	function _getISOWeekNumber(date)
	{
		// AFM - Note transform to Monday-based day of week
		//
		var thurSameWeek = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);

		var firstThurYear = new Date(thurSameWeek.getUTCFullYear(), 0, 4); // Note we use thurSameWeek's year
		firstThurYear.setDate(firstThurYear.getUTCDate() - ((firstThurYear.getUTCDay() + 6) % 7) + 3);

		return Math.ceil((thurSameWeek - firstThurYear) / 604800000) + 1;
	}

	// ====================================================================================
	function _getNAWeekNumber(date)
	{
		var firstDayOfYear = new Date(date.getUTCFullYear(), 0, 1);
		return Math.ceil((((date - firstDayOfYear) / 86400000) + firstDayOfYear.getUTCDay() + 1) / 7);
	}

	//====================================================================================
	function _makeFormatDayRelativeFunction(dayRelativeArray, defaultString)
	{
		return function(date, location)
		{
			if (!location)
				return defaultString;

			var nowDate = new Date();
			var dateDayNumber = Math.floor(date.getTime()/86400000);
			var localDayNumber = Math.floor((nowDate.getTime() - nowDate.getTimezoneOffset() * 1000 * 60)/86400000);

			return dateDayNumber === localDayNumber ? '' : (dateDayNumber < localDayNumber ? dayRelativeArray[0] : dayRelativeArray[2]);
		};
	}

	// ====================================================================================
	return [{name: 'FoxClocks_TimeFormatter', constructor: TimeFormatter, is_service: false}];

}));