/**
 * Useful links
 * https://www.npmjs.com/package/onoff#leds-and-buttons
 * https://pi4j.com/1.2/pins/model-3b-rev1.html
 * https://www.cl.cam.ac.uk/projects/raspberrypi/tutorials/robot/buttons_and_switches/
 * http://led.linear1.org/1led.wiz
 * https://www.electronics-tutorials.ws/diode/diode_8.html
 */

const config = require('./button-config.json');
const Gpio = require('onoff').Gpio;
const BigRedButton = require('big-red-button').BigRedButton;
const PouchDB = require('pouchdb');

// default config values
const dbPath = config.dbPath || 'db';
const cooldownTime = config.cooldownTime || 15;
const flashTime = config.flashTime || 100;
const blinkInterval = config.blinkInterval || 2000;
const sleepTimeout = cooldownTime * 60 * 1000;

console.log('Using database:', dbPath);
const db = new PouchDB(dbPath);

let remote = null;
if (config.remote) {
  console.log('Syncing to ', config.remote);
  let remote = PouchDB(config.remote);
  const replicateOpts = {
    live: true,
    retry: true
  }
  db.replicate.to(remote, replicateOpts)
    .on('complete', change => console.log('replication complete'))
    .on('error', error => console.error('Error while syncing to remote: ' + error));
}

console.log('Setting up led on pin', config.ledPin);
const led = new Gpio(config.ledPin, 'out');

/*
const debounceTimeout = config.debounceTimeout || 10;
const button = new Gpio(config.buttonPin, 'in', 'both', {debounceTimeout: debounceTimeout});
console.log('Setting up button on pin', config.buttonPin, 'with timeout', debounceTimeout);
button.watch((err, value) => {
  console.log(new Date(), 'button ', value);
  if (err) throw err;
  led.writeSync(value);
});
*/

let state = null;
let blinker = null;
let sleepTimer = null;

/**
 * Trun LED on for a specified amount of time then turn off
 */
function flash(time) {
  led.writeSync(1);
  setTimeout(() => led.writeSync(0), time);
}

/**
 * Blink LED N times at the given interval
 */
function blinkN(times, interval) {
  if (!times) return;
  flash(flashTime);
  setTimeout(() => {
    return blinkN(times-1, interval);
  }, interval);
}

/**
 * Start blinking the LED
 */
function startBlink() {
  blinker = setInterval(() => {
    flash(flashTime);
  }, blinkInterval);
}

/**
 * Stop blinking the LED
 */
function stopBlink() {
  if (blinker) {
    clearInterval(blinker);
    blinker = null;
  }
}

/**
 * Log an event to the database
 */
async function logEvent(data) {
  const timestamp = (new Date()).getTime();
  data._id = 'event:' + timestamp;
  data.timestamp = timestamp;
  data.entryId = null;
  await db.put(data).catch(error => {
    console.log(error);
  });
}

/**
 * Change the current state and log it to the database
 */
async function setState(code) {
  console.log(code);
  state = code;
  await logEvent({type: code});
}

const button = new BigRedButton(0);

/**
 * IN_BED -> SLEEP_START -> SLEEPING -> [AWAKE,  SLEEPING]* -> AWAKE -> OUT_OF_BED
 */
button.on('buttonReleased', () => {
  if (state == 'IN_BED' || state == 'SLEEPING' || state == 'AWAKE') {
    if (state == 'SLEEPING') {
      setState('AWAKE');
    }
    if (state == 'IN_BED') {
      setState('SLEEP_START')
    }
    // reset sleep timeout
    stopBlink();
    if (sleepTimer) clearTimeout(sleepTimer);

    // blink the light to indicate we've pressed the button
    blinkN(2, 250);

    console.log('button pressed, sleeping in', cooldownTime, 'minutes');
    sleepTimer = setTimeout(() => {
      // in 15 minutes, set state to SLEEPING
      startBlink();
      setState('SLEEPING');
    }, sleepTimeout);
  }
});

button.on('lidRaised', () => {
  setState('IN_BED');
  blinkN(3, 250);
});

button.on('lidClosed', () => {
  setState('OUT_OF_BED');
  if (sleepTimer) clearTimeout(sleepTimer);
});

button.on('error', error => {
  console.error(error);
});

process.on('SIGINT', () => {
  console.log('\nreceived SIGINT')
  led.unexport();
  //button.unexport();
  console.log('exiting');
  return process.exit();
});
