/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       James Bush - james.bush@modusbox.com                             *
 **************************************************************************/

'use strict';

const util = require('util');
const Ilp = require('../../lib/ilp');
const IlpPacket = require('ilp-packet');

const quoteRequest = require('./data/quoteRequest');
const partialResponse = require('./data/partialResponse');

describe('ILP', () => {
    let ilp;

    beforeEach(() => {
        ilp = new Ilp({secret: 'test'});
    });

    test('Should generate ILP components for a quote response given a quote request and partial response', () => {
        const {
            fulfilment,
            ilpPacket,
            condition
        } = ilp.getQuoteResponseIlp(quoteRequest, partialResponse);

        expect(fulfilment).toBeTruthy();
        expect(ilpPacket).toBeTruthy();
        expect(condition).toBeTruthy();
    });


    test('ILP packet should contain a valid transaction object', () => {
        const {ilpPacket} = ilp.getQuoteResponseIlp(quoteRequest, partialResponse);

        const binaryPacket = Buffer.from(ilpPacket, 'base64');
        const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket);
        console.log(`Decoded ILP packet: ${util.inspect(jsonPacket)}`);

        const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString('utf8'), 'base64').toString('utf8'));

        console.log(`Decoded ILP packet data element: ${util.inspect(dataElement)}`);
    });


    test('ILP fulfilment should match condition', () => {
        const {fulfilment, ilpPacket, condition} = ilp.getQuoteResponseIlp(quoteRequest, partialResponse);

        const binaryPacket = Buffer.from(ilpPacket, 'base64');
        const jsonPacket = IlpPacket.deserializeIlpPacket(binaryPacket);
        console.log(`Decoded ILP packet: ${util.inspect(jsonPacket)}`);

        const dataElement = JSON.parse(Buffer.from(jsonPacket.data.data.toString('utf8'), 'base64').toString('utf8'));

        console.log(`Decoded ILP packet data element: ${util.inspect(dataElement)}`);

        const valid = ilp.validateFulfil(fulfilment, condition);

        console.log(`Valudate fulfilment returned ${valid}`);

        expect(valid).toBeTruthy();
    });
});

describe('Ilp Packet Decoding and Validation', () => {
    let ilp;
    let ilpCombo;
    const transferRequest = require('./data/transferRequest');

    beforeEach(() => {
        ilp = new Ilp({secret: 'test'});
        ilpCombo = ilp.getQuoteResponseIlp(quoteRequest, partialResponse);
        transferRequest.ilpPacket = ilpCombo.ilpPacket;
        transferRequest.condition = ilpCombo.condition;
    });

    test('Should decode the IlpPacket', () => {
        const decodedIlp = ilp.decodeIlpPacket(ilpCombo.ilpPacket);
        
        expect(decodedIlp).toBeTruthy();
        expect(decodedIlp).toHaveProperty('amount');
        expect(decodedIlp).toHaveProperty('account');
        expect(decodedIlp).toHaveProperty('data');
    });

    test('Should generate transaction object from an Ilp packet', () => {
        const transactionObject = ilp.getTransactionObject(ilpCombo.ilpPacket);
        
        expect(transactionObject).toBeTruthy();
        expect(transactionObject).toHaveProperty('transactionId');
        expect(transactionObject).toHaveProperty('quoteId');
        expect(transactionObject).toHaveProperty('payee');
        expect(transactionObject).toHaveProperty('payer');
        expect(transactionObject).toHaveProperty('amount');
        expect(transactionObject).toHaveProperty('transactionType');
    });

    test('Should validate the transfer request against the decoded Ilp packet', () => {
        const validation = ilp.validateIlpAgainstTransferRequest(transferRequest);
        
        expect(validation).toBe(true);
    });

    test('Should fail the validation if the data in transfer request is changed', () => {
        transferRequest.amount.amount = '200';
        const validation = ilp.validateIlpAgainstTransferRequest(transferRequest);
        
        expect(validation).toBe(false);
    });

});
