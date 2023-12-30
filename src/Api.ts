/* eslint-disable @typescript-eslint/no-explicit-any */
import * as http from 'http';
import * as https from 'https';

import axios, { AxiosRequestConfig } from 'axios';

/**
 * The JavaScript primitive types.
 */
type primitive = string|number|bigint|boolean|null|undefined;

/**
 * The API query parameters.
 */
interface ApiParams {
	[key: string]: primitive|primitive[];
}

interface Token {
	createaccounttoken: string;
	csrftoken: string;
	deleteglobalaccounttoken: string;
	logintoken: string;
	patroltoken: string;
	rollbacktoken: string;
	setglobalaccountstatustoken: string;
	userrightstoken: string;
	watchtoken: string;
}

/**
 * A purely private container of credentials.
 */
const tokens: (Token|null)[] = [];
/**
 * The number of API instances that have been initialized.
 */
let instanceIndex = 0;

/**
 * An interface to interact with the {@link https://www.mediawiki.org/wiki/API:Main_page | MediaWiki Action API}.
 */
export class Api {

	/**
	 * The index number of the `Api` instance.
	 */
	private index: number;
	/**
	 * The default config for HTTP requests, initialized by the constructor.
	 */
	config: AxiosRequestConfig;
	/**
	 * An array of `AbortController`s used in {@link abort}.
	 */
	private aborts: AbortController[];

	/**
	 * Initialize a new `Api` instance to interact with the API of a particular MediaWiki site.
	 * ```
	 * const api = new Api('https://ja.wikipedia.org/w/api.php');
	 * api.get({
	 * 	action: 'query',
	 * 	meta: 'userinfo',
	 * 	formatversion: '2'
	 * })
	 * .then(console.log)
	 * .catch(console.log);
	 * ```
	 * For error handling in the `catch` block, see {@link ajax}.
	 * 
	 * As with {@link https://doc.wikimedia.org/mediawiki-core/REL1_41/js/#!/api/mw.Api | mw.Api} in the
	 * front-end MediaWiki-core (MW 1.25 or later), multiple values for a parameter can be specified using
	 * an array:
	 * ```
	 * const api = new Api('https://ja.wikipedia.org/w/api.php');
	 * api.get({
	 * 	action: 'query',
	 * 	meta: ['userinfo', 'siteinfo'], // same effect as 'userinfo|siteinfo'
	 * 	formatversion: '2'
	 * })
	 * .then(console.log)
	 * .catch(console.log);
	 * ```
	 * 
	 * Also as with MediaWiki-core (MW 1.26 or later), boolean values for API parameters can be specified
	 * natively. Parameter values set to `false` or `undefined` will be omitted from the request, as required
	 * by the API.
	 * 
	 * Note that the query parameters default to `action=query&format=json&formatversion=2`. If you want to
	 * reset these default values, pass an option initializer object as below:
	 * ```
	 * const api = new Api('https://ja.wikipedia.org/w/api.php', {
	 * 	params: {
	 * 		formatversion: undefined // 'false' also works
	 * 	}
	 * });
	 * ```
	 *
	 * @param apiUrl API endpoint as a full URL (e.g. `https://en.wikipedia.org/w/api.php`).
	 * @param options Default {@link https://github.com/axios/axios | Axios request config options}.
	 */
	constructor(apiUrl: string, options: AxiosRequestConfig = {}) {
		this.index = (instanceIndex++);
		tokens[this.index] = null;
		this.config = Object.assign(
			{},
			Api.defaultOptions,
			options,
			{url: apiUrl}
		);
		this.aborts = [];
	}

	/**
	 * The default config for HTTP requests, merged with the config passed to the constructor.
	 */
	private static defaultOptions: AxiosRequestConfig = {
		url: '/w/api.php',
		method: 'GET',
		baseURL: 'https://en.wikipedia.org',
		headers: {
			'User-Agent': 'drakobot/1.0.0'
		},
		timeout: 30 * 1000, // 30 seconds
		responseType: 'json',
		responseEncoding: 'utf8',
		httpAgent: new http.Agent({keepAlive: true}),
		httpsAgent: new https.Agent({keepAlive: true}),
	};

	/**
	 * Abort all unfinished requests issued by this `Api` object.
	 */
	abort(): void {
		this.aborts.forEach((controller) => {
			if (controller) {
				controller.abort();
			}
		});
		this.aborts = [];
	}

	/**
	 * Perform API get request. See also {@link ajax} for error handling.
	 * 
	 * @param parameters The query parameters.
	 * @param options Optional {@link https://github.com/axios/axios | Axios request config options}.
	 * @returns 
	 */
	get(parameters: ApiParams, options: AxiosRequestConfig = {}): Promise<any> {
		options.method = 'GET';
		return this.ajax(parameters, options);
	}

	/**
	 * Perform API post request. See also {@link ajax} for error handling.
	 * 
	 * @param parameters The query parameters.
	 * @param options Optional {@link https://github.com/axios/axios | Axios request config options}.
	 * @returns 
	 */
	post(parameters: ApiParams, options: AxiosRequestConfig = {}): Promise<any> {
		options.method = 'POST';
		return this.ajax(parameters, options);
	}

	/**
	 * Massage parameters from the nice format we accept into a format suitable for the API.
	 * 
	 * NOTE: A value of undefined/null in an array will be represented by Array#join()
	 * as the empty string. Should we filter silently? Warn? Leave as-is?
	 * 
	 * @param parameters (modified in-place)
	 */
	private preprocessParameters(parameters: ApiParams) {
		// Handle common MediaWiki API idioms for passing parameters
		for (const key in parameters) {
			// Multiple values are pipe-separated
			const val = parameters[key];
			if (Array.isArray(val)) {
				parameters[key] = val.join('|');
			} else if (parameters[key] === false || parameters[key] === void 0) {
				// Boolean values are only false when not given at all
				delete parameters[key];
			}
		}
	}

	/**
	 * Perform the API call. This method sends an HTTP GET request by default.
	 * 
	 * If the return value is a rejected Promise object, it always contains an `error`
	 * property with internal `code` and `info` properties.
	 * ```
	 * new Api('ENDPOINT').ajax({
	 * 	// query parameters
	 * }).then((res) => {
	 * 	console.log(res);
	 * }).catch((err) => {
	 * 	console.log(err);
	 * });
	 * ```
	 * If the code above reaches the `catch` block, the console output will be:
	 * ```json
	 * {
	 * 	"error": {
	 * 		"code": "ERROR CODE",
	 * 		"info": "ERROR INFORMATION",
	 * 		"details": "FULL AXIOS RESPONSE" // Present only in the case of an API-external error
	 * 	}
	 * }
	 * ```
	 * 
	 * @param parameters 
	 * @param options 
	 * @returns 
	 */
	ajax(parameters: ApiParams, options: AxiosRequestConfig = {}): Promise<any> {

		// Ensure that token parameter is last (per [[mw:API:Edit#Token]]).
		let token = '';
		if (typeof parameters.token === 'string') {
			token = parameters.token;
			delete parameters.token;
		}

		// Clean up parameters
		this.preprocessParameters(parameters);

		// GET: params, POST: data
		const config = Object.assign({}, this.config, options);
		const def = {
			action: 'query',
			format: 'json',
			formatversion: '2'
		};
		config.method = config.method || 'GET';
		if (/^GET$/i.test(config.method)) {
			config.params = config.params || {};
			Object.assign(config.params, def, parameters);
			if (token) config.params.token = token;
		} else {
			/**
			 * The Action API only accepts data in `application/x-www-form-urlencoded` or `multipart/form-data`
			 * format, and does not support `application/json`.
			 * @see https://www.mediawiki.org/wiki/API:Data_formats
			 */ 
			const data = Object.assign(config.data || {}, def, parameters);
			if (token) data.token = token;
			config.data = new URLSearchParams(data).toString();
		}

		// Add an abort controller
		const controller = new AbortController();
		config.signal = controller.signal;
		this.aborts.push(controller);

		// Issue an HTTP request
		return new Promise((resolve, reject) => {
			axios.request(config)
			.then((response) => {
				if (response === void 0 || response === null || !response.data) {
					reject({
						error: {
							code: 'ok-but-empty',
							info: 'OK response but empty result (check HTTP headers?)',
							details: response
						}
					});
				} else if (typeof response.data !== 'object') {
					reject({
						error: {
							code: 'invalidjson',
							info: 'Invalid JSON response (check the request URL?)'
						}
					});
				} else if (response.data.error) {
					reject(response.data);
				} else {
					resolve(response.data);
				}
			})
			.catch((error) => {
				if (error && error.code === 'ERR_CANCELED') {
					reject({
						error: {
							code: 'aborted',
							info: 'HTTP request aborted by user'
						}
					});
				} else {
					reject({
						error: {
							code: 'http',
							info: 'HTTP request failed',
							details: error
						}
					});
				}
			});
		});
		
	}

}