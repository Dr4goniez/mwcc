/**
 * **Attributions**
 *
 * Some parts of the code are copied or adapted from the mediawiki.api module in MediaWiki core,
 * which is released under the GNU GPL v2 license.
 *
 * - {@link https://doc.wikimedia.org/mediawiki-core/REL1_41/js/source/index3.html | mw.Api}
 * - {@link https://doc.wikimedia.org/mediawiki-core/REL1_41/js/source/edit2.html | mw.Api.plugin.edit}
 * - {@link https://doc.wikimedia.org/mediawiki-core/REL1_41/js/source/messages.html#mw-Api-plugin-messages-method-getMessages | mw.Api.plugin.messages}
 * - {@link https://doc.wikimedia.org/mediawiki-core/REL1_41/js/source/user.html | mw.Api.plugin.user}
 *
 * @module
 */
/* eslint-disable @typescript-eslint/no-this-alias */

import Axios, { AxiosRequestConfig, AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

import packageJson from '../package.json';
import {
	ApiParams,
	ApiResponse,
	ApiResponseQueryMetaTokens
} from './api_types';

/**
 * An interface to interact with the {@link https://www.mediawiki.org/wiki/API:Main_page | MediaWiki Action API}.
 */
export class MWCCStatic {

	/**
	 * The API endpoint. This must be included in the config of every HTTP request issued
	 * by the Axios instance.
	 */
	readonly apiUrl: string;

	/**
	 * A unique Axios instance for an class instance.
	 */
	readonly axios: AxiosInstance;

	/**
	 * An array of `AbortController`s used in {@link abort}.
	 */
	private aborts: AbortController[] = [];

	/**
	 * Whether the current user is anonymous.
	 */
	anon = true;

	/**
	 * Return an apilimit for multivalue API parameters.
	 */
	get apilimit() {
		return 50;
	}

	/**
	 * Initialize a new `MWCC` instance to interact with the API of a particular MediaWiki site.
	 * ```
	 * const mwcc = new MWCC('https://ja.wikipedia.org/w/api.php');
	 * mwcc.get({
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
	 * const mwcc = new MWCC('https://ja.wikipedia.org/w/api.php');
	 * mwcc.get({
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
	 * const mwcc = new MWCC('https://ja.wikipedia.org/w/api.php', {
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

		// Set up the API endpoint
		if (!apiUrl) {
			throw new Error('[mwcc] No endpoint is passed to the ' + MWCCStatic.name + ' constructor');
		} else {
			this.apiUrl = apiUrl;
		}

		// Initialize an Axios instance for this MWCCStatic instance
		const config = Object.assign(
			{},
			MWCCStatic.defaultOptions,
			options,
			/**
			 * Make it possible for the Axios instance to handle cookies and sessions. Without this,
			 * `action=login` keeps complaining about session timeout after fetching a login token.
			 * ```
			 * {
			 *	login: {
			 *		result: 'Failed',
			 *		reason: 'Unable to continue login. Your session most likely timed out.'
			 *	}
			 * }
			 * ```
			 */
			{jar: new CookieJar()}
		);
		this.axios = wrapper(Axios.create(config)); // 'Infuse' jar support to the Axios instance

	}

	/**
	 * The default config for HTTP requests, merged with the config passed to the constructor.
	 */
	static readonly defaultOptions: AxiosRequestConfig = {
		method: 'GET',
		headers: {
			'User-Agent': 'mwcc/' + packageJson.version,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		timeout: 30 * 1000, // 30 seconds
		withCredentials: true, // Related to cookie handling
		responseType: 'json',
		responseEncoding: 'utf8'
	};

	// ****************************** BASE REQUEST METHODS ******************************

	/**
	 * Abort all unfinished requests issued by this `MWCC` instance.
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
	 * Perform API GET request.
	 *
	 * @param parameters API parameters.
	 * @param options Optional {@link https://github.com/axios/axios | Axios request config options}.
	 * @returns See {@link ajax}.
	 */
	get(parameters: ApiParams, options: AxiosRequestConfig = {}): Promise<unknown> {
		options.method = 'GET';
		return this.ajax(parameters, options);
	}

	/**
	 * Perform API POST request.
	 *
	 * @param parameters API parameters.
	 * @param options Optional {@link https://github.com/axios/axios | Axios request config options}.
	 * @returns See {@link ajax}.
	 */
	post(parameters: ApiParams, options: AxiosRequestConfig = {}): Promise<unknown> {
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
	private preprocessParameters(parameters: ApiParams): void {
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
	 * Perform the API call. This method sends a GET request by default.
	 *
	 * **Default parameters**
	 *
	 * Whether the API call is a GET request or a POST request, the following parameters are
	 * used as the default parameters:
	 *
	 * ```
	 * {
	 * 	action: 'query',
	 * 	format: 'json',
	 * 	formatversion: '2'
	 * }
	 * ```
	 *
	 * These parameters are overridden if {@link parameters} (the first parameter of this method)
	 * contain properties with overlapping names.
	 *
	 * Note that AJAX methods of the `MWCC` class all work regardless of whether you are logged in,
	 * and hence an edit attempt with {@link postWithToken}, for example, will succeed as an edit
	 * by an anonymous user. If you want to ensure that you are logged in, use the
	 * {@link https://www.mediawiki.org/w/api.php?action=help&modules=main#main:assert | assert }
	 * parameter of the API:
	 *
	 * ```
	 * const mwcc = new MWCC('https://test.wikipedia.org/w/api.php');
	 * mwcc.postWithToken('csrf', {
	 * 	action: 'edit',
	 * 	title: 'Wikipedia:Sandbox',
	 * 	appendtext: '\n* Test. ~~~~',
	 * 	summary: 'test',
	 * 	assert: 'user'
	 * })
	 * .then(console.log)
	 * .catch(console.log);
	 * ```
	 *
	 * This will fail if you are not logged in.
	 *
	 * **Error handling**
	 *
	 * If the return value is a rejected Promise object, it always contains an `error`
	 * property with internal `code` and `info` properties.
	 *
	 * ```
	 * new MWCC('ENDPOINT').ajax({
	 * 	// query parameters
	 * }).then((res) => {
	 * 	console.log(res);
	 * }).catch((err) => {
	 * 	console.log(err); // "err.error" is always present
	 * });
	 * ```
	 *
	 * If the code above reaches the `catch` block, the console output will be:
	 *
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
	 * @param parameters API parameters.
	 * @param options Optional {@link https://github.com/axios/axios | Axios request config options}.
	 * @returns
	 */
	ajax(parameters: ApiParams, options: AxiosRequestConfig = {}): Promise<unknown> {

		// Ensure that token parameter is last (per [[mw:API:Edit#Token]]).
		let token = '';
		if (typeof parameters.token === 'string') {
			token = parameters.token;
			delete parameters.token;
		}

		// Clean up parameters
		this.preprocessParameters(parameters);

		// Set up the request body
		const defaults = {
			action: 'query',
			format: 'json',
			formatversion: '2'
		};
		options.method = options.method || this.axios.defaults.method || 'GET';
		if (/^GET$/i.test(options.method)) {

			// The query parameters to a GET request should be in `application/json` format
			options.params = options.params || {};
			Object.assign(options.params, this.axios.defaults.params, defaults, parameters);
			if (token) options.params.token = token;

		} else {

			/**
			 * The data sent by a POST request must be in either `application/x-www-form-urlencoded`
			 * or `multipart/form-data` format (no support for `application/json`).
			 *
			 * @see https://www.mediawiki.org/wiki/API:Data_formats
			 */
			const data = Object.assign(options.data || {}, this.axios.defaults.data, defaults, parameters);
			if (token) data.token = token;
			options.data = new URLSearchParams(data);

		}
		options.url = this.apiUrl; // This is required for every request even if we use an Axios **instance**

		// Add an abort controller
		const controller = new AbortController();
		options.signal = controller.signal;
		this.aborts.push(controller);

		// Issue an HTTP request
		return new Promise((resolve, reject) => {
			this.axios.request(options)
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
					// In most cases the raw HTML of [[Main page]]
					reject({
						error: {
							code: 'invalidjson',
							info: 'Invalid JSON response (check the request URL?)'
						}
					});
				// When we get a JSON response from the API, it's always a "200 OK"
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

	/**
	 * Perform API query that is automatically continued (if the response has a `continue` property)
	 * until the limit is reached.
	 *
	 * @param parameters API parameters
	 * @param limit The maximum number of times to continue requests (default: `10`)
	 * @returns An array of raw API responses
	 */
	continuedQuery(parameters: ApiParams, limit = 10): Promise<unknown[]> {

		const _this = this;
		const responses: unknown[] = [];
		const req = (params: ApiParams, count: number): Promise<unknown[]> => {
			return _this.get(params)
				.then((res) => {
					responses.push(res);
					const resCont = (<ApiParams>res)?.continue;
					if (resCont && count < limit) {
						return req(Object.assign(params, resCont), count + 1);
					} else {
						return responses;
					}
				}).catch((err) => {
					responses.push(err);
					return responses;
				});
		};

		return req(parameters, 1);

	}

	/**
	 * Perform API query with a multi-value parameter, for which the API has a "ceiling" number.
	 *
	 * For example:
	 *
	 * ```
	 * {
	 * 	action: 'query',
	 * 	titles: 'A|B|C|D|...', // This parameter is subject to the apilimit of 500 or 50
	 * 	formatversion: '2'
	 * }
	 * ```
	 *
	 * Pass the multi-value field as an array, and then this method sends multiple API requests
	 * by splicing it in accordance with the user's apilimit (`500` for bots, `50` otherwise).
	 *
	 * It is also required to pass the name of the field to the second parameter of this method
	 * (if the request parameters have more than one multi-value field, an array can be passed
	 * instead of a string).
	 *
	 * @param parameters API parameters
	 * @param fields The name(s) of the multi-value field
	 * @param options Optional settings for the method
	 * @param options.apilimit Optional specification of the apilimit (default: `500/50`). The `**limit`
	 * parameter, if any, is automatically set to `max` if this parameter has the default value. It also
	 * accepts a value like `1`, in cases such as
	 * {@link https://www.mediawiki.org/w/api.php?action=help&modules=query%2Bblocks | list=blocks} with
	 * the `bkip` parameter (which only allows one IP to be queried in one API call).
	 * @param options.verbose Whether to output internal errors to the console (default: `true`)
	 * @returns Always resolves an array of raw API responses. If the method rejects, the return value is
	 * an object in the same way as in {@link ajax}.
	 * @throws When:
	 * - there's a multi-value field with a non-array
	 * - `fields` is empty
	 * - there's no multi-value field corresponding to the specified field name(s)
	 * - there are multiple multi-value fields but the relevant arrays are not identical
	 */
	massQuery(parameters: ApiParams, fields: string|string[], options: {apilimit?: number, verbose?: boolean} = {}): Promise<unknown[]> {

		// Initialize variables
		const apilimit = typeof options.apilimit === 'number' ? options.apilimit : this.apilimit;
		const verbose = options.verbose === void 0 ? true : !!options.verbose;
		parameters = Object.assign({}, parameters);
		fields = (Array.isArray(fields) ? fields : [fields]).filter((v) => v);

		// Unflat multi-value field arrays into one array to check equality
		const nonArrayBatchParams: string[] = [];
		const fieldValues = Object.keys(parameters).reduce((acc: string[][], key) => {
			if (fields.includes(key)) {
				const val = parameters[key];
				if (Array.isArray(val)) {
					acc.push(val.map((v) => String(v))); // Coerce string type to multi-value field values
				} else {
					nonArrayBatchParams.push('"' + key + '"');
				}
			} else if (/limit$/.test(key) && (apilimit === 500 || apilimit === 50)) {
				// If this is a '**limit' parameter and the value is the default one, set it to 'max'
				parameters[key] = 'max';
			}
			return acc;
		}, []);
		if (nonArrayBatchParams.length) {
			return Promise.reject({
				error: {
					code: 'nonarray-exception',
					info: 'The value(s) for ' + nonArrayBatchParams.join(', ') + ' must be arrays'
				}
			});
		} else if (!fields.length) {
			return Promise.reject({
				error: {
					code: 'emptyfield',
					info: 'The "fields" parameter is empty'
				}
			});
		} else if (!fieldValues.length) {
			return Promise.reject({
				error: {
					code: 'nomultivalue',
					info: 'There\'s no multi-value field (check for typos in parameter keys?)'
				}
			});
		} else if (
			// If there are multiple multi-value fields, all of them must have the same array
			fieldValues.length > 1 &&
			!fieldValues.slice(1).every((arr) => fieldValues[0].length === arr.length && fieldValues[0].every((el, i) => arr[i] === el))
		) {
			return Promise.reject({
				error: {
					code: 'nonindentical-arrays',
					info: 'The multi-value fields must all have the same array'
				}
			});
		}

		// Check for an empty multi-value (this is not an error)
		const batchArray = fieldValues[0];
		if (!batchArray.length) {
			if (verbose) console.log('[mwcc] An empty array has been passed for the batch operation.');
			return Promise.resolve([]);
		}

		// Send API requests
		const result: Promise<unknown>[] = [];
		while (batchArray.length) {
			const multiValue = batchArray.splice(0, apilimit).join('|');
			const params = {...parameters};
			for (const key of fields) {
				params[key] = multiValue;
			}
			result.push(this.post(params).then(res => res).catch(err => err));
		}

		return Promise.all(result);

	}

	// ****************************** TOKEN-RELATED METHODS ******************************

	/**
	 * A container of credentials.
	 */
	protected tokens: ApiResponseQueryMetaTokens = {};

	/**
	 * Post to API with the specified type of token. If we have no token, get one and try to post.
	 * If we already have a cached token, try using that, and if the request fails using the cached token,
	 * blank it out and start over. For example, to change a user option, you could do:
	 * ```
	 * new MWCC('ENDPOINT').postWithToken('csrf', {
	 * 	action: 'options',
	 * 	optionname: 'gender',
	 * 	optionvalue: 'female'
	 * });
	 * ```
	 *
	 * @param tokenType The name of the token, like `csrf`.
	 * @param params API parameters.
	 * @param options Optional {@link https://github.com/axios/axios | Axios request config options}.
	 * @returns See {@link ajax}.
	 */
	postWithToken(tokenType: string, params: ApiParams, options: AxiosRequestConfig = {}): Promise<unknown> {
		const assertParams = {
			assert: params.assert,
			assertuser: params.assertuser
		};
		return new Promise((resolve, reject) => {
			this.getToken(tokenType, assertParams)
			.then((token) => {
				params.token = token;
				return this.post(params, options)
				.then(resolve)
				.catch((err: ApiResponse) => {

					// Error handler
					if (err.error?.code === 'badtoken') {
						this.badToken(tokenType);
						// Try again, once
						params.token = void 0;
						return this.getToken(tokenType, assertParams)
						.then((t) => {
							params.token = t;
							return this.post(params, options).then(resolve).catch(reject);
						}).catch(reject);
					}

					reject(err);

				});
			}).catch(reject);
		});
	}

	/**
	 * Get a token for a certain action from the API.
	 *
	 * @param tokenType The name of the token, like `csrf`.
	 * @param additionalParams Additional parameters for the API. When given a string, it's treated as the
	 * 'assert' parameter.
	 * @returns Received token. Can be a rejected Promise object on failure.
	 */
	getToken(tokenType: string, additionalParams?: ApiParams|string): Promise<string> {

		// Do we have a cashed token?
		tokenType = mapLegacyToken(tokenType);
		const tokenName = tokenType + 'token' as keyof ApiResponseQueryMetaTokens;
		const cashedToken = this.tokens[tokenName];
		if (cashedToken) {
			return Promise.resolve(cashedToken);
		}

		// Send an API request
		if (typeof additionalParams === 'string') {
			additionalParams = {assert: additionalParams};
		}
		const params = Object.assign(
			{
				meta: 'tokens',
				type: '*'
			},
			additionalParams || {}
		);
		return new Promise((resolve, reject) => {
			this.get(params)
			.then((res) => {
				const resToken = (<ApiResponse>res)?.query?.tokens;
				if (resToken) {
					this.tokens = resToken;
					const token = resToken[tokenName];
					if (token) {
						resolve(token);
					} else {
						throw {
							error: {
								code: 'badnamedtoken',
								info: 'Could not find a token named "' + tokenType + '" (check for typos?)'
							}
						};
					}
				} else {
					throw {
						error: {
							code: 'ok-but-empty',
							info: 'OK response but empty result'
						}
					};
				}
			}).catch(reject);
		});
	}

	/**
	 * Indicate that the cached token for a certain action of the API is bad.
	 *
	 * Call this if you get a `badtoken` error when using the token returned by {@link getToken}.
	 * You may also want to use {@link postWithToken} instead, which invalidates bad cached tokens
	 * automatically.
	 *
	 * @param tokenType The name of the token, like `csrf`.
	 */
	badToken(tokenType: string): void {
		tokenType = mapLegacyToken(tokenType);
		const tokenName = tokenType + 'token' as keyof ApiResponseQueryMetaTokens;
		if (this.tokens[tokenName]) {
			delete this.tokens[tokenName];
		}
	}

	/**
	 * Post to API with csrf token. If we have no token, get one and try to post. If we have a cached token
	 * try using that, and if it fails, blank out the cached token and start over.
	 *
	 * @param params API parameters.
	 * @param options Optional {@link https://github.com/axios/axios | Axios request config options}.
	 * @returns See {@link ajax}.
	 */
	postWithEditToken(params: ApiParams, options: AxiosRequestConfig = {}): Promise<unknown> {
		return this.postWithToken('csrf', params, options);
	}

	/**
	 * API helper to grab a csrf token.
	 *
	 * @returns Received token.
	 */
	getEditToken(): Promise<string> {
		return this.getToken('csrf');
	}

	// ****************************** EDIT HELPER METHODS ******************************

	/**
	 * Create a new page.
	 *
	 * Example:
	 * ```
	 * new MWCC('ENDPOINT').create('Sandbox',
	 * 	{summary: 'Load sand particles.'},
	 * 	'Sand.'
	 * );
	 * ```
	 * @param title Page title.
	 * @param params API parameters.
	 * @param content Content of the page to create.
	 * @param assertUser Whether to append `{assert: 'user'}` to the query parameters, defaulted to `false`.
	 * @returns See {@link ajax}.
	 */
	create(title: string, params: ApiParams, content: string, assertUser = false): Promise<unknown> {
		return new Promise((resolve, reject) => {
			this.postWithEditToken(Object.assign({
				action: 'edit',
				title: String(title),
				text: content,
				createonly: true,
				assert: assertUser && 'user'
			}, params))
			.then(resolve)
			.catch(reject);
		});
	}

	/**
	 * Edit an existing page. (To create a new page, use {@link create} instead.)
	 *
	 * This method first fetches the current revision of the specified page. Then, the timestamp and
	 * the content are passed to the callback function, which should in turn provide parameters for
	 * `action=edit`.
	 *
	 * Simple transformation:
	 *
	 * ```
	 * mwcc.edit('Sandbox', (revision) => revision.content.replace('foo', 'bar'));
	 * ```
	 *
	 * If the callback function returns a string (or more precisely a non-object) as above, that will be
	 * used in the `text` parameter of the edit request.
	 *
	 * If the return value is an object, it will be merged into the POST data:
	 *
	 * ```
	 * mwcc.edit('Sandbox', (revision) => {
	 * 	return {
	 * 		text: revision.content.replace('foo', 'bar'),
	 * 		summary: 'Replace "foo" with "bar".',
	 * 		assert: 'bot',
	 * 		minor: true
	 * 	};
	 * });
	 * ```
	 *
	 * Note further that a promisified return is also accepted.
	 *
	 * @param title Page title
	 * @param transform Callback that prepares the edit and returns a string or object (can be promisified)
	 * @returns See {@link ajax}.
	 */
	async edit(title: string, transform: (obj: {timestamp: string, content: string}) => string|ApiParams|Promise<string>|Promise<ApiParams>): Promise<unknown> {

		title = String(title);
		const resRev = <ApiResponse>await this.get({
			prop: 'revisions',
			rvprop: 'content|timestamp',
			rvslots: 'main',
			titles: title,
			curtimestamp: true
		});
		if (resRev.error) {
			return Promise.reject(resRev);
		}
		const resPages = resRev.query?.pages;
		let page;
		if (!resPages || !(page = resPages[0])) {
			return Promise.reject({
				error: {
					code: 'ok-but-empty',
					info: 'OK response but empty result'
				}
			});
		} else if (page.invalidreason) {
			return Promise.reject({
				error: {
					code: 'invalidtitle',
					info: page.invalidreason
				}
			});
		} else if (page.missing) {
			return Promise.reject({
				error: {
					code: 'nocreate-missing',
					info: 'The requested page does not exist'
				}
			});
		}
		const revision = page.revisions && page.revisions[0];
		const basetimestamp = revision?.timestamp;
		const starttimestamp = resRev.curtimestamp!; // Unlikely to be missing
		const content = revision?.slots?.main.content;
		if (!revision || !basetimestamp || content === void 0) {
			return Promise.reject({
				error: {
					code: 'ok-but-empty',
					info: 'OK response but empty result'
				}
			});
		}

		const params = await transform({timestamp: basetimestamp, content});
		const editParams = typeof params === 'object' ? params : {text: String(params)};
		return await this.postWithEditToken(Object.assign({
			action: 'edit',
			title,
			assert: !this.anon ? 'user' : void 0, // Protect against errors and conflicts
			basetimestamp,
			starttimestamp,
			nocreate: true
		}, editParams));

	}

	/**
	 * Create a new section on a page.
	 *
	 * @param title Target page
	 * @param header Section title
	 * @param content Section content
	 * @param additionalParams Additional parameters for the API
	 * @returns See {@link ajax}.
	 */
	newSection(title: string, header: string, content: string, additionalParams: ApiParams = {}): Promise<unknown> {
		return this.postWithEditToken(Object.assign({
			action: 'edit',
			section: 'new',
			title: String(title),
			sectiontitle: header,
			text: content
		}), additionalParams);
	}

	// ****************************** QUERY HELPER METHODS ******************************

	/**
	 * Get the current user's groups and rights.
	 *
	 * @param assertUser Whether to append `{assert: 'user'}` to the query parameters (default: `false`)
	 * @param verbose Whether to output errors to the console, if any (default: `true`)
	 * @returns
	 */
	getUserInfo(assertUser = false, verbose = true) {
		return this.get({
			meta: 'userinfo',
			uiprop: 'groups|rights',
			assert: assertUser && 'user'
		}).then((res) => {
			const resUi = (<ApiResponse>res)?.query?.userinfo;
			if (resUi) {
				return resUi as {
					id: number;
					name: string;
					anon?: boolean;
					groups: string[];
					rights: string[];
				};
			} else {
				return Promise.reject({
					error: {
						code: 'ok-but-empty',
						info: 'OK response but empty result'
					}
				});
			}
		}).catch((err) => {
			if (verbose) console.log(err);
			return null;
		});
	}

	/**
	 * Check if a title is a category.
	 *
	 * @param title
	 * @param verbose Whether to output errors to the console, if any (default: `true`)
	 * @returns `null` on failure
	 */
	isCategory(title: string, verbose = true): Promise<boolean|null> {
		return this.get({
			prop: 'categoryinfo',
			titles: String(title),
		}).then((res) => {
			const resPages = (<ApiResponse>res).query?.pages;
			return !!(resPages && resPages[0] && resPages[0].categoryinfo);
		}).catch((err) => {
			if (verbose) console.log(err);
			return null;
		});
	}

	// getCategoriesByPrefix(prefix: string)

	/**
	 * Get the categories that a particular page on the wiki belongs to.
	 *
	 * @param title
	 * @param verbose Whether to output errors to the console, if any (default: `true`)
	 * @returns `null` on failure
	 */
	getCategories(title: string, verbose = true): Promise<string[]|null> {
		return this.get({
			prop: 'categories',
			titles: String(title),
		}).then((res) => {
			const resPages = (<ApiResponse>res).query?.pages;
			let page, categories;
			if (!resPages || !(page = resPages[0]) || !(categories = page.categories)) {
				return Promise.reject({
					error: {
						code: 'ok-but-empty',
						info: 'OK response but empty result'
					}
				});
			} else if (page.invalidreason) {
				return Promise.reject({
					error: {
						code: 'invalidtitle',
						info: page.invalidreason
					}
				});
			} else if (page.missing) {
				return Promise.reject({
					error: {
						code: 'pagemissing',
						info: 'The requested page does not exist'
					}
				});
			} else {
				return categories.map((cat) => cat.title);
			}
		}).catch((err) => {
			if (verbose) console.log(err);
			return null;
		});
	}

	// login
	// assertCurrentUser
	// chunkedUpload
	// chunkedUploadToStash
	// finishUploadToStash
	// getErrorMessage
	// getFirstKey(
	// getMessages(
	// loadMessages
	// loadMessagesIfMissing
	// parse(
	// retry
	// rollback
	// saveOption
	// saveOptions
	// slice
	// unwatch(
	// upload
	// uploadChunk
	// uploadFromStash
	// uploadToStash
	// uploadWithFormData
	// watch

}

function mapLegacyToken(action: string): string {
	// Legacy types for backward-compatibility with API action=tokens.
	const csrfActions = [
		'edit',
		'delete',
		'protect',
		'move',
		'block',
		'unblock',
		'email',
		'import',
		'options'
	];
	if (csrfActions.includes(action)) {
		console.log('[mwcc] Use of the "' + action + '" token is deprecated. Use "csrf" instead.');
		return 'csrf';
	}
	return action;
}