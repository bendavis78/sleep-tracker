const fs = require('fs');
const path = require('path');
const defaultConfig = path.join(path.resolve(path.dirname('')), 'config.json');
const configPath = process.argv[2] || defaultConfig;
console.log('Loading config from ' + configPath);
const config = JSON.parse(fs.readFileSync(configPath));
module.exports = config
