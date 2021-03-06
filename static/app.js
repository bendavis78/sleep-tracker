(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.App = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * These functions will also be available to the web client
 */
module.exports.getBedtimeDate = (dateval, cutoffHour) => {
  cutoffHour = cutoffHour || 12;
  let datetime = dateval;
  if (!(datetime instanceof Date)) {
    datetime = new Date(datetime);
    if (isNaN(datetime.getTime())) {
      throw new Error('invalid date:', datetime);
    }
  }
  if (datetime.getHours() < cutoffHour) {
    datetime.setDate(datetime.getDate() - 1);
  }
  datetime.setHours(0);
  datetime.setMinutes(0);
  datetime.setSeconds(0);
  datetime.setMilliseconds(0);
  return datetime;
}

module.exports.getBedtimeRange = (dateval, cutoffHour) => {
  cutoffHour = cutoffHour || 12;
  let datetime = dateval;
  if (!(datetime instanceof Date)) {
    datetime = new Date(datetime);
    if (isNaN(datetime.getTime())) {
      throw new Error('invalid date:', datetime);
    }
  }
  const starttime = new Date(dateval);
  const endtime = new Date(dateval);
  starttime.setHours(cutoffHour);
  endtime.setDate(endtime.getDate() + 1);
  endtime.setHours(cutoffHour);
  endtime.setMinutes(endtime.getMinutes() - 1);
  return [starttime, endtime];
}

module.exports.formatDuration = (duration) => {
  const seconds = Math.round(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) {
    str = Math.floor(hours) + 'h';
    if (minutes % 60 != 0) str += ' ' + (minutes % 60) + 'm'
    return str
  }
  if (minutes >= 1) {
    str = minutes + 'm';
    if (seconds % 60 != 0) str += ' ' + (seconds % 60) + 's';
    return str
  }
  return seconds + 's';
}

module.exports.seconds = n => n * 1000;
module.exports.minutes = n => n * module.exports.seconds(60);
module.exports.hours = n => n * module.exports.minutes(60);
module.exports.days = n => n * module.exports.hours(24);

},{}]},{},[1])(1)
});
