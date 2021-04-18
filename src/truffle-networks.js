require('dotenv').config(); // To use process.env variable
const HDWalletProvider = require('@truffle/hdwallet-provider');
const MNEMONIC = process.env.REACT_APP_MNEMONIC;
const ROPSTEN_URL = `https://ropsten.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`;
const KOVAN_URL = `https://kovan.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`;
const RINKEBY_URL = `https://rinkeby.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`;
const MAINNET_URL = `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_PROJECT_ID}`;

module.exports = {
  development: {
    host: "127.0.0.1",
    port: 7545,
    network_id: "*" // Match any network id
  },
  ropsten: {
    provider: () => new HDWalletProvider(MNEMONIC, ROPSTEN_URL),
    network_id: 3
  },
  kovan: {
    provider: () => new HDWalletProvider(MNEMONIC, KOVAN_URL),
    network_id: 42
  },
  rinkeby: {
    provider: () => new HDWalletProvider(MNEMONIC, RINKEBY_URL),
    network_id: 4
  },
  mainnet: {
    provider: () => new HDWalletProvider(MNEMONIC, MAINNET_URL),
    network_id: 1
  }
};