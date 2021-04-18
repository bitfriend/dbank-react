const path = require("path");
const networks = require('./src/truffle-networks');

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // for more about customizing your Truffle configuration!
  contracts_build_directory: path.join(__dirname, "src/abis"),
  networks,
  compilers: {
    solc: {
      version: '>=0.6.0 <0.8.0'
    }
  }
};