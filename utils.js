const db = require('./db').getDatabase();
const moment = require('moment');
const config = require('./config.json');


function getBedtimeDate(datetime) {
  if (!(datetime instanceof Date)) {
    datetime = new Date(datetime);
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
  let inBedTime, sleepStartTime, fallAsleepTime, wakeUpTime, outOfBedTime;
  let timeInBed = 0, timeAsleep = 0, numAwakenings = 0, timeAwakened = 0;
  let lastEvent = {type: null};

  // IN_BED -> SLEEP_START -> SLEEPING -> [AWAKE,  SLEEPING]* -> AWAKE -> OUT_OF_BED
  events.forEach(event => {
    if (lastEvent.type == 'SLEEPING') {
      timeAsleep += event.timestamp - lastEvent.timestamp;
    } else if (lastEvent.type == 'AWAKE') {
      timeAwakened += (event.timestamp - lastEvent.timestamp);
    }

    if (event.type == 'IN_BED') {
      inBedTime = event.timestamp;
    } else if (event.type == 'SLEEP_START') {
      sleepStartTime = event.timestamp;
    } else if (event.type == 'SLEEPING') {
      if (!fallAsleepTime) fallAsleepTime = event.timestamp;
    } else if (event.type == 'AWAKE') {
      numAwakenings += 1;
    } else if (event.type == 'OUT_OF_BED') {
      outOfBedTime = event.timestamp;
      timeInBed = event.timestamp - inBedTime;
      if (lastEvent.type == 'AWAKE') {
        // final awakening does not count toward numAwakenings
        numAwakenings -= 1;
        wakeUpTime = lastEvent.timestamp;
      } else {
        // if awake event was not fired before out-of-bed, use out-of-bed as wake-up time
        if (!wakeUpTime) wakeUpTime = event.time;
      }
    }
    lastEvent = event;
  });

  entry.fallAsleepTime = fallAsleepTime;
  entry.inBedTime = inBedTime;
  entry.sleepStartTime = sleepStartTime;
  entry.fallAsleepTime = fallAsleepTime;
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

async function deleteEntry(entryId) {
  // get all objects associated with this entry
  const entry = await db.get(entryId);
  events = await db.find({
    selector: { entryId: entryId }
  }).docs
  for (let i=0; i<events.length; i++) {
    events[i].entryId = null;
    await db.put(events[i]);
  }
  return await db.remove(entry);
}

module.exports.getBedtimeDate = getBedtimeDate;
module.exports.createEntry = createEntry;
module.exports.deleteEntry = deleteEntry;
