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

const cooldownTime = config.cooldownTime || 15;
const flashTime = config.flashTime || 100;
const blinkInterval = config.blinkInterval || 2000;
const sleepTimeout = cooldownTime * 60 * 1000;

const db = new PouchDB(config.dbPath || 'db');

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

function flash(time) {
  led.writeSync(1);
  setTimeout(() => led.writeSync(0), time);
}

function blinkN(times, interval) {
  if (!times) return;
  flash(flashTime);
  setTimeout(() => {
    blinkN(times-1, interval);
  }, interval);
}

function startBlink() {
  blinker = setInterval(() => {
    flash(flashTime);
  }, blinkInterval);
}

function stopBlink() {
  if (blinker) {
    clearInterval(blinker);
    blinker = null;
  }
}

function logEvent(data) {
  const timestamp = (new Date()).getTime();
  data._id = 'event:' + timestamp;
  return db.put(data).catch(error => {
    console.log(error);
  });
}

function setState(code) {
  console.log(code);
  logEvent({type: code});
  state = code;
}

const button = new BigRedButton(0);

button.on('buttonReleased', function () {
  console.log('button pressed', state);
  if (state == 'IN_BED' || state == 'SLEEPING' || state == 'AWAKE') {
    if (state == 'SLEEPING') {
      setState('AWAKE');
    }
    // reset sleep timeout
    stopBlink();
    if (sleepTimer) clearTimeout(sleepTimer);
    console.log('sleeping in', cooldownTime, 'minutes');
    sleepTimer = setTimeout(() => {
      // in 15 minutes, set state to SLEEPING
      startBlink();
      setState('SLEEPING');
    }, sleepTimeout);
  }
});

button.on('lidRaised', function () {
  setState('IN_BED');
  blinkN(3, 250);
});

button.on('lidClosed', function () {
  setState('OUT_OF_BED');
});

button.on('error', function (error) {
  console.error(error);
});


process.on('SIGINT', () => {
  console.log('\nreceived SIGINT')
  led.unexport();
  //button.unexport();
  console.log('exiting');
  return process.exit();
});
