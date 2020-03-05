const path = require('path');
const PouchDB = require('pouchdb');
const express = require('express');
const nunjucks = require('nunjucks');
const config = require('./config.json');
const moment = require('moment');
const debugMiddleware = require('debug-error-middleware').express;
const NamedRouter = require('named-routes');

config.port = config.port || 3000;
config.db = config.db || 'db';
config.locale = config.locale || 'en-US';
config.prefix = config.prefix || '/';

moment.locale(config.locale);

const app = express();
const router = express.Router();
const namedRouter = new NamedRouter();
namedRouter.extendExpress(router);

console.log('Using database', config.db);
const db = new PouchDB(config.db);

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

app.locals['url'] = (name, params, method) => {
  return config.prefix + namedRouter.build(name, params, method);
};

template.addFilter('date', (date, format) => {
  if (!date) {
    return '';
  }
  if (Number.isInteger(date)) {
    date = parseInt(date);
  }
  return moment(date).format(format);
});

template.addFilter('json', (obj, indent) => {
  return JSON.stringify(obj, null, ' '.repeat(indent));
})

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

router.get('/', 'home', (req, res, next) => {
  res.render('home.html');
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
    context.entries = result.rows;
    res.render('entries.html', context)
  }).catch(error => next(error));

});

router.get('/entries/:timestamp', 'entry', (req, res, next) => {
  const context = getContext(req, res);
  const timestamp = req.params.timestamp;
  db.get('entry:' + timestamp).then(doc => {
    context.entry = doc;
    res.render('entry.html', context)
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
    context.events = result.rows;
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

app.use('/static', express.static(__dirname + '/static'))
app.use(config.prefix, router);

app.listen(config.port, () => console.log(`listening on port ${config.port}`));
