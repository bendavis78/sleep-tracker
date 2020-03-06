const db = require('./db').getDatabase();
const moment = require('moment');
const config = require('./config.json');

config.minSleepTime = config.minSleepTime || 20;


function getBedtimeDate(dateval) {
  let datetime = dateval;
  if (!(datetime instanceof Date)) {
    datetime = new Date(datetime);
    if (isNaN(datetime.getTime())) {
      throw new Error('invalid date:', datetime);
    }
  }
  const cutoff = config.cutoffHour || 12;
  if (datetime.getHours() < cutoff) {
    datetime.setDate(datetime.getDate() - 1);
  }
  datetime.setHours(0);
  datetime.setMinutes(0);
  datetime.setSeconds(0);
  datetime.setMilliseconds(0);
  return datetime;
}

function setStats(entry, events) {
  let inBedTime, sleepStartTime, fallAsleepTime, firstAwakeningTime, wakeUpTime, outOfBedTime;
  let timeInBed = 0, timeAsleep = 0, numAwakenings = 0, timeAwakened = 0;
  entry.events = [];

  // IN_BED -> SLEEP_START -> SLEEPING -> [AWAKE,  SLEEPING]* -> AWAKE -> OUT_OF_BED

  // Clean events
  for (let i=0; i<events.length; i++) {
    let event = events[i];
    let nextEvent = events[i+1];
    let lastEvent = events[i-1];
    if (event.type == 'SLEEPING') {
      // don't count sleep times less than config.minSleepTime
      let thisTimeAsleep = nextEvent.timestamp - event.timestamp;
      if (thisTimeAsleep < config.minSleepTime * 60 * 1000) {
        // don't count this event
        continue;
      }
    } else if (event.type == 'AWAKE') {
      if (lastEvent && lastEvent.skipped) {
        // last sleep event wasn't counted, so we don't count the awakening.
        continue;
      }
    }

    entry.events.push(event);
  }

  // Loop through cleaned events and calculate stats
  let lastAwakening;
  for (let i=0; i<entry.events.length; i++) {
    let event = entry.events[i];
    let nextEvent = entry.events[i+1];
    let lastEvent = entry.events[i-1];
    if (event.type == 'IN_BED') {
      inBedTime = event.timestamp;
    } else if (event.type == 'SLEEP_START') {
      sleepStartTime = event.timestamp;
    } else if (event.type == 'SLEEPING') {
      if (!fallAsleepTime) fallAsleepTime = event.timestamp;
      timeAsleep += nextEvent.timestamp - event.timestamp;
    } else if (event.type == 'AWAKE') {
      if (!firstAwakeningTime) firstAwakeningTime = event.timestamp;
      if (nextEvent.type == 'SLEEPING') {
        timeAwakened += nextEvent.timestamp - event.timestamp;
        numAwakenings += 1;
      }
    } else if (event.type == 'OUT_OF_BED') {
      outOfBedTime = event.timestamp;
      timeInBed = event.timestamp - inBedTime;
      if (lastEvent.type == 'AWAKE') {
        wakeUpTime = lastEvent.timestamp;
      } else {
        // if awake event was not fired before out-of-bed, use out-of-bed as wake-up time
        if (!wakeUpTime) wakeUpTime = event.time;
      }
    }
   
    lastEntryEvent = event;
  }

  entry.fallAsleepTime = fallAsleepTime;
  entry.inBedTime = inBedTime;
  entry.sleepStartTime = sleepStartTime;
  entry.fallAsleepTime = fallAsleepTime;
  entry.firstAwakeningTime = firstAwakeningTime;
  entry.wakeUpTime = wakeUpTime;
  entry.outOfBedTime = outOfBedTime;
  entry.timeInBed = timeInBed;
  entry.timeAsleep = timeAsleep;
  entry.timeAwakened = timeAwakened;
  entry.numAwakenings = numAwakenings;

  return entry;
}

async function createEntry(events) {
  const entry = {};
  entry.date = getBedtimeDate(events[0].timestamp).getTime();
  entry._id = 'entry:' + moment(entry.date).format('YYYY-MM-DD'),
  setStats(entry, events);
  const entryRecord = await db.put(entry);
  for (var i=0; i<events.length; i++) {
    events[i].entryId = entryRecord.id;
    await db.put(events[i]);
  }
  return entryRecord;
}

async function deleteEntry(entry) {
  // get all objects associated with this entry
  const result = await db.find({
    selector: { entryId: entry._id }
  });
  const events = result.docs;
  for (let i=0; i<events.length; i++) {
    events[i].entryId = null;
    await db.put(events[i]);
  }
  return await db.remove(entry);
}

module.exports.getBedtimeDate = getBedtimeDate;
module.exports.createEntry = createEntry;
module.exports.deleteEntry = deleteEntry;
