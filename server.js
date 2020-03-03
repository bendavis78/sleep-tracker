const path = require('path');
const PouchDB = require('pouchdb');
const express = require('express');
const nunjucks = require('nunjucks');
const config = require('./config.json');
const moment = require('moment');
const debugMiddleware = require('debug-error-middleware').express;

config.db = config.db || 'db';
config.locale = config.locale || 'en-US';
config.port = config.port || 3000;
moment.locale(config.locale);

const port = config.port;
const app = express();
const db = new PouchDB(config.db);

if (config.debug) {
  app.use(debugMiddleware());
}

console.log(__dirname);
const template = nunjucks.configure(path.join(__dirname , 'templates'), {
  noCache: true,
  autoescape: true,
  express: app
});

function getContext(req, res) {
  return {
    year: new Date().getFullYear()
  };
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

template.addFilter('json', (obj, indent) => {
  return JSON.stringify(obj, null, ' '.repeat(indent));
})

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  const context = getContext();
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
    res.render('index.html', context)
  });

});

app.get('/entries/:timestamp', (req, res) => {
  const context = getContext();
  const timestamp = req.params.timestamp;
  db.get('entry:' + timestamp).then(doc => {
    context.entry = doc;
    res.render('entry.html', context)
  });
});

app.get('/events', (req, res) => {
  const context = getContext();
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
    startkey: 'event:',
    endkey: 'event:\ufff0'
  }).then(result => {
    context.entries = result.rows;
    res.render('events.html', context)
  });
});

app.get('/events/:timestamp', (req, res) => {
  const context = getContext();
  const timestamp = req.params.timestamp;
  db.get('event:' + timestamp).then(doc => {
    context.event = doc;
    res.render('event.html', context)
  });
});

app.use('/static', express.static(__dirname + '/static'))

app.listen(port, () => console.log(`listening on port ${port}`));
