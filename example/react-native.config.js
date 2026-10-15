const path = require('path');
const pak = require('../package.json');

module.exports = {
  dependencies: {
    [pak.name]: {
      root: path.join(__dirname, '..'),
    },
    'react-native-example-broadcaster': {
      root: path.join(__dirname, 'modules', 'broadcaster'),
    },
  },
};
