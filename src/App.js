import React, { PureComponent } from 'react';
import { Button, InputNumber, Layout, Spin, Tabs, Typography } from 'antd';
import 'antd/dist/antd.css';
import './App.css';

import Web3 from 'web3';
import Token from './contracts/Token.json';
import Dbank from './contracts/Dbank.json';

const { Header, Content } = Layout;
const { Paragraph, Title } = Typography;
const { TabPane } = Tabs;

class App extends PureComponent {
  state = {
    web3: null,
    account: '0x0',
    balance: '0',
    token: null,
    dbank: null,
    dBankAddress: null,
    depositAmount: null,
    borrowAmount: null,
    loading: false
  }

  componentDidMount = async () => {
    this.setState({ loading: true });
    try {
      // Get network provider and web3 instance.
      const web3 = await this.getWeb3();
      const netId = await web3.eth.net.getId();
      const accounts = await web3.eth.getAccounts();

      // load balance
      if (typeof accounts[0] !== 'undefined') {
        const balance = await web3.eth.getBalance(accounts[0]);
        this.setState({
          web3,
          account: accounts[0],
          balance: web3.utils.fromWei(balance)
        });
      } else {
        window.alert('Please login with MetaMask');
      }

      // load contracts
      const token = new web3.eth.Contract(Token.abi, Token.networks[netId].address);
      const dbank = new web3.eth.Contract(Dbank.abi, Dbank.networks[netId].address);
      const dBankAddress = Dbank.networks[netId].address;

      this.setState({
        loading: false,
        token,
        dbank,
        dBankAddress
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
        const provider = new Web3.providers.HttpProvider('http://127.0.0.1:7545');
        const web3 = new Web3(provider);
        console.log('No web3 instance injected, using Local web3.');
        resolve(web3);
      }
    });
  })

  deposit = async (amount) => {
    if (typeof this.state.dbank !== 'undefined') {
      try {
        await this.state.dbank.methods.deposit().send({
          value: this.state.web3.utils.toWei(amount.toPrecision()),
          from: this.state.account
        });
      } catch (error) {
        console.log('Error, deposit: ', error);
      }
    }
  }

  withdraw = async () => {
    if (typeof this.state.dbank !== 'undefined') {
      try {
        await this.state.dbank.methods.withdraw().send({
          from: this.state.account
        });
      } catch (error) {
        console.log('Error, withdraw: ', error);
      }
    }
  }

  borrow = async (amount) => {
    if (typeof this.state.dbank !== 'undefined') {
      try {
        await this.state.dbank.methods.borrow().send({
          value: this.state.web3.utils.toWei(amount.toPrecision()),
          from: this.state.account
        });
      } catch (error) {
        console.log('Error, borrow: ', error);
      }
    }
  }

  payOff = async () => {
    if (typeof this.state.dbank !== 'undefined') {
      try {
        const collateralEther = await this.state.dbank.methods.collateralEther(this.state.account).call({
          from: this.state.account
        });
        const tokenBorrowed = collateralEther / 2;
        await this.state.token.methods.approve(this.state.dBankAddress, tokenBorrowed.toString()).send({
          from: this.state.account
        });
        await this.state.dbank.methods.payOff().send({
          from: this.state.account
        });
      } catch (error) {
        console.log('Error, pay off: ', error);
      }
    }
  }

  fetchBalance = () => {
    this.state.web3.eth.getBalance(this.state.account).then(balance => {
      this.setState({
        balance: this.state.web3.utils.fromWei(balance)
      });
    });
  }

  onChangeDepositAmount = (value) => this.setState({ depositAmount: value })

  onClickDeposit = () => {
    this.deposit(this.state.depositAmount).then(this.fetchBalance);
  }

  onClickWithdraw = () => {
    this.withdraw().then(this.fetchBalance);
  }

  onChangeBorrowAmount = (value) => this.setState({ borrowAmount: value })

  onClickBorrow = () => {
    this.borrow(this.state.borrowAmount).then(this.fetchBalance);
  }

  onClickPayOff = () => {
    this.payOff().then(this.fetchBalance);
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
            }}>Current Balance: {parseFloat(this.state.balance, 10).toFixed(2)} ETH</Title>
          </div>
        </Header>
        <Content style={{
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Title level={1}>Welcome to d₿ank</Title>
            <Tabs defaultActiveKey="1" type="card" style={{ width: 400 }}>
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
                />
                <Button type="primary" onClick={this.onClickDeposit}>DEPOSIT</Button>
              </TabPane>
              <TabPane tab="Withdraw" key="2" style={{
                width: '100%',
                textAlign: 'center'
              }}>
                <Paragraph>Do you want to withdraw + take interest?</Paragraph>
                <Button type="primary" onClick={this.onClickWithdraw}>WITHDRAW</Button>
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
                />
                <Button type="primary" onClick={this.onClickBorrow}>BORROW</Button>
              </TabPane>
              <TabPane tab="Payoff" key="4" style={{
                width: '100%',
                textAlign: 'center'
              }}>
                <Paragraph>Do you want to payoff the loan?</Paragraph>
                <Paragraph>(You'll receive your collateral - fee)</Paragraph>
                <Button type="primary" onClick={this.onClickPayOff}>PAYOFF</Button>
              </TabPane>
            </Tabs>
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
