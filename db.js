const config = require('./config.json');
config.dbPath = config.dbPath || '/usr/local/share/pouchdb';
config.dbName = config.dbName || 'sleeplog';

const defaults = {
  prefix: config.dbPath.replace(/\/$/, '/')
}

const PouchDB = require('pouchdb').defaults(defaults);
PouchDB.plugin(require('pouchdb-find'));

function setupIndexes(db) {
  db.createIndex({
    index: {
      fields: ['entryId']
    }
  });
  db.createIndex({
    index: {
      fields: ['entryId', 'type']
    }
  });
  db.createIndex({
    index: {
      fields: ['entryId', 'type', 'timestamp']
    }
  });
}

let db;
function getDatabase() {
  if (!db) {
    console.log('Using database', config.db);
    db = PouchDB(config.dbName);
  }
  setupIndexes(db);
  return db;
}

module.exports.getDatabase = getDatabase;
module.exports.PouchDB = PouchDB;
