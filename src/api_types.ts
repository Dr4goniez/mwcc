/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The JavaScript primitive types.
 */
type primitive = string|number|bigint|boolean|null|undefined;

/**
 * The API query parameters.
 */
export interface ApiParams {
	[key: string]: primitive|primitive[];
}

export interface ApiResponse {
	login?: ApiResponseLogin;
	query?: ApiResponseQuery;
	error?: ApiResponseError;
}

export interface ApiResponseError {
	code: string;
	info: string;
	docref?: string;
	details?: any;
}

export interface ApiResponseLogin {
	result: string;
	reason?: string;
	lguserid?: number;
	lgusername?: string;
	/** @deprecated */
	token?: string;
 }

export interface ApiResponseQuery {
	userinfo?: ApiResponseQueryMetaUserinfo;
	tokens?: ApiResponseQueryMetaTokens;
}

export interface ApiResponseQueryMetaUserinfo {
	id: number;
	name: string;
	anon?: boolean;
	messages?: boolean;
	groups?: string[];
	groupmemberships?: {
		group: string;
		expiry: string;
	}[];
	implicitgroups?: string[];
	rights?: string[];
	changeablegroups?: {
		add: string[];
		remove: string[];
		'add-self': string[];
		'remove-self': string[];
	},
	options?: {
		[key: string]: string|number|boolean|null;
	};
	editcount?: number;
	ratelimits?: {
		[key: string]: {
			[key: string]: {
				hits: number;
				seconds: number;
			};
		};
	};
	theoreticalratelimits?: {
		[key: string]: {
			[key: string]: {
				hits: number;
				seconds: number;
			};
		};
	};
	email?: string;
	emailauthenticated?: string;
	registrationdate?: string;
	acceptlang?: {
		q: number;
		code: string;
	}[];
	unreadcount?: string;
	centralids?: {
		CentralAuth: number;
		local: number;
	},
	attachedlocal?: {
		CentralAuth: boolean;
		local: boolean;
	},
	attachedwiki?: {
		CentralAuth: boolean;
		local: boolean;
	},
	latestcontrib?: string;
	cancreateaccount?: boolean;
}

export interface ApiResponseQueryMetaTokens {
	createaccounttoken?: string;
	csrftoken?: string;
	deleteglobalaccounttoken?: string;
	logintoken?: string;
	patroltoken?: string;
	rollbacktoken?: string;
	setglobalaccountstatustoken?: string;
	userrightstoken?: string;
	watchtoken?: string;
}