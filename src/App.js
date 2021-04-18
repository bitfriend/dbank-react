import React, { PureComponent } from 'react';
import { Alert, Button, InputNumber, Layout, Spin, Tabs, Typography } from 'antd';
import 'antd/dist/antd.css';
import './App.css';

import Web3 from 'web3';
import Token from './abis/Token.json';
import Dbank from './abis/Dbank.json';
import networks from './truffle-networks';

const { Header, Content } = Layout;
const { Paragraph, Title } = Typography;
const { TabPane } = Tabs;

class App extends PureComponent {
  state = {
    account: '0x0',
    walletBalance: '0',
    depositBalance: '0',
    depositAmount: '0.01',
    deposited: false,
    borrowBalance: '0',
    borrowAmount: '0.01',
    borrowed: false,
    loading: false,
    hasError: false,
    errorMessage: '',
    errorDescription: ''
  }

  async componentDidMount() {
    this.setState({ loading: true });
    try {
      // Get network provider and web3 instance.
      this.web3 = await this.getWeb3();

      // Use web3 to get the user's accounts.
      const accounts = await this.web3.eth.getAccounts();

      // Get the contract instance.
      const envNetworkType = process.env.REACT_APP_NETWORK_TYPE;
      const networkType = await this.web3.eth.net.getNetworkType();
      if (networkType !== envNetworkType) {
        if (!(envNetworkType === 'development' && networkType === 'private')) {
          this.setState({
            loading: false,
            hasError: true,
            errorMessage: 'Error in Ethereum Network Type',
            errorDescription: `Current account is of ${networkType} network. Please select account for ${process.env.REACT_APP_NETWORK_TYPE} network.`
          });
          return;
        }
      }
      const networkId = await this.web3.eth.net.getId();

      // load wallet balance
      if (typeof accounts[0] !== 'undefined') {
        const walletBalance = await this.web3.eth.getBalance(accounts[0]);
        this.setState({
          account: accounts[0],
          walletBalance
        });
      } else {
        window.alert('Please login with MetaMask');
      }

      // load contracts
      this.tokenContract = new this.web3.eth.Contract(Token.abi, Token.networks[networkId].address);
      this.dbankContract = new this.web3.eth.Contract(Dbank.abi, Dbank.networks[networkId].address);

      // Install event watch
      this.recentBlock = await this.web3.eth.getBlockNumber();
      this.watchEvents();

      this.dBankAddress = Dbank.networks[networkId].address;
      const depositBalance = await this.dbankContract.methods.etherBalanceOf(accounts[0]).call();
      const deposited = await this.dbankContract.methods.isDeposited(accounts[0]).call();
      const borrowBalance = await this.dbankContract.methods.collateralEther(accounts[0]).call();
      const borrowed = await this.dbankContract.methods.isBorrowed(accounts[0]).call();

      this.setState({
        loading: false,
        depositBalance,
        deposited,
        borrowBalance,
        borrowed
      });
    } catch (error) {
      this.setState({ loading: false }, () => {
        console.log(error);
      });
    }
  }

  getWeb3 = () => new Promise((resolve, reject) => {
    // Wait for loading completion to avoid race conditions with web3 injection timing.
    window.addEventListener('load', () => {
      // Modern dapp browsers...
      if (window.ethereum) {
        const web3 = new Web3(window.ethereum);
        try {
          // Request account access if needed
          window.ethereum.enable().then(data => {
            // Acccounts now exposed
            resolve(web3);
          });
        } catch (error) {
          reject(error);
        }
      }
      // Legacy dapp browsers...
      else if (window.web3) {
        // Use Mist/MetaMask's provider.
        const web3 = window.web3;
        console.log("Injected web3 detected.");
        resolve(web3);
      }
      // Fallback to localhost; use dev console port by default...
      else {
        const web3 = new Web3(this.getProvider());
        console.log('No web3 instance injected, using Local web3.');
        resolve(web3);
      }
    });
  })

  getProvider() {
    if (process.env.REACT_APP_NETWORK_TYPE === 'development') {
      return new Web3.providers.HttpProvider(`http://${networks.development.host}:${networks.development.port}`);
    }
    return networks[process.env.REACT_APP_NETWORK_TYPE].provider();
  }

  watchEvents() {
    this.dbankContract.events.Deposit({}, (error, event) => {
      // Network operation ends here
      console.log('Deposit event', event);
      if (event.blockNumber <= this.recentBlock) {
        return;
      }
      if (event.returnValues[0] !== this.state.account) {
        return;
      }
      if (!error) {
        let { walletBalance } = this.state;
        walletBalance = this.web3.utils.toBN(walletBalance).sub(this.web3.utils.toBN(event.returnValues[1])).toString();
        this.setState({
          walletBalance,
          depositBalance: event.returnValues[1],
          depositAmount: null,
          deposited: true,
          loading: false
        });
      } else {
        this.setState({ loading: false });
      }
    }).on('data', event => {
      console.log('Deposit event data', event);
    }).on('error', console.error);

    this.dbankContract.events.Withdraw({}, (error, event) => {
      // Network operation ends here
      console.log('Withdraw event', event);
      if (event.blockNumber <= this.recentBlock) {
        return;
      }
      if (event.returnValues[0] !== this.state.account) {
        return;
      }
      if (!error) {
        let { walletBalance } = this.state;
        const userBalance = event.returnValues[1];
        const depositTime = event.returnValues[2];
        const interest = event.returnValues[3];
        walletBalance = this.web3.utils.toBN(walletBalance).add(this.web3.utils.toBN(userBalance)).toString();
        this.setState({
          walletBalance,
          depositBalance: '0',
          deposited: false,
          loading: false
        });
      } else {
        this.setState({ loading: false });
      }
    }).on('data', event => {
      console.log('Withdraw event data', event);
    }).on('error', console.error);

    this.dbankContract.events.Borrow({}, (error, event) => {
      // Network operation ends here
      console.log('Borrow event', event);
      if (event.blockNumber <= this.recentBlock) {
        return;
      }
      if (event.returnValues[0] !== this.state.account) {
        return;
      }
      const collateralBalance = event.returnValues[1];
      const tokensToMint = event.returnValues[2];
      if (!error) {
        this.setState({
          borrowBalance: collateralBalance,
          borrowAmount: null,
          borrowed: true,
          loading: false
        });
      } else {
        this.setState({ loading: false });
      }
    }).on('data', event => {
      console.log('Borrow event data', event);
    }).on('error', console.error);

    this.tokenContract.events.Approval({}, (error, event) => {
      // Network operation ends here
      console.log('Approval event', event);
      if (event.blockNumber <= this.recentBlock) {
        return;
      }
      if (event.returnValues[0] !== this.state.account) {
        return;
      }
      if (!error) {
        const spender = event.returnValues[1];
        const amount = event.returnValues[2];
        this.setState({ loading: false });
      } else {
        this.setState({ loading: false });
      }
    }).on('data', event => {
      console.log('Approval event data', event);
    }).on('error', console.error);

    this.dbankContract.events.PayOff({}, (error, event) => {
      // Network operation ends here
      console.log('PayOff event', event);
      if (event.blockNumber <= this.recentBlock) {
        return;
      }
      if (event.returnValues[0] !== this.state.account) {
        return;
      }
      if (!error) {
        const fee = event.returnValues[1];
        this.setState({
          borrowBalance: '0',
          borrowed: false,
          loading: false
        });
      } else {
        this.setState({ loading: false });
      }
    }).on('data', event => {
      console.log('PayOff event data', event);
    }).on('error', console.error);
  }

  async deposit(amount) {
    // if gas and gasPrice is insufficient, "deposit" method may be failed
    const tx = this.dbankContract.methods.deposit();
    const gas = await tx.estimateGas({
      from: this.state.account,
      value: this.web3.utils.toWei(amount, 'ether')
    });
    const gasPrice = await this.web3.eth.getGasPrice();
    tx.send({
      gas,
      gasPrice,
      value: this.web3.utils.toWei(amount, 'ether'),
      from: this.state.account
    }).on('transactionHash', (hash) => {
      // User clicked Confirm button in MetaMask
      console.log('hash', hash);
      // Network operation starts here
      this.setState({ loading: true });
    }).on('receipt', (receipt) => {
      console.log('receipt', receipt);
    }).on('confirmation', (confirmationNumber, receipt) => {
      console.log('confirmation-number', confirmationNumber);
      console.log('confirmation-receipt', receipt);
    }).on('error', (err) => {
      console.error(err);
    });
  }

  async withdraw() {
    // if gas and gasPrice is insufficient, "withdraw" method may be failed
    const tx = this.dbankContract.methods.withdraw();
    const gas = await tx.estimateGas({
      from: this.state.account
    });
    const gasPrice = await this.web3.eth.getGasPrice();
    tx.send({
      gas,
      gasPrice,
      from: this.state.account
    }).on('transactionHash', (hash) => {
      // User clicked Confirm button in MetaMask
      console.log('hash', hash);
      // Network operation starts here
      this.setState({ loading: true });
    }).on('receipt', (receipt) => {
      console.log('receipt', receipt);
    }).on('confirmation', (confirmationNumber, receipt) => {
      console.log('confirmation-number', confirmationNumber);
      console.log('confirmation-receipt', receipt);
    }).on('error', (err) => {
      console.error(err);
    });
  }

  async borrow(amount) {
    // if gas and gasPrice is insufficient, "borrow" method may be failed
    const tx = this.dbankContract.methods.borrow();
    const gas = await tx.estimateGas({
      from: this.state.account,
      value: this.web3.utils.toWei(amount, 'ether')
    });
    const gasPrice = await this.web3.eth.getGasPrice();
    tx.send({
      gas,
      gasPrice,
      value: this.web3.utils.toWei(amount, 'ether'),
      from: this.state.account
    }).on('transactionHash', (hash) => {
      // User clicked Confirm button in MetaMask
      console.log('hash', hash);
      // Network operation starts here
      this.setState({ loading: true });
    }).on('receipt', (receipt) => {
      console.log('receipt', receipt);
    }).on('confirmation', (confirmationNumber, receipt) => {
      console.log('confirmation-number', confirmationNumber);
      console.log('confirmation-receipt', receipt);
    }).on('error', (err) => {
      console.error(err);
    });
  }

  async payOff() {
    // if gas and gasPrice is insufficient, "payOff" method may be failed
    const tokenBorrowed = this.state.borrowBalance / 2;
    const txApprove = this.tokenContract.methods.approve(this.dBankAddress, tokenBorrowed.toString());
    let gas = await txApprove.estimateGas({
      from: this.state.account
    });
    const gasPrice = await this.web3.eth.getGasPrice();
    await txApprove.send({
      gas,
      gasPrice,
      from: this.state.account
    }).on('transactionHash', (hash) => {
      // User clicked Confirm button in MetaMask
      console.log('hash', hash);
      // Network operation starts here
      this.setState({ loading: true });
    }).on('receipt', (receipt) => {
      console.log('receipt', receipt);
    }).on('confirmation', (confirmationNumber, receipt) => {
      console.log('confirmation-number', confirmationNumber);
      console.log('confirmation-receipt', receipt);
    }).on('error', (err) => {
      console.error(err);
    });

    // if gas and gasPrice is insufficient, "payOff" method may be failed
    const txPayOff = this.dbankContract.methods.payOff();
    gas = await txPayOff.estimateGas({
      from: this.state.account
    });
    await txPayOff.send({
      gas,
      gasPrice,
      from: this.state.account
    }).on('transactionHash', (hash) => {
      // User clicked Confirm button in MetaMask
      console.log('hash', hash);
      // Network operation starts here
      this.setState({ loading: true });
    }).on('receipt', (receipt) => {
      console.log('receipt', receipt);
    }).on('confirmation', (confirmationNumber, receipt) => {
      console.log('confirmation-number', confirmationNumber);
      console.log('confirmation-receipt', receipt);
    }).on('error', (err) => {
      console.error(err);
    });
  }

  onChangeDepositAmount = (value) => this.setState({ depositAmount: value.toString() })

  onClickDeposit = () => {
    this.deposit(this.state.depositAmount);
  }

  onClickWithdraw = () => {
    this.withdraw();
  }

  onChangeBorrowAmount = (value) => this.setState({ borrowAmount: value.toString() })

  onClickBorrow = () => {
    this.borrow(this.state.borrowAmount);
  }

  onClickPayOff = () => {
    this.payOff();
  }

  render = () => (
    <div className="App">
      <Layout style={{ height: '100vh' }}>
        <Header>
          <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
            <img src={require('./logo.png')} alt="logo" height={32} />
            <Title level={1} style={{
              lineHeight: 'unset',
              marginBottom: 'unset',
              marginLeft: '0.5em',
              color: 'white'
            }}>d₿ank</Title>
            <Title level={5} style={{
              flex: 1,
              textAlign: 'right',
              lineHeight: 'unset',
              marginBottom: 'unset',
              marginLeft: '0.5em',
              color: 'white'
            }}>Wallet Balance: {this.web3 && this.web3.utils.fromWei(this.state.walletBalance)} ETH</Title>
            <Title level={5} style={{
              flex: 1,
              textAlign: 'right',
              lineHeight: 'unset',
              marginBottom: 'unset',
              marginLeft: '0.5em',
              color: 'white'
            }}>Deposit Balance: {this.web3 && this.web3.utils.fromWei(this.state.depositBalance)} ETH</Title>
            <Title level={5} style={{
              flex: 1,
              textAlign: 'right',
              lineHeight: 'unset',
              marginBottom: 'unset',
              marginLeft: '0.5em',
              color: 'white'
            }}>Borrow Balance: {this.web3 && this.web3.utils.fromWei(this.state.borrowBalance)} ETH</Title>
          </div>
        </Header>
        <Content style={{
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{ marginTop: 20 }}>
            {this.state.hasError && (
              <Alert
                type="warning"
                message={this.state.errorMessage}
                description={this.state.errorDescription}
                closable
                onClose={() => this.setState({ hasError: false })}
              />
            )}
            <div style={{ textAlign: 'center' }}>
              <Title level={1}>Welcome to d₿ank</Title>
              <Tabs defaultActiveKey="1" type="card" style={{ width: '100%' }}>
                <TabPane tab="Deposit" key="1" style={{
                  width: '100%',
                  textAlign: 'center'
                }}>
                  <Paragraph>How much do you want to deposit?</Paragraph>
                  <Paragraph>(min. amount is 0.01 ETH)</Paragraph>
                  <Paragraph>(1 deposit is possible at the time)</Paragraph>
                  <InputNumber
                    min={0.01}
                    value={this.state.depositAmount}
                    placeholder="amount..."
                    style={{
                      marginBottom: 30,
                      display: 'block',
                      width: '100%'
                    }}
                    onChange={this.onChangeDepositAmount}
                    disabled={this.state.deposited}
                  />
                  <Button
                    type="primary"
                    style={{
                      marginBottom: 20
                    }}
                    onClick={this.onClickDeposit}
                    disabled={this.state.deposited}
                  >DEPOSIT</Button>
                  {this.state.deposited && (
                    <Paragraph>Already you deposited</Paragraph>
                  )}
                </TabPane>
                <TabPane tab="Withdraw" key="2" style={{
                  width: '100%',
                  textAlign: 'center'
                }}>
                  <Paragraph>Do you want to withdraw + take interest?</Paragraph>
                  <Button
                    type="primary"
                    style={{
                      marginBottom: 20
                    }}
                    onClick={this.onClickWithdraw}
                    disabled={!this.state.deposited}
                  >WITHDRAW</Button>
                  {!this.state.deposited && (
                    <Paragraph>Nothing deposited</Paragraph>
                  )}
                </TabPane>
                <TabPane tab="Borrow" key="3" style={{
                  width: '100%',
                  textAlign: 'center'
                }}>
                  <Paragraph>Do you want to borrow token?</Paragraph>
                  <Paragraph>(You'll get 50% of collateral, in Tokens)</Paragraph>
                  <Paragraph>Type collateral amount (in ETH)</Paragraph>
                  <InputNumber
                    min={0.01}
                    value={this.state.borrowAmount}
                    placeholder="amount..."
                    style={{
                      marginBottom: 30,
                      display: 'block',
                      width: '100%'
                    }}
                    onChange={this.onChangeBorrowAmount}
                    disabled={this.state.borrowed}
                  />
                  <Button
                    type="primary"
                    style={{
                      marginBottom: 20
                    }}
                    onClick={this.onClickBorrow}
                    disabled={this.state.borrowed}
                  >BORROW</Button>
                  {this.state.borrowed && (
                    <Paragraph>Already you borrowed</Paragraph>
                  )}
                </TabPane>
                <TabPane tab="Payoff" key="4" style={{
                  width: '100%',
                  textAlign: 'center'
                }}>
                  <Paragraph>Do you want to payoff the loan?</Paragraph>
                  <Paragraph>(You'll receive your collateral - fee)</Paragraph>
                  <Button
                    type="primary"
                    style={{
                      marginBottom: 20
                    }}
                    onClick={this.onClickPayOff}
                    disabled={!this.state.borrowed}
                  >PAYOFF</Button>
                  {!this.state.borrowed && (
                    <Paragraph>Nothing borrowed</Paragraph>
                  )}
                </TabPane>
              </Tabs>
            </div>
          </div>
        </Content>
      </Layout>
      {this.state.loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Spin />
        </div>
      )}
    </div>
  )
}

export default App;
