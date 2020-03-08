const moment = require('moment');
const utils = require('./utils');
const config = require('./config')
const PouchModel = require('./pouchdb-model').PouchModel;
const db = require('./db').getDatabase();

PouchModel.setDatabase(db);

config.minSleepTime = config.minSleepTime || 20;

class Event extends PouchModel {
  static fields = {
    entryId: null,
    timestamp: null,
    type: null
  }

  newId() {
    return Event.prefix + this.timestamp;
  }

  get date() {
    if (this.timestamp) {
      return utils.getBedtimeDate(this.timestamp, config.cutoffHour).getTime();
    }
  }
}

class Entry extends PouchModel {
  static fields = {
    events: _ => [],
    date: null,
    fallAsleepTime: null,
    inBedTime: null,
    sleepStartTime: null,
    fallAsleepTime: null,
    firstAwakeningTime: null,
    wakeUpTime: null,
    outOfBedTime: null,
    timeInBed: null,
    timeAsleep: null,
    timeAwakened: null,
    numAwakenings: null
  }

  get dateStr() {
    if (this.date) {
      return moment(this.date).format('YYYY-MM-DD')
    }
  }

  get events() {
    if (!super.events) {
      return [];
    }
    return super.events.map(doc => new Event(doc));
  }

  set events(events) {
    super.events = events.map(event => event.__doc);
  }

  get serializedEvents() {
    return JSON.stringify(this.__doc.events, null, 2);
  }

  newId() {
    return Entry.prefix + this.dateStr;
  }

  static cleanEvents(events) {
    let newEvents = [];
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
      newEvents.push(event);
    }
    return newEvents;
  }

  updateStats() {
    const events = this.events;
    let date, inBedTime, sleepStartTime, fallAsleepTime, firstAwakeningTime, wakeUpTime, outOfBedTime;
    let timeInBed = 0, timeAsleep = 0, numAwakenings = 0, timeAwakened = 0;

    // Loop through cleaned events and calculate stats
    let lastAwakening;
    for (let i=0; i<events.length; i++) {
      let event = events[i];
      let nextEvent = events[i+1];
      let lastEvent = events[i-1];

      if (lastEvent) {
        event.duration = event.timestamp - lastEvent.timestamp;
      }

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
    }

    this.fallAsleepTime = fallAsleepTime;
    this.inBedTime = inBedTime;
    this.sleepStartTime = sleepStartTime;
    this.fallAsleepTime = fallAsleepTime;
    this.firstAwakeningTime = firstAwakeningTime;
    this.wakeUpTime = wakeUpTime;
    this.outOfBedTime = outOfBedTime;
    this.timeInBed = timeInBed;
    this.timeAsleep = timeAsleep;
    this.timeAwakened = timeAwakened;
    this.numAwakenings = numAwakenings;
    this.date = utils.getBedtimeDate(events[0].timestamp, config.cutoffHour);
  }

  async delete() {
    // unset entryId on all objects associated with this entry
    const events = await Event.objects.find({selector: {entryId: this._id}});
    for (let i=0; i<events.length; i++) {
      events[i].entryId = null;
      await events[i].save();
    }
    return super.delete();
  }
}

module.exports.Event = Event;
module.exports.Entry = Entry;