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
