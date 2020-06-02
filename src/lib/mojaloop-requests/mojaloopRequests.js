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
const http = require('http');
const https = require('https');

const common = require('./common');
const request = require('../request');
const buildUrl = common.buildUrl;
const throwOrJson = common.throwOrJson;

const JwsSigner = require('../jws').signer;

const ResponseType = Object.freeze({
    Mojaloop:   Symbol('mojaloop'),
    Simple:  Symbol('simple'),
    Stream: Symbol('stream')
});

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
        this.bulkQuotesEndpoint = config.bulkQuotesEndpoint ? `${this.transportScheme}://${config.bulkQuotesEndpoint}` : null;
        this.transfersEndpoint = config.transfersEndpoint ? `${this.transportScheme}://${config.transfersEndpoint}` : null;
        this.bulkTransfersEndpoint = config.bulkTransfersEndpoint ? `${this.transportScheme}://${config.bulkTransfersEndpoint}` : null;
        this.transactionRequestsEndpoint = config.transactionRequestsEndpoint ? `${this.transportScheme}://${config.transactionRequestsEndpoint}` : null;

        this.wso2Auth = config.wso2Auth;
    }

    /**
     * Executes a GET /parties request for the specified identifier type and identifier
     *
     * @returns {object} - JSON response body if one was received
     */
    async getParties(idType, idValue, idSubValue) {
        const url = `parties/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '');
        return this._get(url, 'parties');
    }

    /**
     * Executes a PUT /parties request for the specified identifier type and indentifier
     */
    async putParties(idType, idValue, idSubValue, body, destFspId) {
        const url = `parties/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '');
        return this._put(url, 'parties', body, destFspId);
    }

    /**
     * Executes a PUT /parties/{IdType}/{IdValue}/error request for the specified identifier type and indentifier
     */
    async putPartiesError(idType, idValue, idSubValue, error, destFspId) {
        const url = `parties/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '')
            + '/error';
        return this._put(url, 'parties', error, destFspId);
    }

    /**
     * Executes a POST /participants request
     *
     * @returns {object} - JSON response body if one was received
     */
    async postParticipants(request, destFspId) {
        return this._post('participants', 'participants', request, destFspId);
    }

    /**
     * Executes a PUT /participants request for the specified identifier type and indentifier
     */
    async putParticipants(idType, idValue, idSubValue, body, destFspId) {
        const url = `participants/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '');
        return this._put(url, 'participants', body, destFspId);
    }

    /**
     * Executes a PUT /participants/{idType}/{idValue}/error request for the specified identifier type and indentifier
     */
    async putParticipantsError(idType, idValue, idSubValue, error, destFspId) {
        const url = `participants/${idType}/${idValue}`
            + (idSubValue ? `/${idSubValue}` : '')
            + '/error';
        return this._put(url, 'participants', error, destFspId);
    }

    /**
     * Executes a POST /quotes request for the specified quote request
     *
     * @returns {object} - JSON response body if one was received
     */
    async postQuotes(quoteRequest, destFspId) {
        return this._post('quotes', 'quotes', quoteRequest, destFspId);
    }

    /**
     * Executes a PUT /quotes/{ID} request for the specified quote
     */
    async putQuotes(quoteId, quoteResponse, destFspId) {
        return this._put(`quotes/${quoteId}`, 'quotes', quoteResponse, destFspId);
    }

    /**
     * Executes a PUT /quotes/{ID} request for the specified quote
     */
    async putQuotesError(quoteId, error, destFspId) {
        return this._put(`quotes/${quoteId}/error`, 'quotes', error, destFspId);
    }

    /**
     * Executes a POST /bulkQuotes request
     */
    async postBulkQuotes(bulkQuoteRequest, destFspId) {
        return this._post('bulkQuotes', 'bulkQuotes', bulkQuoteRequest, destFspId);
    }

    /**
    * Executes a PUT /bulkQuotes/{ID} request for the specified bulk quotes
    */
    async putBulkQuotes(bulkQuoteId, bulkQuoteResponse, destFspId) {
        return this._put(`bulkQuotes/${bulkQuoteId}`, 'bulkQuotes', bulkQuoteResponse, destFspId);
    }

    /**
    * Executes a PUT /bulkQuotes/{ID} request for the specified bulk quotes
    */
    async putBulkQuotesError(bulkQuoteId, error, destFspId) {
        return this._put(`bulkQuotes/${bulkQuoteId}/error`, 'bulkQuotes', error, destFspId);
    }

    /**
     * Executes a GET /bulkQuotes/{ID} request for the specified bulk quote ID
     *
     * @returns {object} - JSON response body if one was received
     */
    async getBulkQuotes(bulkQuoteId) {
        const url = `bulkQuotes/${bulkQuoteId}`;
        return this._get(url, 'bulkQuotes');
    }

    /**
     * Executes a GET /transfers request for the specified transfer ID
     *
     * @returns {object} - JSON response body if one was received
     */
    async getTransfers(transferId) {
        const url = `transfers/${transferId}`;
        return this._get(url, 'transfers');
    }

    /**
     * Executes a POST /transfers request for the specified transfer prepare
     *
     * @returns {object} - JSON response body if one was received
     */
    async postTransfers(prepare, destFspId) {
        return this._post('transfers', 'transfers', prepare, destFspId);
    }

    /**
     * Executes a PUT /transfers/{ID} request for the specified transfer fulfilment
     *
     * @returns {object} - JSON response body if one was received
     */
    async putTransfers(transferId, fulfilment, destFspId) {
        return this._put(`transfers/${transferId}`, 'transfers', fulfilment, destFspId);
    }

    /**
     * Executes a PUT /transfers/{ID}/error request for the specified error
     *
     * @returns {object} - JSON response body if one was received
     */
    async putTransfersError(transferId, error, destFspId) {
        return this._put(`transfers/${transferId}/error`, 'transfers', error, destFspId);
    }

    /**
     * Executes a GET /bulkTransfers/{ID} request for the specified bulk transfer ID
     *
     * @returns {object} - JSON response body if one was received
     */
    async getBulkTransfers(bulkTransferId) {
        const url = `bulkTransfers/${bulkTransferId}`;
        return this._get(url, 'bulkTransfers');
    }

    /**
     * Executes a POST /bulkTransfers request for the specified bulk transfer prepare
     *
     * @returns {object} - JSON response body if one was received
     */
    async postBulkTransfers(prepare, destFspId) {
        return this._post('bulkTransfers', 'bulkTransfers', prepare, destFspId);
    }

    /**
     * Executes a PUT /bulkTransfers/{ID} request for the specified bulk transfer fulfilment
     *
     * @returns {object} - JSON response body if one was received
     */
    async putBulkTransfers(bulkTransferId, fulfilment, destFspId) {
        return this._put(`bulkTransfers/${bulkTransferId}`, 'bulkTransfers', fulfilment, destFspId);
    }

    /**
     * Executes a PUT /bulkTransfers/{ID}/error request for the specified error
     *
     * @returns {object} - JSON response body if one was received
     */
    async putBulkTransfersError(bulkTransferId, error, destFspId) {
        return this._put(`bulkTransfers/${bulkTransferId}/error`, 'bulkTransfers', error, destFspId);
    }

    /**
     * Executes a POST /transactionRequests request for the specified transaction request
     *
     * @returns {object} - JSON response body if one was received
     */
    async postTransactionRequests(transactionRequest, destFspId) {
        return this._post('transactionRequests', 'transactionRequests', transactionRequest, destFspId);
    }

    /**
     * Executes a PUT /transactionRequests/{ID} request for the specified transaction request
     *
     * @returns {object} - JSON response body if one was received
     */
    async putTransactionRequests(transactionRequestId, transactionRequestResponse, destFspId) {
        return this._put(`transactionRequests/${transactionRequestId}`, 'transactionRequests', transactionRequestResponse, destFspId);
    }

    /**
     * Executes a PUT /transactionRequests/{ID}/error request for the specified error
     *
     * @returns {object} - JSON response body if one was received
     */
    async putTransactionRequestsError(transactionRequestId, error, destFspId) {
        return this._put(`transactionRequests/${transactionRequestId}/error`, 'transactionRequests', error, destFspId);
    }

    /**
     * Executes a GET /authorizations request for the specified transactionRequestId
     *
     * @returns {object} - JSON response body if one was received
     */
    async getAuthorizations(transactionRequestId, authorizationParameters, destFspId) {
        const url = `authorizations/${transactionRequestId}?${authorizationParameters}`;
        return this._get(url , 'authorizations', destFspId);
    }

    /**
     * Executes a PUT /authorizations/{ID} request for the specified transactionRequestId
     *
     * @returns {object} - JSON response body if one was received
     */
    async putAuthorizations(transactionRequestId, authorizationResponse, destFspId) {
        return this._put(`authorizations/${transactionRequestId}`, 'authorizations', authorizationResponse, destFspId);
    }

    /**
     * Executes a PUT /authorizations/{ID}/error request for the specified transactionRequestId
     *
     * @returns {object} - JSON response body if one was received
     */
    async putAuthorizationsError(transactionRequestId, error, destFspId) {
        return this._put(`authorizations/${transactionRequestId}/error`, 'authorizations', error, destFspId);
    }

    async putCustom(url, body, headers, query, streamResponse = false) {
        return this._put(url, 'custom', body, null, headers, query,
            streamResponse ? ResponseType.Stream : ResponseType.Simple);
    }

    async postCustom(url, body, headers, query, streamResponse = false) {
        return this._post(url, 'custom', body, null, headers, query,
            streamResponse ? ResponseType.Stream : ResponseType.Simple);
    }

    async getCustom(url, headers, query, streamResponse = false) {
        return this._get(url, 'custom', null, headers, query,
            streamResponse ? ResponseType.Stream : ResponseType.Simple);
    }

    /**
     * Utility function for building outgoing request headers as required by the mojaloop api spec
     *
     * @returns {object} - headers object for use in requests to mojaloop api endpoints
     */
    _buildHeaders(method, resourceType, dest) {
        let headers = {
            'content-type': `application/vnd.interoperability.${resourceType}+json;version=1.0`,
            'date': new Date().toUTCString(),
        };

        if (this.dfspId) {
            headers['fspiop-source'] = this.dfspId;
        }

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

        return headers;
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
            case 'bulkQuotes':
                returnEndpoint = this.bulkQuotesEndpoint ? this.bulkQuotesEndpoint : this.peerEndpoint;
                break;
            case 'transfers':
                returnEndpoint = this.transfersEndpoint ? this.transfersEndpoint : this.peerEndpoint;
                break;
            case 'bulkTransfers':
                returnEndpoint = this.bulkTransfersEndpoint ? this.bulkTransfersEndpoint : this.peerEndpoint;
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


    _get(url, resourceType, dest, headers = {}, query = {}, responseType = ResponseType.Mojaloop) {
        const reqOpts = {
            method: 'GET',
            uri: buildUrl(this._pickPeerEndpoint(resourceType), url),
            headers: {
                ...this._buildHeaders('GET', resourceType, dest),
                ...headers,
            },
            qs: query,
        };

        if (responseType === ResponseType.Stream) {
            reqOpts.responseType = request.responseType.Stream;
        }

        // Note we do not JWS sign requests with no body i.e. GET requests

        this.logger.log(`Executing HTTP GET: ${util.inspect(reqOpts)}`);
        return request({...reqOpts, agent: this.agent})
            .then((res) => (responseType === ResponseType.Mojaloop) ? throwOrJson(res) : res)
            .catch(e => {
                this.logger.log('Error attempting GET. URL:', url, 'Opts:', reqOpts, 'Error:', e);
                throw e;
            });
    }


    _put(url, resourceType, body, dest, headers = {}, query = {}, responseType = ResponseType.Mojaloop) {
        const reqOpts = {
            method: 'PUT',
            uri: buildUrl(this._pickPeerEndpoint(resourceType), url),
            headers: {
                ...this._buildHeaders('PUT', resourceType, dest),
                ...headers,
            },
            body: body,
            qs: query,
        };

        if (responseType === ResponseType.Stream) {
            reqOpts.responseType = request.responseType.Stream;
        }

        if((responseType === ResponseType.Mojaloop) && this.jwsSign && (resourceType === 'parties' ? this.jwsSignPutParties : true)) {
            this.jwsSigner.sign(reqOpts);
        }

        reqOpts.body = this._bodyStringifier(reqOpts.body);

        this.logger.log(`Executing HTTP PUT: ${util.inspect(reqOpts)}`);
        return request({...reqOpts, agent: this.agent})
            .then((res) => (responseType === ResponseType.Mojaloop) ? throwOrJson(res) : res)
            .catch(e => {
                this.logger.log('Error attempting PUT. URL:', url, 'Opts:', reqOpts, 'Body:', body, 'Error:', e);
                throw e;
            });
    }


    _post(url, resourceType, body, dest, headers = {}, query = {}, responseType = ResponseType.Mojaloop) {
        const reqOpts = {
            method: 'POST',
            uri: buildUrl(this._pickPeerEndpoint(resourceType), url),
            headers: {
                ...this._buildHeaders('POST', resourceType, dest),
                ...headers,
            },
            body: body,
            qs: query,
        };

        if (responseType === ResponseType.Stream) {
            reqOpts.responseType = request.responseType.Stream;
        }

        if((responseType === ResponseType.Mojaloop) && this.jwsSign) {
            this.jwsSigner.sign(reqOpts);
        }

        reqOpts.body = this._bodyStringifier(reqOpts.body);

        this.logger.log(`Executing HTTP POST: ${util.inspect(reqOpts)}`);
        return request({...reqOpts, agent: this.agent})
            .then((res) => (responseType === ResponseType.Mojaloop) ? throwOrJson(res) : res)
            .catch(e => {
                this.logger.log('Error attempting POST. URL:', url, 'Opts:', reqOpts, 'Body:', body, 'Error:', e);
                throw e;
            });
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

