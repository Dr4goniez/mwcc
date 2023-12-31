/**
 * **Attributions**
 *
 * Some parts of the code are copied or adapted from the mediawiki.api module in MediaWiki core,
 * which is released under the GNU GPL v2 license.
 *
 * - {@link https://doc.wikimedia.org/mediawiki-core/REL1_41/js/source/index3.html | mw.Api}
 * - {@link https://doc.wikimedia.org/mediawiki-core/REL1_41/js/source/edit2.html | mw.Api.plugin.edit}
 * - {@link https://doc.wikimedia.org/mediawiki-core/REL1_41/js/source/user.html | mw.Api.plugin.user}
 *
 * @module
 */

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
 * The parameter to {@link MWCC.init}.
 */
export interface Initializer {
	/**
	 * API endpoint as a full URL (e.g. `https://en.wikipedia.org/w/api.php`).
	 */
	apiUrl: string;
	/**
	 * The bot's username (if you use `action=login`).
	 */
	username?: string;
	/**
	 * The bot's password (if you use `action=login`).
	 */
	password?: string;
	/**
	 * OAuth access token (if you use OAuth 2 in Extension:OAuth).
	 */
	OAuth2AccessToken?: string;
	/**
	 * OAuth credentials (if you use OAuth 1.0a in Extension:OAuth).
	 */
	OAuthCredentials?: {
		/** A 16-digit alphanumeric key. */
		consumerToken: string;
		/** A 20-digit alphanumeric key. */
		consumerSecret: string;
		/** A 16-digit alphanumeric key. */
		accessToken: string;
		/** A 20-digit alphanumeric key. */
		accessSecret: string;
	};
	/**
	 * An HTTP User-Agent header (`<client name>/<version> (<contact information>)`).
	 * @see https://meta.wikimedia.org/wiki/User-Agent_policy
	 */
	userAgent?: string;
	/**
	 * Default {@link https://github.com/axios/axios | Axios request config options}.
	 */
	options?: AxiosRequestConfig;
}

/**
 * An interface to interact with the {@link https://www.mediawiki.org/wiki/API:Main_page | MediaWiki Action API}.
 */
export class MWCC {

	/**
	 * The API endpoint. This must be included in the config of every HTTP request issued
	 * by the Axios instance.
	 */
	readonly apiUrl: string;

	/**
	 * A unique Axios instance for an MWCC instance.
	 */
	readonly axios: AxiosInstance;

	/**
	 * A container of credentials.
	 */
	private tokens: ApiResponseQueryMetaTokens = {};

	/**
	 * An array of `AbortController`s used in {@link abort}.
	 */
	private aborts: AbortController[];

	/**
	 * Whether the current user is anonymous.
	 */
	anon: boolean;

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
			throw new Error('[mwcc] No endpoint is passed to the MWCC constructor');
		} else {
			this.apiUrl = apiUrl;
		}

		// Initialize an Axios instance for this MWCC instance
		const config = Object.assign(
			{},
			MWCC.defaultOptions,
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

		// Storage of API requests. This makes it possible to manually abort unfinished ones
		this.aborts = [];

		// User-related properties
		this.anon = true;

	}

	/**
	 * The default config for HTTP requests, merged with the config passed to the constructor.
	 */
	static readonly defaultOptions: AxiosRequestConfig = {
		method: 'GET',
		headers: {
			'User-Agent': 'mwcc/' + packageJson.version
		},
		timeout: 30 * 1000, // 30 seconds
		withCredentials: true, // Related to cookie handling
		responseType: 'json',
		responseEncoding: 'utf8'
	};

	/**
	 * Login to a wiki and initialize a new `MWCC` instance for the project.
	 *
	 * @param initializer Object for instance initialization.
	 */
	static async init(initializer: Initializer): Promise<MWCC|null> {

		// Check the initializer's properties
		const {
			apiUrl,
			username,
			password,
			OAuth2AccessToken,
			OAuthCredentials,
			userAgent,
			options,
		} = initializer;
		if (!apiUrl) {
			throw new Error('[mwcc] No API endpoint is provided');
		}
		const pattern =
			username && password ? 1 :
			OAuth2AccessToken ? 2 :
			OAuthCredentials ? 3 : 0;
		if (!pattern) {
			throw new Error('[mwcc] Required credentials are missing');
		}

		// Get axios config
		const config = Object.assign({}, options || {});
		if (userAgent) {
			if (!config.headers) config.headers = {};
			config.headers['User-Agent'] = userAgent;
		}

		// Create an MWCC instance
		const mwcc = new MWCC(apiUrl, config);

		// Fetch a login token
		const token = await mwcc.getToken('login', {assert: void 0});
		if (typeof token !== 'string') {
			console.log('[mwcc] Login failed: No valid login token', token);
			return null;
		}

		// Login
		const resLogin = <ApiResponse>await mwcc.post({
			action: 'login',
			lgname: username,
			lgpassword: password,
			lgtoken: token,
			assert: void 0
		});
		if (resLogin.error || !resLogin.login || resLogin.login.result !== 'Success') {
			console.log('[mwcc] Login failed', resLogin);
			return null;
		} else {
			console.log('[mwcc] Logged in as ' + username);
		}

		mwcc.anon = false;
		return mwcc;

	}

	/**
	 * Abort all unfinished requests issued by this `MWCC` object.
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
			options.data = new URLSearchParams(data).toString();

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
					if (err.error?.code === 'badtoken' ) {
						this.badToken(tokenType);
						// Try again, once
						params.token = void 0;
						return this.getToken(tokenType, assertParams)
						.then((t) => {
							params.token = t;
							return this.post(params, options);
						})
						.catch(reject);
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

	// From mw.Api.plugin.edit

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
	 * @returns Raw API response as a resolved or rejected Promise object.
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

	// From mw.Api.plugin.user

	/**
	 * Get the current user's groups and rights.
	 *
	 * @param assertUser Whether to append `{assert: 'user'}` to the query parameters, defaulted to `false`.
	 * @returns
	 */
	getUserInfo(assertUser = false) {
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
				throw {
					error: {
						code: 'ok-but-empty',
						info: 'OK response but empty result'
					}
				};
			}
		}).catch((err) => {
			console.log('[mwcc] Failed to fetch user information', err);
			return null;
		});
	}

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