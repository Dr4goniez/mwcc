/* eslint-disable @typescript-eslint/no-explicit-any */

// ************************************ general ************************************

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
	batchcomplete?: boolean;
	login?: ApiResponseLogin;
	query?: ApiResponseQuery;
	error?: ApiResponseError;
}

export interface ApiResponseError {
	code: string;
	info: string;
	docref?: string;
	details?: any; // script-internal
}

// ************************************ action=login ************************************

export interface ApiResponseLogin {
	result: string;
	reason?: string;
	lguserid?: number;
	lgusername?: string;
	/** @deprecated */
	token?: string;
}

// ************************************ action=query ************************************

export interface ApiResponseQuery {
	autocreatetempuser?: ApiResponseQueryMetaSiteinfoAutocreatetempuser;
	dbrepllag?: ApiResponseQueryMetaSiteinfoDbrepllag[];
	defaultoptions?: ApiResponseQueryMetaSiteinfoDefaultoptions;
	extensions?: ApiResponseQueryMetaSiteinfoExtensions[];
	extensiontags?: string[];
	fileextensions?: ApiResponseQueryMetaSiteinfoFileextensions[];
	functionhooks?: string[];
	general?: ApiResponseQueryMetaSiteinfoGeneral;
	interwikimap?: ApiResponseQueryMetaSiteinfoInterwikimap[];
	languages?: ApiResponseQueryMetaSiteinfoLanguages[];
	languagevariants?: ApiResponseQueryMetaSiteinfoLanguagevariants;
	libraries?: ApiResponseQueryMetaSiteinfoLibraries[];
	magicwords?: ApiResponseQueryMetaSiteinfoMagicwords[];
	namespacealiases?: ApiResponseQueryMetaSiteinfoNamespacealiases[];
	namespaces?: ApiResponseQueryMetaSiteinfoNamespaces;
	protocols: string[];
	restrictions?: ApiResponseQueryMetaSiteinfoRestrictions;
	rightsinfo?: ApiResponseQueryMetaSiteinfoRightsinfo;
	showhooks?: ApiResponseQueryMetaSiteinfoShowhooks[];
	skins?: ApiResponseQueryMetaSiteinfoSkins[];
	specialpagealiases?: ApiResponseQueryMetaSiteinfoSpecialpagealiases[];
	statistics?: ApiResponseQueryMetaSiteinfoStatistics;
	uploaddialog?: ApiResponseQueryMetaSiteinfoUploaddialog;
	usergroups?: ApiResponseQueryMetaSiteinfoUsergroups[];
	variables?: string[];
	userinfo?: ApiResponseQueryMetaUserinfo;
	tokens?: ApiResponseQueryMetaTokens;
}

// ************************************ action=query&meta=siteinfo (complete) ************************************

export interface ApiResponseQueryMetaSiteinfoAutocreatetempuser {
	enabled: boolean;
}

export interface ApiResponseQueryMetaSiteinfoDbrepllag {
	host: string;
	lag: number;
}

export interface ApiResponseQueryMetaSiteinfoDefaultoptions {
	[option: string]: number|string|boolean|null;
}

export interface ApiResponseQueryMetaSiteinfoExtensions {
	type: string;
	name: string;
	descriptionmsg: string;
	author: string;
	url: string;
	'vcs-system': string;
	'vcs-version': string;
	'vcs-url': string;
	'vcs-date': string;
	'license-name': string;
	license: string;
}

export interface ApiResponseQueryMetaSiteinfoFileextensions {
	ext: string;
}

export interface ApiResponseQueryMetaSiteinfoGeneral {
	mainpage: string;
	base: string;
	sitename: string;
	mainpageisdomainroot: boolean;
	logo: string;
	generator: string;
	phpversion: string;
	phpsapi: string;
	dbtype: string;
	dbversion: string;
	imagewhitelistenabled: boolean;
	langconversion: boolean;
	linkconversion: boolean;
	titleconversion: boolean;
	linkprefixcharset: string;
	linkprefix: string;
	linktrail: string;
	legaltitlechars: string;
	invalidusernamechars: string;
	allunicodefixes: boolean;
	fixarabicunicode: boolean;
	fixmalayalamunicode: boolean;
	'git-hash': string;
	'git-branch': string;
	case: string;
	lang: string;
	fallback: {
		code: string;
	}[];
	rtl: boolean;
	fallback8bitEncoding: string;
	readonly: boolean;
	writeapi: boolean;
	maxarticlesize: number;
	timezone: string;
	timeoffset: number;
	articlepath: string;
	scriptpath: string;
	script: string;
	variantarticlepath: boolean;
	server: string;
	servername: string;
	wikiid: string;
	time: string;
	misermode: boolean;
	uploadsenabled: boolean;
	maxuploadsize: number;
	minuploadchunksize: number;
	galleryoptions: {
		imagesPerRow: number;
		imageWidth: number;
		imageHeight: number;
		captionLength: boolean;
		showBytes: boolean;
		mode: string;
		showDimensions: boolean;
	};
	thumblimits: Record<string, number>;
	imagelimits: Record<string, {
		width: number;
		height: number;
	}>;
	favicon: string;
	centralidlookupprovider: string;
	allcentralidlookupproviders: string[];
	interwikimagic: boolean;
	magiclinks: Record<string, boolean>;
	categorycollation: string;
	nofollowlinks: boolean;
	nofollownsexceptions: string[];
	nofollowdomainexceptions: string[];
	externallinktarget: boolean;
	'wmf-config': Record<string, any>;
	citeresponsivereferences: boolean;
	linter: {
		high: string[];
		medium: string[];
		low: string[];
		none: string[];
	};
	mobileserver: string;
	'pageviewservice-supported-metrics': {
		pageviews: {
			pageviews: boolean;
			uniques: boolean;
		};
		siteviews: {
			pageviews: boolean;
			uniques: boolean;
		};
		mostviewed: {
			pageviews: boolean;
			uniques: boolean;
		};
	};
	'readinglists-config': Record<string, any>;
}

export interface ApiResponseQueryMetaSiteinfoInterwikimap {
	prefix: string;
	local?: boolean;
	language?: string;
	deprecated?: string;
	bcp47?: string;
	url: string;
	protorel: boolean;
}

export interface ApiResponseQueryMetaSiteinfoLanguages {
	code: string;
	bcp47: string;
	name: string;
}

export interface ApiResponseQueryMetaSiteinfoLanguagevariants {
	[lang: string]: {
		[variant: string]: {
			fallbacks: string[];
		};
	};
}

export interface ApiResponseQueryMetaSiteinfoLibraries {
	name: string;
	version: string;
}

export interface ApiResponseQueryMetaSiteinfoMagicwords {
	name: string;
	aliases: string[];
	'case-sensitive': boolean;
}

export interface ApiResponseQueryMetaSiteinfoNamespacealiases {
	id: number;
	alias: string;
}

export interface ApiResponseQueryMetaSiteinfoNamespaces {
	[nsnumber: string]: {
		id: number;
		case: string;
		name: string;
		subpages: boolean;
		canonical?: string;
		content: boolean;
		nonincludable: boolean;
	}
}

export interface ApiResponseQueryMetaSiteinfoRestrictions {
	types: string[];
	levels: string[];
	cascadinglevels: string[];
	semiprotectedlevels: string[];
}

export interface ApiResponseQueryMetaSiteinfoRightsinfo {
	url: string;
	text: string;
}

export interface ApiResponseQueryMetaSiteinfoShowhooks {
	name: string;
	subscribers: string[];
}

export interface ApiResponseQueryMetaSiteinfoSkins {
	code: string;
	name: string;
	default?: boolean;
	unusable?: boolean;
}

export interface ApiResponseQueryMetaSiteinfoSpecialpagealiases {
	realname: string;
	aliases: string[];
}

export interface ApiResponseQueryMetaSiteinfoStatistics {
	pages: number;
	articles: number;
	edits: number;
	images: number;
	users: number;
	activeusers: number;
	admins: number;
	jobs: number;
	'cirrussearch-article-words': number;
	'queued-massmessages': number;
}

export interface ApiResponseQueryMetaSiteinfoUploaddialog {
	fields: {
		description: boolean;
		date: boolean;
		categories: boolean;
	};
	licensemessages: {
		local: string;
		foreign: string;
	};
	comment: {
		local: string;
		foreign: string;
	};
	format: {
		filepage: string;
		description: string;
		ownwork: string;
		license: string;
		uncategorized: string;
	};
}

export interface ApiResponseQueryMetaSiteinfoUsergroups {
	name: string;
	rights: string[];
	number?: number;
	add?: string[];
	remove?: string[];
	'remove-self'?: string[];
}

// ************************************ action=query&meta=userinfo (complete) ************************************

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

// ************************************ action=query&meta=tokens (complete) ************************************

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