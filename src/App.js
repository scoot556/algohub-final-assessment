import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import './App.css';
import { useEffect, useState } from 'react';
import {PeraWalletConnect} from '@perawallet/connect';
import algosdk, { waitForConfirmation } from 'algosdk';
import { Tooltip } from 'bootstrap';
import { Form } from 'react-bootstrap';

// Create the PeraWalletConnect instance outside the component
const peraWallet = new PeraWalletConnect();

// The app ID on testnet
const appIndex = 147444880;

// connect to the algorand node
const algod = new algosdk.Algodv2('','https://testnet-api.algonode.cloud', 443);

function App() {
  const [show, setShow] = useState(false);
  const [accountAddress, setAccountAddress] = useState(null);
  const isConnectedToPeraWallet = !!accountAddress;
  const [localTodos, setLocalTodos] = useState([]);
  const [tempTodo, setTempTodo] = useState('');
  const [todoAddButton, setTodoAddButton] = useState(true);
  const [disableAddButton, setDisableAddButton] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState(null);
  const [totalComplete, setTotalComplete] = useState(0);
  const [tempTodoID, setTempTodoID] = useState(null);
  const [totalLocalComplete, setTotalLocalComplete] = useState(0);

  // Handles the opening and closing of the add todo modal and remove todo modal
  const handleClose = () => setShow(false) & setTempTodo('');
  const handleShow = () => setShow(true);

  const handleDeleteClose = () => setShowDelete(false);
  const handleDeleteShow = () => setShowDelete(true);


  // UseEffect function to check if the user is connected to PeraWallet, if so, check the local state of the app. Refresh and recheck on every account change.
  useEffect(() => {
    if (accountAddress) {
      checkLocalTodosState();
    }
    peraWallet.reconnectSession().then((accounts) => {
      peraWallet.connector?.on('disconnect', handleDisconnectWalletClick);

      if (accounts.length) {
        setAccountAddress(accounts[0]);
        checkLocalTodosState();
      }
    })
  },[accountAddress])

  // This function handles the connection to PeraWallet when the connect button is clicked
  function handleConnectWalletClick() {
    peraWallet.connect().then((newAccounts) => {
      // setup the disconnect event listener
      peraWallet.connector?.on('disconnect', handleDisconnectWalletClick);

      setAccountAddress(newAccounts[0]);
    });
  }

  // This function handles the connection to PeraWallet when the disconnect button is clicked
  function handleDisconnectWalletClick() {
    peraWallet.disconnect();
    setAccountAddress(null);
  }

  // This function handles the checking and allowance of opting into the app itself
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
      console.log(result);
  }

  // This function handles the checking of the local todo states within the app specific to the user
  async function checkLocalTodosState() {
    // This try catch will check if the user has any currently stored todos in the app, if so it will then add them to the localTodos state variable
    try {
      const accountInfo = await algod.accountApplicationInformation(accountAddress,appIndex).do();
      const counter = await algod.getApplicationByID(appIndex).do();
      const todoLength = accountInfo['app-local-state']['key-value'].length;
      if(!!accountInfo['app-local-state']['key-value']) {
        const todos = [];
        let tempTodoCount = [];
        for(let i = 0; i < todoLength; i++) {
          if (Buffer.from(accountInfo['app-local-state']['key-value'][i].key, 'base64').toString('ascii') !== "Count") {
            todos.push({key: Buffer.from(accountInfo['app-local-state']['key-value'][i].key, 'base64').toString('ascii'), value: Buffer.from(accountInfo['app-local-state']['key-value'][i].value.bytes, 'base64').toString('ascii')});
            let tempCount = (Buffer.from(accountInfo['app-local-state']['key-value'][i].key, 'base64').toString('ascii'));
            tempTodoCount.push(parseInt(tempCount));
          } else if (Buffer.from(accountInfo['app-local-state']['key-value'][i].key, 'base64').toString('ascii') === "Count") {
            setTotalLocalComplete(accountInfo['app-local-state']['key-value'][i].value.uint);
          }
        }
        todos.sort((a,b) => a.key.localeCompare(b.key));
        tempTodoCount.sort((a,b) => a - b);
        setTempTodoID(Math.max(...tempTodoCount)+1);
        checkMaxTodo(todos.length);
        setLocalTodos(todos);
      } else {
        setLocalTodos([]);
      }

      // This if statement will check the total value of globally completed todos and set the totalComplete state variable
      if(!!counter.params['global-state'][0].value.uint) {
        setTotalComplete(counter.params['global-state'][0].value.uint);
      } else {
        setTotalComplete(0);
      }
    } catch (e) {
      console.error('There was an error connecting to the todo app: ', e)
    }
  }

  // This function handles the adding of a todo to the app
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
        setTempTodo('');
    } catch (e) {
      console.error('There was an error connecting to the todo app: ', e)
    }
  }

  // This function handles the completion of a todo which will remove it from the users account and add a +1 to the global counter and local counter
  async function removeTodo(action, todoID) {
    try {
      const suggestedParams = await algod.getTransactionParams().do();
      const appArgs = [new Uint8Array(Buffer.from(action)), new Uint8Array(Buffer.from(todoID))];

      const removeTodoTxn = algosdk.makeApplicationNoOpTxn(
        accountAddress,
        suggestedParams,
        appIndex,
        appArgs
      );

      const removeTodoTxGroup = [{txn: removeTodoTxn, signers: [accountAddress]}];

        const signedTx = await peraWallet.signTransaction([removeTodoTxGroup]);
        console.log(signedTx);
        const { txId } = await algod.sendRawTransaction(signedTx).do();
        const result = await waitForConfirmation(algod, txId, 2);
        console.log("Remove result", result);
        checkLocalTodosState();
    } catch (e) {
      console.error('There was an error connecting to the todo app: ', e)

    }
  }

  // This function handles the addition of a todo to the users account by setting the value of the tempTodo state variable
  const addTodoHandler = (e) => {
    e.preventDefault();
    if (e.target.value === '') {
      setTodoAddButton(true);
      return;
    } else {
      setTempTodo(e.target.value);
      setTodoAddButton(false);
    }
  }

  // This function handles the removal of a todo from the users account by setting the value of the todoToDelete state variable
  const removeTodoHandler = (e) => {
    let value = e.target.value;
    setTodoToDelete(value);
  }

  // This function is for error checking since the current app only allows for 10 todos to be added it will disable the button if the user has 10 todos already
  const checkMaxTodo = (length) => {
    if (length >= 10) {
      setDisableAddButton(true);
    } else {
      setDisableAddButton(false);
    }
  }

  return (
    <div className="App">
      <Container>
        <br/>
        <h1>AlgoHub Final Assessment - Todo List</h1>
        <br/>
        <Row>
            <Col>
              <Button className='btn-connect' onClick={
                isConnectedToPeraWallet ? handleDisconnectWalletClick : handleConnectWalletClick}>{isConnectedToPeraWallet ? "Disconnect" : "Connect to Pera Wallet"}
              </Button>
            </Col>
            <Col>
              {totalComplete ? <h4>Total Global Complete: {totalComplete}</h4> : null}
              {totalLocalComplete ? <h4>Total User Completed Todos: {totalLocalComplete}</h4> : null}
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
        <br/>
        <Row className='todo-list-row'>
          <Container className='todo-list-container'>
            <Row>
              <Col>
              <h4>Todo List</h4>
              {!localTodos && localTodos.length > 0 ? (<p>No todos yet</p>) : (
                localTodos?.map((todo, index) => (
                  <div key={index}>{index + 1}: {todo.value}</div>
                ))
                )}
              </Col>
            </Row>
          </Container>
          <Container>
            <Row>
                {!todoAddButton && localTodos.length === 10 ?  (<p>Your todo list is full! Please remove one before adding another</p>): <></> }
                <Row className='btn-row'>
                  <Button className='btn-add' onClick={handleShow} disabled={disableAddButton} data-bs-toggle="modal" data-bs-target="#add-modal">Add Todo</Button>
                </Row>
                <Row className='btn-row'>
                  <Button className='btn-add' onClick={handleDeleteShow} data-bs-toggle="modal" data-bs-target="#delete-modal">Remove Todo</Button>
                </Row>
                <Modal show={show} onHide={handleClose} id="add-modal">
                  <Modal.Header closeButton>
                    <Modal.Title>Add Todo</Modal.Title>
                    <Modal.Body>
                      <input type='text' placeholder='Enter Todo' value={tempTodo} onChange={(e) => addTodoHandler(e)}></input>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={handleClose}>
                        Close
                      </Button>
                        <Button variant="primary" onClick={() => addTodo('Add_Local_Todo', localTodos.length > 0 ? `${tempTodoID}` : '0', tempTodo) & handleClose()} disabled={todoAddButton}>
                          Submit
                        </Button>
                    </Modal.Footer>
                  </Modal.Header>
                </Modal>
                <Modal show={showDelete} onHide={handleDeleteClose} id="delete-modal" >
                  <Modal.Header closeButton>
                    <Modal.Title>Remove Todo</Modal.Title>
                    <Modal.Body>
                      <Row>
                        <Col>
                          <Form.Select aria-label='Select Todo to Remove' onChange={(e) => removeTodoHandler(e)}>
                            <option value=''>Select Todo to Remove</option>
                            {localTodos?.map((todo) => (
                              <>
                                <option value={todo.key} key={todo.key}>{todo.value}</option>
                              </>
                            ))}
                          </Form.Select>
                        </Col>
                      </Row>
                      <span></span>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={handleDeleteClose}>
                        Close
                      </Button>
                        <Button variant="primary" onClick={() => removeTodo('Complete_Local_Todo', todoToDelete) & handleDeleteClose()}>
                          Submit
                        </Button>
                    </Modal.Footer>
                  </Modal.Header>
                </Modal>
              </Row>
          </Container>
        </Row>
      </Container>
    </div>
  );
}

export default App;
