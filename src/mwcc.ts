import { AxiosRequestConfig } from 'axios';
import { MWCCStatic } from './mwcc_static';
import {
	ApiResponse
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

let extending = false;

export class MWCC extends MWCCStatic {

	/**
	 * **PRIVATE CONSTRUCTOR**
	 *
	 * This creates a logged-in MWCC instance. Do not call `new MWCC` from external applications.
	 *
	 * @param apiUrl
	 * @param options
	 */
	private constructor(apiUrl: string, options: AxiosRequestConfig = {}) {
		if (!extending) {
			throw new Error('[mwcc] MWCC is a private constructor');
		}
		super(apiUrl, options);
	}

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
			console.log(new Error('[mwcc] No API endpoint is provided'));
			return null;
		}
		const pattern =
			username && password ? 1 :
			OAuth2AccessToken ? 2 :
			OAuthCredentials ? 3 : 0;
		if (!pattern) {
			console.log(new Error('[mwcc] Required credentials are missing'));
			return null;
		}

		// Get axios config
		const config = Object.assign({}, options || {});
		if (userAgent) {
			if (!config.headers) config.headers = {};
			config.headers['User-Agent'] = userAgent;
		}

		// Create an MWCC instance
		extending = true;
		const mwcc = new MWCC(apiUrl, config);
		extending = false;

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
		}
		mwcc.anon = false;

		// Get site and user info to set up MWCC.config
		const resInfo = <ApiResponse>await mwcc.get({
			meta: 'tokens|siteinfo|userinfo',
			type: '*',
			siprop: 'general|namespaces|namespacealiases',
			uiprop: 'groups|rights|editcount'
		});
		const newTokens = resInfo.query?.tokens; // Tokens for the anonymous request no longer work
		mwcc.tokens = newTokens || {};
		mwcc.initConfigData(resInfo);
		let domain = mwcc.config.get('wgServerName') || '';
		if (domain) domain = '@' + domain;
		console.log('[mwcc] Logged in as ' + username + domain); // Defer this message until the info query is done

		return mwcc;

	}

	// rollback		// assert=user
	// saveOption	// assert=user
	// saveOptions	// assert=user
	// watch		// assert=user
	// unwatch		// assert=user

	/**
	 * Storage of configuration values. For typing reasons, all the properties are initialized
	 * with temporary values (later updated by {@link initConfigData}).
	 */
	private configData = {
		wgArticlePath: '\x01',
		wgCaseSensitiveNamespaces: [NaN],
		wgContentLanguage: '\x01',
		wgContentNamespaces: [NaN],
		wgFormattedNamespaces: <Record<string, string>>{},
		wgLegalTitleChars: '\x01',
		wgNamespaceIds: <Record<string, number>>{},
		wgScript: '\x01',
		wgScriptPath: '\x01',
		wgServer: '\x01',
		wgServerName: '\x01',
		wgSiteName: '\x01',
		wgUserEditCount: NaN,
		wgUserGroups: ['\x01'],
		wgUserId: NaN,
		wgUserName: '\x01',
		wgUserRights: ['\x01'],
		wgVersion: '\x01',
		wgWikiID: '\x01'
	};

	/**
	 * Stores configuration values related to the site and the user.
	 */
	config = {

		/**
		 * Get a config value by name.
		 *
		 * @param configName
		 * @returns `null` if not found.
		 */
		get: <K extends keyof typeof this.configData>(configName: K): typeof this.configData[K]|null => {
			return this.validateConfigValue(configName, this.configData[configName]);
		},

		/**
		 * Set a config value by name.
		 *
		 * @param configName
		 * @param configValue
		 * @returns Whether the value was successfully set.
		 */
		set: <K extends keyof typeof this.configData, V extends typeof this.configData[K]>(configName: K, configValue: V): boolean => {
			const oldType = typeof this.configData[configName];
			const newType = typeof configValue;
			if (oldType !== 'undefined' && oldType === newType) { // Not checking array and null
				this.configData[configName] = configValue;
				return true;
			}
			return false;
		},

		/**
		 * Check if a config with a given name exists.
		 *
		 * @param configName
		 * @returns Can constantly return `false` if the config is not ready (must run {@link MWCC.init} beforehand).
		 */
		exists: <K extends keyof typeof this.configData>(configName: K): boolean => {
			return this.validateConfigValue(configName, this.configData[configName]) !== null;
		}

	};

	/**
	 * Check if a config value is the initial one.
	 *
	 * @param _
	 * @param val
	 * @returns The checked value if it's not the initial one, or else `null`.
	 */
	private validateConfigValue<K extends keyof typeof this.configData, V extends typeof this.configData[K]>(_: K, val: V): V | null {
		switch (typeof val) {
			case 'string':
				if (val !== '\x01') return val;
				break;
			case 'number':
				if (!isNaN(val)) return val;
				break;
			case 'object':
				if (Array.isArray(val)) {
					switch (typeof val[0]) {
						case 'undefined': // Value has been initialized with an empty array
							return <V>val.slice();
						case 'string':
							if (val[0] !== '\x01') return <V>val.slice();
							break;
						case 'number':
							if (!isNaN(val[0])) return <V>val.slice();
					}
				}
		}
		return null;
	}

	/**
	 * Initialize the data of {@link config} when {@link init} has fetched site and user information successfully.
	 * @param res
	 * @returns
	 */
	private initConfigData(res: ApiResponse): void {

		// Check for error
		const query = res.query;
		if (res.error || !query) {
			console.log('[mwcc] Failed to initialize MWCC.config');
			return;
		}

		/**
		 * Helper function to set a value to the config.
		 *
		 * Attempts to set a value by name, and on success, returns `false`, and on failure, returns the config key.
		 * The return value will be stored in an array, and we can get the names of the config whose value failed to
		 * be set just by filtering the array with non-false values.
		 *
		 * @param configName
		 * @param configValue If `undefined`, `false` is returned.
		 * @returns
		 */
		const set = <K extends keyof typeof this.configData, V extends typeof this.configData[K]>(configName: K, configValue?: V): K|false => {
			let failedConfig: K|false = configName;
			if (configValue !== void 0) {
				const success = this.config.set(configName, configValue);
				if (success) failedConfig = false;
			}
			return failedConfig;
		};

		// Deal with data that need to be formatted
		const wgCaseSensitiveNamespaces: number[] = [];
		const wgContentNamespaces: number[] = [];
		const wgFormattedNamespaces: Record<string, string> = {};
		const wgNamespaceIds: Record<string, number> = {};
		if (query.namespaces) {
			for (const nsnumber in query.namespaces) {
				const obj = query.namespaces[nsnumber];
				if (obj.case === 'case-sensitive') {
					wgCaseSensitiveNamespaces.push(parseInt(nsnumber));
				} else if (obj.content) {
					wgContentNamespaces.push(parseInt(nsnumber));
				}
				wgFormattedNamespaces[nsnumber] = obj.name;
			}
		}
		if (query.namespacealiases) {
			query.namespacealiases.forEach(({id, alias}) => {
				wgNamespaceIds[alias.toLowerCase().replace(/ /g, '_')] = id;
			});
		}

		// Set values
		const valSetMap: (keyof typeof this.configData|false)[] = [
			set('wgArticlePath', query?.general?.articlepath),
			set('wgCaseSensitiveNamespaces', query?.namespaces && wgCaseSensitiveNamespaces),
			set('wgContentLanguage', query?.general?.lang),
			set('wgContentNamespaces', query?.namespaces && wgContentNamespaces),
			// set('wgDBname', ),
			// set('wgExtraSignatureNamespaces', ),
			set('wgFormattedNamespaces', query?.namespaces && wgFormattedNamespaces),
			// set('wgGlobalGroups', ),
			set('wgLegalTitleChars', query?.general?.legaltitlechars),
			set('wgNamespaceIds', query?.namespacealiases && wgNamespaceIds),
			set('wgScript', query?.general?.script),
			set('wgScriptPath', query?.general?.scriptpath),
			set('wgServer', query?.general?.server),
			set('wgServerName', query?.general?.servername),
			set('wgSiteName', query?.general?.sitename),
			set('wgUserEditCount', query?.userinfo?.editcount),
			set('wgUserGroups', query?.userinfo?.groups),
			set('wgUserId', query?.userinfo?.id),
			set('wgUserName', query?.userinfo?.name),
			set('wgUserRights', query?.userinfo?.rights),
			set('wgVersion', query?.general?.generator?.replace(/^MediaWiki /, '')),
			set('wgWikiID', query?.general?.wikiid)
		];
		const failed = valSetMap.filter(val => val !== false).join(', ');
		if (failed) {
			console.log('[mwcc] Failed to set config value(s): ' + failed);
		}

	}

}