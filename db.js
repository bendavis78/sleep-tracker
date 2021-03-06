const config = require('./config');
const pouchdb = require('pouchdb');
const pouchdbFind = require('pouchdb-find');

config.dbPath = config.dbPath || '/usr/local/share/pouchdb';
config.dbName = config.dbName || 'sleeplog';

const defaults = {
  prefix: config.dbPath.replace(/\/$/, '/')
}

const PouchDB = pouchdb.defaults(defaults);
PouchDB.plugin(pouchdbFind);

function setupIndexes(db) {
  db.createIndex({
    index: {
      fields: ['date']
    }
  });
  db.createIndex({
    index: {
      fields: ['entryId']
    }
  });
  db.createIndex({
    index: {
      fields: ['entryId', '_id']
    }
  });
  db.createIndex({
    index: {
      fields: ['type', 'entryId']
    }
  });
  db.createIndex({
    index: {
      fields: ['type', 'entryId', 'timestamp']
    }
  });
}

let db;
function getDatabase() {
  if (!db) {
    console.log('Using database', config.dbName);
    db = PouchDB(config.dbName);
  }
  setupIndexes(db);
  return db;
}

module.exports.PouchDB = PouchDB;
module.exports.getDatabase = getDatabase;
