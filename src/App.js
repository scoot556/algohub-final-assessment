import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import './App.css';
import { useEffect, useState } from 'react';
import {PeraWalletConnect} from '@perawallet/connect';
import algosdk, { waitForConfirmation } from 'algosdk';

// Create the PeraWalletConnect instance outside the component
const peraWallet = new PeraWalletConnect();

// The app ID on testnet
const appIndex = 146076077;

// connect to the algorand node
const algod = new algosdk.Algodv2('','https://testnet-api.algonode.cloud', 443);

function App() {
  const [show, setShow] = useState(false);
  const [accountAddress, setAccountAddress] = useState(null);
  const isConnectedToPeraWallet = !!accountAddress;
  const [localTodos, setLocalTodos] = useState([]);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  useEffect(() => {
    if (accountAddress) {
      checkLocalTodosState();
    }
    // checkLocalTodosState();
    peraWallet.reconnectSession().then((accounts) => {
      peraWallet.connector?.on('disconnect', handleDisconnectWalletClick);

      if (accounts.length) {
        setAccountAddress(accounts[0]);
        // console.log(accounts[0])
        checkLocalTodosState();
      }
    })
  },[accountAddress])

  function handleConnectWalletClick() {
    peraWallet.connect().then((newAccounts) => {
      // setup the disconnect event listener
      peraWallet.connector?.on('disconnect', handleDisconnectWalletClick);

      setAccountAddress(newAccounts[0]);
    });
  }

    function handleDisconnectWalletClick() {
      peraWallet.disconnect();
      setAccountAddress(null);
    }

    async function optInToApp() {
      const suggestedParams = await algod.getTransactionParams().do();
      const optInTxn = algosdk.makeApplicationOptInTxn(
        accountAddress,
        suggestedParams,
        appIndex
      );

      const optInTxGroup = [{txn: optInTxn, signers: [accountAddress]}];

        const signedTx = await peraWallet.signTransaction([optInTxGroup]);
        console.log(signedTx);
        const { txId } = await algod.sendRawTransaction(signedTx).do();
        const result = await waitForConfirmation(algod, txId, 2);
    }

    async function checkLocalTodosState() {
      try {
        const accountInfo = await algod.accountApplicationInformation(accountAddress,appIndex).do();
        const todoLength = accountInfo['app-local-state']['key-value'].length;
        if(!!accountInfo['app-local-state']['key-value']) {
          const todos = [];
          for(let i = 0; i < todoLength; i++) {
            todos.push({key: Buffer.from(accountInfo['app-local-state']['key-value'][i].key, 'base64').toString('ascii'), value: Buffer.from(accountInfo['app-local-state']['key-value'][i].value.bytes, 'base64').toString('ascii')});
          }
          console.log("TODOS", todos);
          setLocalTodos(todos);
        } else {
          setLocalTodos([]);
        }
        // if(!!accountInfo['app-local-state']['key-value'][0].value.bytes) {
        //   setLocalTodos([...localTodos, Buffer.from(accountInfo['app-local-state']['key-value'][1].value.bytes, 'base64').toString('ascii')]);
        // } else {
        //   // console.log(accountInfo['app-local-state']['key-value'][0].value.bytes);
        //   setLocalTodos([]);
        // }
        // console.log("DECODE", Buffer.from(accountInfo['app-local-state']['key-value'][0].value.bytes, 'base64').toString('ascii'));
        // console.log(accountInfo['app-local-state']['key-value'][0].value.bytes);
      } catch (e) {
        console.error('There was an error connecting to the todo app: ', e)
      }
    }

    async function addTodo(action, todoID, todoName) {
      try {
        const suggestedParams = await algod.getTransactionParams().do();
        const appArgs = [new Uint8Array(Buffer.from(action)), new Uint8Array(Buffer.from(todoID)), new Uint8Array(Buffer.from(todoName))];

        const addTodoTxn = algosdk.makeApplicationNoOpTxn(
          accountAddress,
          suggestedParams,
          appIndex,
          appArgs
        );

        const addTodoTxGroup = [{txn: addTodoTxn, signers: [accountAddress]}];

          const signedTx = await peraWallet.signTransaction([addTodoTxGroup]);
          console.log(signedTx);
          const { txId } = await algod.sendRawTransaction(signedTx).do();
          const result = await waitForConfirmation(algod, txId, 2);
          checkLocalTodosState();
      } catch (e) {
        console.error('There was an error connecting to the todo app: ', e)
      }
      
    }

    async function removeTodo(actio, todoID, todoName) {
      
    }

  return (
    <div className="App">
      <Container>
        <h1>AlgoHub Final Assessment - Todo List</h1>
        <Row>
            <Col>
              <Button className='btn-connect' onClick={
        isConnectedToPeraWallet ? handleDisconnectWalletClick : handleConnectWalletClick
      }>{isConnectedToPeraWallet ? "Disconnect" : "Connect to Pera Wallet"}</Button>
            </Col>
            <Col>
              <Button className="btn-wallet"
                onClick={
                  () => optInToApp()
                }>
                Opt-in
              </Button>
            </Col>
        </Row>
        <Row>
          <Container>
            <Row>Todo List</Row>
            <Row>
              <Col>
              </Col>
              <Col>
                <Button className='btn-add' onClick={handleShow}>Add Todo</Button>
                {!localTodos && localTodos.length > 0 ? (<p>No todos yet</p>) : (
                localTodos?.map((todo, index) => (
                  <div key={index}>{index + 1}: {todo.value}</div>
                ))
                )}
                <Modal show={show} onHide={handleClose}>
                  <Modal.Header closeButton>
                    <Modal.Title>Add Todo</Modal.Title>
                    <Modal.Body>
                      <input type='text' placeholder='Enter Todo'></input>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={handleClose}>
                        Close
                      </Button>
                      <Button variant="primary" onClick={() => addTodo('Add_Local_Todo', 'Todo3', 'Testing front end')}>
                        Save Changes
                      </Button>
                    </Modal.Footer>
                  </Modal.Header>
                </Modal>
              </Col>
            </Row>
          </Container>
        </Row>
      </Container>
    </div>
  );
}

export default App;
