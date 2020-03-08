function addFieldAccessor(instance, fieldName) {
  const descriptor = {};
  const proto = instance.constructor.prototype;

  // don't override existing descriptors
  const existingDescriptor = Object.getOwnPropertyDescriptor(proto, fieldName);

  if (existingDescriptor && existingDescriptor.get) {
    descriptor.get = existingDescriptor.get;
  } else {
    descriptor.get = () => instance.__doc[fieldName];
  }
  if (existingDescriptor && existingDescriptor.set) {
    descriptor.set = existingDescriptor.set;
  } else {
    descriptor.set = newValue => instance.__doc[fieldName] = newValue;
  }

  descriptor.enumerable = true;
  descriptor.configurable = false;
  Object.defineProperty(instance, fieldName, descriptor);
}

function addPrefix(val, prefix) {
  if (!val) {
    val = '';
  }
  const pattern = new RegExp('^' + prefix);
  if (!pattern.test(val)) {
    val = prefix + val;
  }
  return val;
}

class PouchModelManager {
  constructor(model) {
    this.model = model;
    this.__db = model.__db;
  }

  async get(id) {
    const doc = await this.__db.get(addPrefix(id, this.model.prefix));
    return new this.model(doc);
  }

  async allDocs(opts) {
    const prefix = this.model.prefix;
    opts = Object.assign({}, opts);
    opts.include_docs = true;
    opts.startkey = addPrefix(opts.startkey || '', prefix);
    opts.endkey = addPrefix(opts.endkey || '\uffff', prefix);

    // convert docs into model instances
    return this.__db.allDocs(opts).then(result => {
      let doc;
      for (let i=0; i<result.rows.length; i++) {
        doc = result.rows[i].doc;
        if (doc) {
          result.rows[i].doc = new this.model(doc);
        }
      }
      return result;
    });
  }

  async all(opts) {
    return this.allDocs(opts).then(result => {
      return result.rows.map(row => row.doc);
    });
  }

  async find(opts) {
    const prefix = this.model.prefix;
    opts = Object.assign({}, opts);
    opts.selector = opts.selector || {};
    opts.selector._id = opts.selector._id || {};

    // limit selector to objects with prefix
    opts.selector._id.$gt = addPrefix(opts.selector._id.$gt || '', prefix) 
    opts.selector._id.$lt = addPrefix(opts.selector._id.$lt || '\uffff', prefix);

    const result = await this.__db.find(opts);

    // convert docs into model instances
    return result.docs.map(doc => new this.model(doc)); 
  }
}

const managerMap = new Map();

function getManager(model) {
  if (!managerMap[model]) {
    const Manager = model.manager;
    managerMap[model] = new Manager(model);
  }
  return managerMap[model];
}

class PouchModel {
  static fields = {};
  static manager = PouchModelManager;
  static __db;

  static setDatabase(db) {
    this.__db = db;
  }

  static get objects() {
    return getManager(this);
  }

  static get prefix() {
    return this.name.toLowerCase() + ':';
  }

  constructor(doc) {
    const prefix = this.constructor.prefix;
    const fields = this.constructor.fields;
    const defaults = {};

    this.__db = this.constructor.__db;

    addFieldAccessor(this, '_id');

    for (let fieldName in fields) {
      addFieldAccessor(this, fieldName);

      // set default
      let defaultValue = fields[fieldName];
      if (typeof defaultValue === 'function') {
        defaultValue = defaultValue();
      }

      defaults[fieldName] = defaultValue;
    }

    this.__doc = Object.assign(defaults, doc);
  }

  get(key) {
    return this.__doc[key];
  }

  set(key, value) {
    this.__doc[key] = value;
  }

  newId() {
    const prefix = this.constructor.prefix;
    return prefix + uuid();
  }

  async save() {
    if (!this._id) {
      this._id = this.newId();
    }
    const result = await this.__db.put(this.__doc);
    await this.reload();
    return result;
  }

  async delete() {
    return this.__db.remove(this.__doc);
  }

  async reload() {
    this.__doc = await this.__db.get(this._id);
  }

  toString() {
    return this.constructor.name + ' <' + (this._id) + '>';
  }

  inspect() {
    return this.__doc;
  }
}

module.exports.PouchModel = PouchModel
module.exports.PouchModelManager = PouchModelManager
