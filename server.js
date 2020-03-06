const path = require('path');
const express = require('express');
const nunjucks = require('nunjucks');
const config = require('./config.json');
const moment = require('moment');
const debugMiddleware = require('debug-error-middleware').express;
const NamedRouter = require('named-routes');
const database = require('./db');
const utils = require('./utils');

const pouchOptions = {
  logPath: '/tmp/log.txt'
};

const db = database.getDatabase();

config.port = config.port || 3000;
config.locale = config.locale || 'en-US';
config.prefix = config.prefix || '/';

moment.locale(config.locale);

const app = express();
const router = express.Router();
const urls = new NamedRouter();
urls.extendExpress(router);

if (config.debug) {
  app.use(debugMiddleware());
}

const template = nunjucks.configure(path.join(__dirname , 'templates'), {
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

function url(name, params, method) {
  return config.prefix + urls.build(name, params, method);
}
app.locals['url'] = url;

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
  const seconds = Math.round(duration / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  if (hours >= 1) {
    return Math.floor(hours) + 'h ' + (minutes % 60) + 'm';
  }
  if (minutes >= 1) {
    return minutes + 'm ' + seconds + 's';
  }
  return seconds + 's';
});

template.addFilter('json', (obj, indent) => {
  return JSON.stringify(obj, null, ' '.repeat(indent));
})

var bodyParser = require('body-parser');
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

router.get('/', 'home', (req, res, next) => {
  // get unlogged events and group by day
  db.find({
    selector: {
      _id: {$gt: 'event:', $lt: 'event:\uffff'},
      entryId: {$eq: null}
    }
  }).then(result => result.docs).then(events => {
    const context = getContext(req, res);
    const days = new Map();
    events.forEach(event => {
      date = utils.getBedtimeDate(event.timestamp).getTime();
      let dateObj = days.get(date);
      if (!dateObj) {
        dateObj = {date: date, events: []}
        days.set(date, dateObj);
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

router.post('/entries', 'entries', async (req, res, next) => {
  if (req.body.action == 'createFromEvent') {
    try {
      result = await db.allDocs({
        include_docs: true,
        startkey: req.body.firstEvent,
        endkey: req.body.lastEvent
      });

      const events = result.rows.map(row => row.doc);
      
      // create the entry
      result = await utils.createEntry(events);
      const entry = await db.get(result.id);
      const dateStr = moment(entry.date).format("YYYY-MM-DD")
      res.redirect(url('entry', {date: dateStr}));
    } catch(error) {
      return next(error);
    }
  } else {
    res.redirect(url('home'));
  }
});

router.get('/entries', 'entries', (req, res, next) => {
  const context = getContext(req, res);
  let startDate = Date.parse(req.query.from);
  let endDate = Date.parse(req.query.to);
  let startkey = 'entry:';
  let endkey = 'entry\ufff0';

  if (!isNaN(startDate)) startkey = 'entry:' + startDate.toString();
  if (!isNaN(endDate)) endkey = 'entry:' + endDate.toString();

  // get all sleep entries
  db.allDocs({
    include_docs: true,
    attachments: true,
    startkey: 'entry:',
    endkey: 'entry:\ufff0'
  }).then(result => {
    context.entries = result.rows.map(row => row.doc);
    res.render('entries.html', context)
  }).catch(error => next(error));
});

router.get('/entries/:date', 'entry', (req, res, next) => {
  const context = getContext(req, res);
  const date = req.params.date;
  db.get('entry:' + date).then(doc => {
    context.entry = doc;
    res.render('entry.html', context)
  }).catch(error => next(error));
});

router.post('/entries/:date', 'entry', async (req, res, next) => {
  const date = req.params.date;
  db.get('entry:' + date).then(doc => {
    if (req.body.action == 'delete') {
      return utils.deleteEntry(doc).then(() => {
        res.redirect(url('entries'));
      });
    } else {
      res.redirect(url('entry', {date: date}));
    }
  }).catch(error => next(error));
});

router.get('/events', 'events', async (req, res, next) => {
  const context = getContext(req, res);
  let startDate = Date.parse(req.query.from);
  let endDate = Date.parse(req.query.to);
  let startkey = 'entry:';
  let endkey = 'entry\ufff0';

  if (!isNaN(startDate)) startkey = 'entry:' + startDate.toString();
  if (!isNaN(endDate)) endkey = 'entry:' + endDate.toString();

  // get all sleep entries
  await db.allDocs({
    include_docs: true,
    attachments: true,
    startkey: 'event:',
    endkey: 'event:\ufff0'
  }).then(result => {
    context.events = result.rows.map(row => row.doc);
    res.render('events.html', context)
  }).catch(error => next(error));
});

router.get('/events/:timestamp', 'event', (req, res, next) => {
  const context = getContext(req, res);
  const timestamp = req.params.timestamp;
  db.get('event:' + timestamp).then(doc => {
    context.event = doc;
    res.render('event.html', context)
  }).catch(error => next(error));
});

router.post('/events/:timestamp', 'event', async (req, res, next) => {
  const timestamp = req.params.timestamp;
  db.get('event:' + timestamp).then(doc => {
    if (req.body.action == 'delete') {
      return db.remove(doc).then(() => {
        res.redirect(url('events'));
      });
    } else {
      res.redirect(url('event', {timestamp: timestamp}));
    }
  }).catch(error => next(error));
});


app.use(path.posix.join(config.prefix, 'db'), require('express-pouchdb')(database.PouchDB, pouchOptions));
app.use(path.posix.join(config.prefix, 'static'), express.static(__dirname + '/static'))
app.use(config.prefix, router);

app.listen(config.port, () => console.log(`listening on port ${config.port}`));
