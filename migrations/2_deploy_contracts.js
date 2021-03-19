const Token = artifacts.require('Token');
const Dbank = artifacts.require('Dbank');

module.exports = async function(deployer) {
  // deploy Token
  await deployer.deploy(Token);

  // assign token into variable to get it's address
  const token = await Token.deployed();

  // pass token address for Dbank contract (for future minting)
  await deployer.deploy(Dbank, token.address);

  // assign Dbank contract into variable to get it's address
  const dbank = await Dbank.deployed();

  // change token's owner/minter from deployer to dbank
  await token.passMinterRole(dbank.address);
};
