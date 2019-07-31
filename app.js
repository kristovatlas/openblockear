/*jslint devel: true */
/*jslint browser:true */
/*global WebSocket, $ */

var DEBUG = false;
var WARN = true;
var ERROR = true;
var INFO = true;

/**
 * Print debug statement
 * @param {string} msg Debug message
 */
function debug(msg) {
    'use strict';
    if (DEBUG) {
        console.log("DEBUG: " + msg);
    }
}

/**
 * Print warning statement
 * @param {string} msg Warning message
 */
function warn(msg) {
    'use strict';
    if (WARN) {
        console.log("WARNING: " + msg);
    }
}

/**
 * Print info statement
 * @param {string} msg Info message
 */
function info(msg) {
    'use strict';
    if (INFO) {
        console.log("INFO: " + msg);
    }
}

/**
 * Print error statement
 * @param {string} msg Error message
 */
function error(msg) {
    'use strict';
    if (ERROR) {
        console.log("ERROR: " + msg);
    }
}

/**
 * Assert condition
 * @param {boolean} condition The statement which should be true
 * @param {string} message The error to write to console if condition is false
 * https://stackoverflow.com/questions/15313418/what-is-assert-in-javascript
 */
function assert(condition, message) {
    'use strict';
    if (!condition) {
        message = message || "Assertion failed";
        try {
            throw new Error(message);
        } catch (err) {
            throw message;
        }
    }
}

/**
 * Get current time human readable (UTC)
 */
function getTimestamp() {
    'use strict';
    return new Date().toUTCString();
}

/**
 * Play Mario coin noise when new BTC block is found
 */
function playCoin() {
    'use strict';
    try {
        document.getElementById('sound').play();
    } catch (err) {
        error("Unable to play coin:" + err);
    }
}

/**
 * Validate length and charset is consistent with Bitcoin transaction ID
 * @param {string} txid The string to validate
 */
function validateTxidFormat(txid) {
    'use strict';
    var REGEX = /[0-9A-Fa-f]{64}/g;
    return REGEX.test(txid);
}

/**
 * Fetch raw transaction data from blockchain.info API
 */
function getRawTx(txid) {
    'use strict';
    assert(validateTxidFormat(txid), 'Invalid txid: ' + txid);
    var url = 'https://blockchain.info/rawtx/' + txid + '?cors=true',
        xhttp = new XMLHttpRequest();
    xhttp.open("GET", url, false);
    xhttp.send();
    return JSON.parse(xhttp.responseText);
}

/**
 *  Get current integer height of chain tip where genesis is 0
 */
function getCurrentChainHeight() {
    'use strict';
    var url = 'https://blockchain.info/latestblock?cors=true',
        xhttp = new XMLHttpRequest(),
        tip;
    xhttp.open("GET", url, false);
    xhttp.send();
    tip = JSON.parse(xhttp.responseText);
    return tip.height;
}

/**
 *  Get the number of confirmations for given transaction
 * @param {string} txid The hash of the BTC transaction
 */
function getNumConfirmations(txid) {
    'use strict';
    assert(validateTxidFormat(txid), 'Invalid txid: ' + txid);

    var rawtx = getRawTx(txid),
        txHeight,
        currentHeight;
    assert(rawtx.hash === txid, "Hash mismatch");
    txHeight = rawtx.block_height;
    if (txHeight === undefined) { return 0; }
    currentHeight = getCurrentChainHeight();
    return currentHeight - txHeight + 1;
}

/**
 * Update innerHTML of HTML element
 * @param {string} elementPath The element to update
 * @param {string} newText The contents to update innerHTML to
 * https://stackoverflow.com/questions/1309452/how-to-replace-innerhtml-of-a-div-using-jquery
 */
function changeInnerHtml(elementPath, newText) {
    'use strict';
    $(elementPath).fadeOut(500, function () {
        $(this).html(newText).fadeIn(500);
    });
}

/**
 * When we receive a block, go through all transactions watched and updated confs
 */
function updateConfirmations() {
    'use strict';
    debug("Entered updateConfirmations()");

    //https://stackoverflow.com/questions/24266313/using-foreach-on-an-array-from-getelementsbyclassname-results-in-typeerror-und
    var divs = Array.from(document.getElementsByTagName('div'));
    debug("Found " + divs.length + " divs.");


    if (divs !== null) {
        debug("typeof divs: " + typeof divs);
        divs.forEach(function (div) {
            var divId = div.getAttribute('id'),
                txid,
                confs,
                newText,
                divSelector;
            if (divId !== null) {
                debug("Examining div: "  + divId);
                if (divId.startsWith('tx_')) {
                    txid = divId.substring(3);
                    confs = getNumConfirmations(txid);
                    newText = "<span>" + txid + "</span> <span>&nbsp;&nbsp;&nbsp;&nbsp;</span> <span><b>" + confs + "</b> confirmations</span>";
                    divSelector = '#' + divId;
                    changeInnerHtml(divSelector, newText);
                    debug("Updated div " + divId + " with "  + confs + " confirmations.");
                }
            }
        });
    }
}

/**
 * Web socket handler
 */
function wsConnect() {
    'use strict';
    if (window.hasOwnProperty('WebSocket')) {
        info("WebSocket is supported by your Browser!");

        // Let us open a web socket
        var ws = new WebSocket("wss://ws.blockchain.info/inv");
        ws.onopen = function () {

            // Web Socket is connected, send data using send()
            ws.send('{"op":"ping"}');
            info("PING sent...");
        };

        ws.onmessage = function (evt) {
            var receivedMsg = evt.data;
            debug("Received ws message: " + receivedMsg);
            if (receivedMsg === '{"op":"pong"}') {
                // PONG received, subscribe to blocks
                document.getElementById('status').innerHTML = 'Connected to Blockchain.com. Waiting for new blocks...';
                ws.send('{"op":"blocks_sub"}');
                info("Subscribed to new blocks.");
            } else if (receivedMsg.includes('"op" : "block"')) {
                info("New block received.");
                document.getElementById('status').innerHTML = 'Block received at: ' + getTimestamp();
                updateConfirmations();
                playCoin();
            } else {
                warn("Unrecognized message type.");
            }
        };

        ws.onclose = function () {
            // websocket is closed.
            info("Connection is closed...");
            info("Attempting to reconnect...");
            ws = new WebSocket("wss://ws.blockchain.info/inv");
        };
    } else {
        // The browser doesn't support WebSocket
        alert("WebSocket NOT supported by your Browser!");
    }
}

/**
 * Create button that when pressed will show field to add BTC tx to track
 */
function createAddButton() {
    'use strict';
    if (document.getElementById('add_button_div') === null) {
        $('#bottom').after('<div id="add_button_div"><input type="button" value="Click here to add a BTC transaction ID to watch" id="add_button" onclick="addTransactionRow()" /></div>');
    }
}

/**
 * Remove the button created by createAddButton()
 */
function removeAddButton() {
    'use strict';
    if (document.getElementById('add_button_div') !== null) {
        $('#add_button_div').remove();
    }
}

/**
 * Create text field to receive BTC tx id for tracking
 */
function createTxidInput() {
    'use strict';
    if (document.getElementById('temp_new_div') === null) {
        $('#bottom').before('<div id="temp_new_div"><b>TXID:</b> <form style="margin: 0; padding: 0;"><input type="text" id="txid" size="65" maxlength="64" /><input type="submit" value="Track" formaction="javascript:trackTx(document.getElementById(\'txid\').value)" /></form></div>');
    }
}

/**
 * Remove text field created by createTxidInput()
 */
function removeTxidInput() {
    'use strict';
    if (document.getElementById('temp_new_div') !== null) {
        $('#temp_new_div').remove();
    }
}

/**
 * Add transction to list of tracked transactions, displaying # of confs for each
 * @param {string} txid The hash of the BTC transaction
 */
function trackTx(txid) {
    'use strict';
    assert(validateTxidFormat(txid), 'Invalid txid: ' + txid);
    var confs = getNumConfirmations(txid);
    $('#top').after('<div id="tx_' + txid + '"><span>' + txid + '</span> <span>&nbsp;&nbsp;&nbsp;&nbsp;</span> <span><b>' + confs + '</b> confirmations</span></div>');

    //Done with this field
    removeTxidInput();
    createAddButton();
}

/**
 * Set up text field to receive transaction ID for tracking
 */
function addTransactionRow() {
    'use strict';
    createTxidInput();
    removeAddButton();
    document.getElementById("txid").focus();
}
