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
import { OverlayTrigger } from 'react-bootstrap';

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
  const [tempTodo, setTempTodo] = useState('');
  const [todoAddButton, setTodoAddButton] = useState(true);
  const [disableAddButton, setDisableAddButton] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleClose = () => setShow(false) & setTempTodo('');
  const handleShow = () => setShow(true);

  const handleDeleteClose = () => setShow(false);
  const handleDeleteShow = () => setShow(true);

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
          todos.sort((a,b) => a.key.localeCompare(b.key));
          // const tempSortTodos = todos.map((todo) => parseInt(todo.key.replace(/^\D+/g, "")));
         
          // tempSortTodos.sort((a,b) => a-b);
          // console.log(tempSortTodos);
          // console.log("SORTED TODOS", todos);
          checkMaxTodo(todos.length);
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
          setTempTodo('');
      } catch (e) {
        console.error('There was an error connecting to the todo app: ', e)
      }
      
    }

    async function removeTodo(actio, todoID, todoName) {
      
    }

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

    const removeTodoHandler = (e) => {
      e.preventDefault();
     
    }

    const checkMaxTodo = (length) => {
      if (length >= 10) {
        setDisableAddButton(true);
      } else {
        setDisableAddButton(false);
      }
    }

    const tooltip = (<Tooltip target="disabled-todo" placement="top" id="tooltip" >Too many Todos in List</Tooltip>);

  return (
    <div className="App">
      <Container>
        <br/>
        <h1>AlgoHub Final Assessment - Todo List</h1>
        <br/>
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
                {!todoAddButton ?  <></>: (<p>Your todo list is full! Please remove one before adding another</p>) }
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
                        <Button variant="primary" onClick={() => 
                          addTodo('Add_Local_Todo', localTodos.length > 0 ? `Todo${localTodos.length+1}` : 1, tempTodo) & handleClose()
                          // console.log('Add_Local_Todo', localTodos.length > 0 ? `Todo${localTodos.length+1}` : 1, tempTodo) & handleClose()
                          } disabled={todoAddButton} >
                          Submit
                        </Button>
                    </Modal.Footer>
                  </Modal.Header>
                </Modal>
                <Modal show={showDelete} onHide={handleDeleteClose} id="delete-modal" >
                  <Modal.Header closeButton>
                    <Modal.Title>Remove Todo</Modal.Title>
                    <Modal.Body>
                      {localTodos?.map((todo, index) => (
                        <div key={index}>{index + 1}: {todo.value}</div>
                      ))}
                      <span></span>
                      {/* <input type='text' placeholder='Remove Todo' value={tempTodo} onChange={(e) => removeTodoHandler(e)}></input> */}
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={handleClose}>
                        Close
                      </Button>
                        <Button variant="primary" onClick={() => 
                          // removeTodo('Remove_Local_Todo',  , tempTodo) & handleDeleteClose()
                          console.log('Remove_Local_Todo', localTodos.length > 0 ? `Todo${localTodos.length+1}` : 1, tempTodo) & handleDeleteClose()
                          // console.log('Add_Local_Todo', localTodos.length > 0 ? `Todo${localTodos.length+1}` : 1, tempTodo) & handleClose()
                          }>
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
