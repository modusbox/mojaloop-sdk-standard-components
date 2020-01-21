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
const request = require('request-promise-native');

const http = require('http');
const https = require('https');

const common = require('./common.js');
const buildUrl = common.buildUrl;
const throwOrJson = common.throwOrJson;

const JwsSigner = require('../jws').signer;

/**
 * A class for making outbound requests with mutually authenticated TLS and JWS signing
 */
class MojaloopRequests {
    constructor(config) {
        this.logger = config.logger;

        // FSPID of THIS DFSP
        this.dfspId = config.dfspId;

        if(config.tls.outbound.mutualTLS.enabled) {
            this.agent = new https.Agent({
                ...config.tls.outbound.creds,
                keepAlive: true
            });

            this.transportScheme = 'https';
        }
        else {
            this.agent = http.globalAgent;
            this.transportScheme = 'http';
        }

        // flag to turn jws signing on/off
        this.jwsSign = config.jwsSign;

        // if no jwsSignPutParties config is supplied it inherits the value of config.jwsSign
        if(typeof (config.jwsSignPutParties) === 'undefined') {
            this.jwsSignPutParties = config.jwsSign;
        }
        else {
            this.jwsSignPutParties = config.jwsSignPutParties;
        }

        this.jwsSigner = new JwsSigner({
            logger: config.logger,
            signingKey: config.jwsSigningKey
        });

        // Switch or peer DFSP endpoint
        this.peerEndpoint = `${this.transportScheme}://${config.peerEndpoint}`;
        this.alsEndpoint = config.alsEndpoint ? `${this.transportScheme}://${config.alsEndpoint}` : null;
        this.quotesEndpoint = config.quotesEndpoint ? `${this.transportScheme}://${config.quotesEndpoint}` : null;
        this.transfersEndpoint = config.transfersEndpoint ? `${this.transportScheme}://${config.transfersEndpoint}` : null;
        this.transactionRequestsEndpoint = config.transactionRequestsEndpoint ? `${this.transportScheme}://${config.transactionRequestsEndpoint}` : null;

        this.wso2Auth = config.wso2Auth;
    }


    /**
     * Executes a GET /parties request for the specified identifier type and identifier
     *
     * @returns {object} - JSON response body if one was received
     */
    async getParties(idType, idValue, idSubValue, span) {
        const url = `parties/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '');
        return this._get(url, 'parties', undefined, span);
    }


    /**
     * Executes a PUT /parties request for the specified identifier type and indentifier
     */
    async putParties(idType, idValue, idSubValue, body, destFspId, span) {
        const url = `parties/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '');
        return this._put(url, 'parties', body, destFspId, span);
    }

    /**
     * Executes a PUT /parties/{IdType}/{IdValue}/error request for the specified identifier type and indentifier
     */
    async putPartiesError(idType, idValue, idSubValue, error, destFspId, span) {
        const url = `parties/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '')
            + '/error';
        return this._put(url, 'parties', error, destFspId, span);
    }

    /**
     * Executes a POST /participants request
     *
     * @returns {object} - JSON response body if one was received
     */
    async postParticipants(request, destFspId, span) {
        return this._post('participants', 'participants', request, destFspId, span);
    }

    /**
     * Executes a PUT /participants request for the specified identifier type and indentifier
     */
    async putParticipants(idType, idValue, idSubValue, body, destFspId, span) {
        const url = `participants/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '');
        return this._put(url, 'participants', body, destFspId, span);
    }


    /**
     * Executes a PUT /participants/{idType}/{idValue}/error request for the specified identifier type and indentifier
     */
    async putParticipantsError(idType, idValue, idSubValue, error, destFspId, span) {
        const url = `participants/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '')
            + '/error';
        return this._put(url, 'participants', error, destFspId, span);
    }


    /**
     * Executes a POST /quotes request for the specified quote request
     *
     * @returns {object} - JSON response body if one was received
     */
    async postQuotes(quoteRequest, destFspId, span) {
        return this._post('quotes', 'quotes', quoteRequest, destFspId, span);
    }


    /**
     * Executes a PUT /quotes/{ID} request for the specified quote
     */
    async putQuotes(quoteId, quoteResponse, destFspId, span) {
        return this._put(`quotes/${quoteId}`, 'quotes', quoteResponse, destFspId, span);
    }


    /**
     * Executes a PUT /quotes/{ID} request for the specified quote
     */
    async putQuotesError(quoteId, error, destFspId, span) {
        return this._put(`quotes/${quoteId}/error`, 'quotes', error, destFspId, span);
    }


    /**
     * Executes a POST /transfers request for the specified transfer prepare
     *
     * @returns {object} - JSON response body if one was received
     */
    async postTransfers(prepare, destFspId, span) {
        return this._post('transfers', 'transfers', prepare, destFspId, span);
    }


    /**
     * Executes a PUT /transfers/{ID} request for the specified transfer fulfilment
     *
     * @returns {object} - JSON response body if one was received
     */
    async putTransfers(transferId, fulfilment, destFspId, span) {
        return this._put(`transfers/${transferId}`, 'transfers', fulfilment, destFspId, span);
    }


    /**
     * Executes a PUT /transfers/{ID}/error request for the specified error
     *
     * @returns {object} - JSON response body if one was received
     */
    async putTransfersError(transferId, error, destFspId, span) {
        return this._put(`transfers/${transferId}/error`, 'transfers', error, destFspId, span);
    }

    /**
     * Executes a POST /transactionRequests request for the specified transaction request
     *
     * @returns {object} - JSON response body if one was received
     */
    async postTransactionRequests(transactionRequest, destFspId, span) {
        return this._post('transactionRequests', 'transactionRequests', transactionRequest, destFspId, span);
    }

    /**
     * Executes a PUT /transactionRequests/{ID} request for the specified transaction request
     *
     * @returns {object} - JSON response body if one was received
     */
    async putTransactionRequests(transactionRequestId, transactionRequestResponse, destFspId, span) {
        return this._put(`transactionRequests/${transactionRequestId}`, 'transactionRequests', transactionRequestResponse, destFspId, span);
    }

    /**
     * Executes a PUT /transactionRequests/{ID}/error request for the specified error
     *
     * @returns {object} - JSON response body if one was received
     */
    async putTransactionRequestsError(transactionRequestId, error, destFspId, span) {
        return this._put(`transactionRequests/${transactionRequestId}/error`, 'transactionRequests', error, destFspId, span);
    }

    /**
     * Executes a GET /authorizations request for the specified transactionRequestId
     *
     * @returns {object} - JSON response body if one was received
     */
    async getAuthorizations(transactionRequestId, authorizationParameters, destFspId, span) {
        const url = `authorizations/${transactionRequestId}?${authorizationParameters}`;
        return this._get(url , 'authorizations', destFspId, span);
    }

    /**
     * Executes a PUT /authorizations/{ID} request for the specified transactionRequestId
     *
     * @returns {object} - JSON response body if one was received
     */
    async putAuthorizations(transactionRequestId, authorizationResponse, destFspId, span) {
        return this._put(`authorizations/${transactionRequestId}`, 'authorizations', authorizationResponse, destFspId, span);
    }

    /**
     * Executes a PUT /authorizations/{ID}/error request for the specified transactionRequestId
     *
     * @returns {object} - JSON response body if one was received
     */
    async putAuthorizationsError(transactionRequestId, error, destFspId, span) {
        return this._put(`authorizations/${transactionRequestId}/error`, 'authorizations', error, destFspId, span);
    }

    /**
     * Utility function for building outgoing request headers as required by the mojaloop api spec
     *
     * @returns {object} - headers object for use in requests to mojaloop api endpoints
     */
    async _buildHeaders (method, resourceType, dest, span) {
        let headers = {
            'content-type': `application/vnd.interoperability.${resourceType}+json;version=1.0`,
            'date': new Date().toUTCString(),
            'fspiop-source': this.dfspId
        };

        if(dest) {
            headers['fspiop-destination'] = dest;
        }

        //Need to populate Bearer Token if we are in OAuth2.0 environment
        if (this.wso2Auth) {
            const token = this.wso2Auth.getToken();
            if(token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        // dont add accept header to PUT requests
        if(method.toUpperCase() !== 'PUT') {
            headers['accept'] = `application/vnd.interoperability.${resourceType}+json;version=1.0`;
        }
        if(span) {
            const request = await span.injectContextToHttpRequest({headers});
            return request.headers;
        } else {
            return headers;
        }
    }

    /**
     * Utility function for picking up the right endpoint based on the resourceType
     */
    _pickPeerEndpoint(resourceType) {
        let returnEndpoint;
        switch(resourceType) {
            case 'parties':
                returnEndpoint = this.alsEndpoint ? this.alsEndpoint : this.peerEndpoint;
                break;
            case 'participants':
                returnEndpoint = this.alsEndpoint ? this.alsEndpoint : this.peerEndpoint;
                break;
            case 'quotes':
                returnEndpoint = this.quotesEndpoint ? this.quotesEndpoint : this.peerEndpoint;
                break;
            case 'transfers':
                returnEndpoint = this.transfersEndpoint ? this.transfersEndpoint : this.peerEndpoint;
                break;
            case 'transactionRequests':
                returnEndpoint = this.transactionRequestsEndpoint ? this.transactionRequestsEndpoint : this.peerEndpoint;
                break;
            case 'authorizations':
                returnEndpoint = this.transactionRequestsEndpoint ? this.transactionRequestsEndpoint : this.peerEndpoint;
                break;
            default:
                returnEndpoint = this.peerEndpoint;
        }
        return returnEndpoint;
    }


    async _get(url, resourceType, dest, span) {
        const reqOpts = {
            method: 'GET',
            uri: buildUrl(this._pickPeerEndpoint(resourceType), url),
            headers: await this._buildHeaders('GET', resourceType, dest, span),
            agent: this.agent,
            resolveWithFullResponse: true,
            simple: false
        };

        // Note we do not JWS sign requests with no body i.e. GET requests

        try {
            this.logger.log(`Executing HTTP GET: ${util.inspect(reqOpts)}`);
            return request(reqOpts).then(throwOrJson);
        }
        catch (e) {
            this.logger.log('Error attempting GET. URL:', url, 'Opts:', reqOpts, 'Error:', e);
            throw e;
        }
    }


    async _put(url, resourceType, body, dest, span) {
        const reqOpts = {
            method: 'PUT',
            uri: buildUrl(this._pickPeerEndpoint(resourceType), url),
            headers: await this._buildHeaders('PUT', resourceType, dest, span),
            body: body,
            agent: this.agent,
            resolveWithFullResponse: true,
            simple: false
        };

        if(this.jwsSign && (resourceType === 'parties' ? this.jwsSignPutParties : true)) {
            this.jwsSigner.sign(reqOpts);
        }

        reqOpts.body = this._bodyStringifier(reqOpts.body);

        try {
            this.logger.log(`Executing HTTP PUT: ${util.inspect(reqOpts)}`);
            return request(reqOpts).then(throwOrJson);
        }
        catch (e) {
            this.logger.log('Error attempting PUT. URL:', url, 'Opts:', reqOpts, 'Body:', body, 'Error:', e);
            throw e;
        }
    }


    async _post(url, resourceType, body, dest, span) {
        const reqOpts = {
            method: 'POST',
            uri: buildUrl(this._pickPeerEndpoint(resourceType), url),
            headers: await this._buildHeaders('POST', resourceType, dest, span),
            body: body,
            agent: this.agent,
            resolveWithFullResponse: true,
            simple: false
        };

        if(this.jwsSign) {
            this.jwsSigner.sign(reqOpts);
        }

        reqOpts.body = this._bodyStringifier(reqOpts.body);

        try {
            this.logger.log(`Executing HTTP POST: ${util.inspect(reqOpts)}`);
            return request(reqOpts).then(throwOrJson);
        }
        catch (e) {
            this.logger.log('Error attempting POST. URL:', url, 'Opts:', reqOpts, 'Body:', body, 'Error:', e);
            throw e;
        }
    }

    _bodyStringifier (obj) {
        if (typeof obj === 'string' || Buffer.isBuffer(obj))
            return obj;
        if (typeof obj === 'number')
            return obj.toString();
        return JSON.stringify(obj);
    }
    
}



module.exports = MojaloopRequests;

