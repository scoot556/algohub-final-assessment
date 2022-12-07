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
// import { InputGroup, OverlayTrigger } from 'react-bootstrap';
import InputGroup from 'react-bootstrap/InputGroup';
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

  const handleClose = () => setShow(false) & setTempTodo('');
  const handleShow = () => setShow(true);

  const handleDeleteClose = () => setShowDelete(false);
  const handleDeleteShow = () => setShowDelete(true);

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
            // else {
            //   console.log("Count: " + Buffer.from(accountInfo['app-local-state']['key-value'][i].value.bytes, 'base64').toString('ascii'));
            //   setTotalComplete(Buffer.from(accountInfo['app-local-state']['key-value'][i].value.bytes, 'base64').toString('ascii'));
            // }
          }
          // console.log("TODOS", todos, tempTodoCount);
          todos.sort((a,b) => a.key.localeCompare(b.key));
          tempTodoCount.sort((a,b) => a - b);
          console.log("TODOS SORTED", todos, tempTodoCount, tempTodoCount.length);;
          // let XOR = 0;
          // for(let i=0; i<tempTodoCount.length; i++) {
          //     if (tempTodoCount[i] !== 0)
          //         XOR ^= tempTodoCount[i];
          //         console.log("XOR", XOR);
          //     XOR ^= (i + 1);
          //     console.log("SECOND XOR", XOR);
          // }
          // console.log(XOR);
          setTempTodoID(Math.max(...tempTodoCount)+1);
          // const tempSortTodos = todos.map((todo) => parseInt(todo.key.replace(/^\D+/g, "")));
         
          // tempSortTodos.sort((a,b) => a-b);
          // console.log(tempSortTodos);
          // console.log("SORTED TODOS", todos);
          checkMaxTodo(todos.length);
          setLocalTodos(todos);
        } else {
          setLocalTodos([]);
        }

        if(!!counter.params['global-state'][0].value.uint) {
          setTotalComplete(counter.params['global-state'][0].value.uint);
        } else {
          setTotalComplete(0);
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

    async function removeTodo(action, todoID) {
      console.log("REMOVE TODO", action, todoID);
      try {
        const suggestedParams = await algod.getTransactionParams().do();
        const appArgs = [new Uint8Array(Buffer.from(action)), new Uint8Array(Buffer.from(todoID))];
        console.log("APP ARGS", appArgs);

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
      // console.log(e)
      // let obj = JSON.parse(e.target.value);
      let value = e.target.value;
      // console.log("REMOVE TODO", value, obj);
      setTodoToDelete(value);
      
     
    }

    const checkMaxTodo = (length) => {
      if (length >= 10) {
        setDisableAddButton(true);
      } else {
        setDisableAddButton(false);
      }
    }

    const tooltip = (<Tooltip target="disabled-todo" placement="top" id="tooltip" >Too many Todos in List</Tooltip>);

    function findMissing(arr, N) {
      // let i;
      // let temp = [];
      // let min = Math.min(...arr);
      // console.log(min)
      // for (i = 0; i <= N; i++) {
      //   temp[i] = 0;
      // }
      // for (i=0; i < N; i++) {
      //   temp[arr[i] - 1] = 1;
      // }
      // let ans = 0;
      // for (i=0;i<=N;i++) {
      //   if (temp[i] === 0) {
      //     ans = i+1;
      //   }
      // }
      // console.log(ans);
      let total = Math.floor((N+1)*(N+2)/2);
      for (let i = 0; i < N; i++) {
        total -= arr[i];
      }
      console.log(total);
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
                          addTodo('Add_Local_Todo', localTodos.length > 0 ? `${tempTodoID}` : '0', tempTodo) & handleClose()
                          // console.log('Add_Local_Todo', localTodos.length > 0 ? localTodos.length+1 : 0, tempTodo) & handleClose()
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
                      {/* <Row>
                        <Col>
                          <h4>Todo</h4>
                        </Col>
                        <Col>
                          <h4>Remove?</h4>
                        </Col>
                      </Row> */}
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
                      {/* <input type='text' placeholder='Remove Todo' value={tempTodo} onChange={(e) => removeTodoHandler(e)}></input> */}
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" onClick={handleDeleteClose}>
                        Close
                      </Button>
                        <Button variant="primary" onClick={() => 
                          removeTodo('Complete_Local_Todo', todoToDelete) & handleDeleteClose()
                          // console.log('Remove_Local_Todo', todoToDelete) & handleDeleteClose()
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
