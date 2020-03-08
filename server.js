const fs = require('fs');
const path = require('path');
const browserify = require('browserify');
const express = require('express');
const bodyParser = require('body-parser');
const NamedRouter = require('named-routes');
const debugMiddleware = require('debug-error-middleware');
const nunjucks = require('nunjucks');
const moment = require('moment');
const expressPouchDB = require('express-pouchdb');

const config = require('./config');
const utils = require('./utils');
const database = require('./db');
const {Event, Entry} = require('./models');

config.pouch = config.pouch || {};
config.pouch.logPath = config.pouch.logPath || '/tmp/' + config.dbName + '.pouchdb.log';
config.pouch.configPath = config.pouch.configPath || '/tmp/' + config.dbName + '-pouchdb-config.json';

const dirname = path.dirname(process.argv[1]);

const PouchServer = expressPouchDB(database.PouchDB, config.pouch);

const STATIC_DIR = path.join(dirname, 'static');
const TEMPLATES_DIR = path.join(dirname, 'templates')

config.port = config.port || 3000;
config.locale = config.locale || 'en-US';
config.prefix = config.prefix || '/';

moment.locale(config.locale);

const app = express();
const router = express.Router();
const urls = new NamedRouter();
urls.extendExpress(router);

if (config.debug) {
  app.use(debugMiddleware.express());
}

const template = nunjucks.configure(TEMPLATES_DIR, {
  noCache: true,
  autoescape: true,
  express: app
});

// log requests
app.use(function(req, res, next) {
  console.log(`${req.method} ${req.path}`);
  next();
});

// default context
function getContext(req, res) {
  return {};
}

// template functions
const url = app.locals['url'] = (name, params, method) => {
  return path.posix.join(config.prefix, urls.build(name, params, method));
}
const staticUrl = app.locals['static'] = (urlPath) => {
  return path.posix.join(config.prefix, 'static', urlPath)
}

template.addFilter('date', (date, format) => {
  if (!date) {
    return '';
  }
  if (Number.isInteger(date)) {
    date = parseInt(date);
  }
  return moment(date).format(format);
});

template.addFilter('duration', (duration) => {
  return utils.formatDuration(duration);
});

template.addFilter('json', (obj, indent) => {
  return JSON.stringify(obj, null, ' '.repeat(indent));
})

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

router.get('/', 'home', (req, res, next) => {
  // get unlogged events and group by day
  Event.objects.find({
    selector: {
      entryId: {$eq: null}
    }
  }).then(events => {
    const context = getContext(req, res);
    const days = new Map();
    events.forEach(event => {
      let dateObj = days.get(event.date);
      if (!dateObj) {
        dateObj = {date: event.date, events: []}
        days.set(event.date, dateObj);
      }
      dateObj.events.push(event);
    });
    context.unloggedDays = [];
    days.forEach((dateObj, date) => {
      context.unloggedDays.push({
        date: date,
        firstEvent: dateObj.events[0]._id,
        lastEvent: dateObj.events[dateObj.events.length - 1]._id
      });
    });
    res.render('home.html', context);
  }).catch(error => next(error));
});

router.get('/entries', 'entries', async (req, res, next) => {
  const context = getContext(req, res);
  let startDate = Date.parse(req.query.from);
  let endDate = Date.parse(req.query.to);

  const opts = {}

  if (!isNaN(startDate)) opts.startkey = startDate.toString();
  if (!isNaN(endDate)) opts.endkey = endDate.toString();

  // get all sleep entries
  try {
    context.entries = await Entry.objects.all(opts);
    res.render('entries.html', context)
  } catch(error) {
    next(error);
  }
});

router.get('/entries/:date', 'entry', async (req, res, next) => {
  const context = getContext(req, res);
  const date = req.params.date;
  try {
    context.entry = await Entry.objects.get(date);
    res.render('entry.html', context)
  } catch(error) {
    next(error);
  }
});

router.post('/entries', 'entries', async (req, res, next) => {
  if (req.body.action == 'createFromEvent') {
    try {
      events = await Event.objects.all({
        startkey: req.body.firstEvent,
        endkey: req.body.lastEvent
      });
      
      // create the entry
      const entry = new Entry()
      entry.events = Entry.cleanEvents(events);
      entry.updateStats();
      console.log('Creating entry', entry.dateStr);
      await entry.save();

      // update the events with the entryId
      for (var i=0; i<events.length; i++) {
        events[i].entryId = entry._id
        await events[i].save();
      }

      res.redirect(url('entry', {date: entry.dateStr}));
    } catch(error) {
      return next(error);
    }
  } else {
    res.redirect(url('home'));
  }
});

router.post('/entries/:date', 'entry', async (req, res, next) => {
  const date = req.params.date;
  try {
    const entry = await Entry.objects.get(date);
    if (req.body.action == 'delete') {
      await entry.delete();
      res.redirect(url('entries'));
    } else {
      res.redirect(url('entry', {date: date}));
    }
  } catch(error) {
    next(error);
  }
});

router.get('/events', 'events', async (req, res, next) => {
  const context = getContext(req, res);
  let startDate = Date.parse(req.query.from);
  let endDate = Date.parse(req.query.to);
  let startkey = 'entry:';
  let endkey = 'entry\ufff0';

  /* TODO use bedtime date */
  /*
  if (!isNaN(startDate)) startkey = 'entry:' + startDate.toString();
  if (!isNaN(endDate)) endkey = 'entry:' + endDate.toString();
  */

  context.events = await Event.objects.all();
  res.render('events.html', context)
});

router.get('/events/:timestamp', 'event', async (req, res, next) => {
  const context = getContext(req, res);
  const timestamp = req.params.timestamp;
  try {
    context.event = await Event.objects.get(timestamp);
    return res.render('event.html', context);
  } catch(error) {
    next(error);
  }
});

router.post('/events/:timestamp', 'event', async (req, res, next) => {
  const timestamp = req.params.timestamp;
  try {
    const event = await Event.objects.get(timestamp);
    if (req.body.action == 'delete') {
      await event.delete();
      res.redirect(url('events'));
    } else {
      res.redirect(url('event', {timestamp: timestamp}));
    }
  } catch(error) {
    next(error);
  }
});

app.use(path.posix.join(config.prefix, 'db'), PouchServer);
app.use(path.posix.join(config.prefix, 'static'), express.static(STATIC_DIR))
app.use(config.prefix, router);

app.listen(config.port, () => console.log(`listening on port ${config.port}`));
