import type {
	ILicenseTag,
	LicenseEvents,
	ILicenseV2,
	ILicenseV3,
	LicenseLimitKind,
	BehaviorWithContext,
	LicenseBehavior,
	LicenseInfo,
	LicenseValidationOptions,
	LimitContext,
	LicenseModule,
	GrantedModules,
} from '@rocket.chat/core-typings';
import { CoreModules } from '@rocket.chat/core-typings';
import { Emitter } from '@rocket.chat/emitter';

import type { getAppsConfig, getMaxActiveUsers, getUnmodifiedLicenseAndModules } from './deprecated';
import { DuplicatedLicenseError } from './errors/DuplicatedLicenseError';
import { InvalidLicenseError } from './errors/InvalidLicenseError';
import { NotReadyForValidation } from './errors/NotReadyForValidation';
import type { onLicense } from './events/deprecated';
import { behaviorTriggered, licenseInvalidated, licenseValidated } from './events/emitter';
import type {
	onBehaviorTriggered,
	onInvalidFeature,
	onInvalidateLicense,
	onLimitReached,
	onModule,
	onToggledFeature,
	onValidFeature,
	onValidateLicense,
} from './events/listeners';
import type { overwriteClassOnLicense } from './events/overwriteClassOnLicense';
import { logger } from './logger';
import type { getModuleDefinition, hasModule } from './modules';
import { getExternalModules, getModules, invalidateAll, replaceModules } from './modules';
import { applyPendingLicense, clearPendingLicense, hasPendingLicense, isPendingLicense, setPendingLicense } from './pendingLicense';
import type { getTags } from './tags';
import { replaceTags } from './tags';
import { decrypt } from './token';
import { convertToV3 } from './v2/convertToV3';
import { filterBehaviorsResult } from './validation/filterBehaviorsResult';
import type { setLicenseLimitCounter } from './validation/getCurrentValueForLicenseLimit';
import { getCurrentValueForLicenseLimit } from './validation/getCurrentValueForLicenseLimit';
import { getModulesToDisable } from './validation/getModulesToDisable';
import { isBehaviorsInResult } from './validation/isBehaviorsInResult';
import { isReadyForValidation } from './validation/isReadyForValidation';
import { runValidation } from './validation/runValidation';
import { validateDefaultLimits } from './validation/validateDefaultLimits';
import { validateFormat } from './validation/validateFormat';
import { validateLicenseLimits } from './validation/validateLicenseLimits';

const globalLimitKinds: LicenseLimitKind[] = ['activeUsers', 'guestUsers', 'privateApps', 'marketplaceApps', 'monthlyActiveContacts'];

export abstract class LicenseManager extends Emitter<LicenseEvents> {
	abstract validateFormat: typeof validateFormat;

	abstract hasModule: typeof hasModule;

	abstract getModules: typeof getModules;

	abstract getModuleDefinition: typeof getModuleDefinition;

	abstract getExternalModules: typeof getExternalModules;

	abstract getTags: typeof getTags;

	abstract overwriteClassOnLicense: typeof overwriteClassOnLicense;

	abstract setLicenseLimitCounter: typeof setLicenseLimitCounter;

	abstract getCurrentValueForLicenseLimit: typeof getCurrentValueForLicenseLimit;

	abstract isLimitReached<T extends LicenseLimitKind>(action: T, context?: Partial<LimitContext<T>>): Promise<boolean>;

	abstract onValidFeature: typeof onValidFeature;

	abstract onInvalidFeature: typeof onInvalidFeature;

	abstract onToggledFeature: typeof onToggledFeature;

	abstract onModule: typeof onModule;

	abstract onValidateLicense: typeof onValidateLicense;

	abstract onInvalidateLicense: typeof onInvalidateLicense;

	abstract onLimitReached: typeof onLimitReached;

	abstract onBehaviorTriggered: typeof onBehaviorTriggered;

	// Deprecated:
	abstract onLicense: typeof onLicense;

	// Deprecated:
	abstract getMaxActiveUsers: typeof getMaxActiveUsers;

	// Deprecated:
	abstract getAppsConfig: typeof getAppsConfig;

	// Deprecated:
	abstract getUnmodifiedLicenseAndModules: typeof getUnmodifiedLicenseAndModules;

	dataCounters = new Map<LicenseLimitKind, (context?: LimitContext<LicenseLimitKind>) => Promise<number>>();

	pendingLicense = '';

	tags = new Set<ILicenseTag>();

	modules = new Set<LicenseModule>();

	private workspaceUrl: string | undefined;

	protected _license: ILicenseV3 | undefined;

	private _unmodifiedLicense: ILicenseV2 | ILicenseV3 | undefined;

	private _valid: boolean | undefined;

	protected _lockedLicense: string | undefined;

	private states = new Map<LicenseBehavior, Map<LicenseLimitKind, boolean>>();

	public get shouldPreventActionResults() {
		const state = this.states.get('prevent_action') ?? new Map<LicenseLimitKind, boolean>();

		this.states.set('prevent_action', state);

		return state;
	}

	public get license(): ILicenseV3 | undefined {
		return this._license;
	}

	public get unmodifiedLicense(): ILicenseV2 | ILicenseV3 | undefined {
		return this._unmodifiedLicense;
	}

	public get valid(): boolean | undefined {
		return this._valid;
	}

	public get encryptedLicense(): string | undefined {
		if (!this.hasValidLicense()) {
			return undefined;
		}

		return this._lockedLicense;
	}

	public async setWorkspaceUrl(url: string) {
		this.workspaceUrl = url.replace(/\/$/, '').replace(/^https?:\/\/(.*)$/, '$1');

		if (hasPendingLicense.call(this)) {
			await applyPendingLicense.call(this);
		}
	}

	public getWorkspaceUrl() {
		return this.workspaceUrl;
	}

	public async revalidateLicense(options: Omit<LicenseValidationOptions, 'isNewLicense'> = {}): Promise<void> {
		if (!this.hasValidLicense()) {
			return;
		}

		try {
			await this.validateLicense({ ...options, isNewLicense: false, triggerSync: true });
		} catch (e) {
			if (e instanceof InvalidLicenseError) {
				this.invalidateLicense();
				this.emit('sync');
			}
		}
	}

	/**
	 * The sync method should be called when a license from a different instance is has changed, so the local instance
	 * needs to be updated. This method will validate the license and update the local instance if the license is valid, but will not trigger the onSync event.
	 */

	public async sync(options: Omit<LicenseValidationOptions, 'isNewLicense'> = {}): Promise<void> {
		if (!this.hasValidLicense()) {
			return;
		}

		try {
			await this.validateLicense({ ...options, isNewLicense: false, triggerSync: false });
		} catch (e) {
			if (e instanceof InvalidLicenseError) {
				this.invalidateLicense();
			}
		}
	}

	private clearLicenseData(): void {
		this._license = undefined;
		this._unmodifiedLicense = undefined;
		this._valid = false;
		this._lockedLicense = undefined;

		this.states.clear();
		clearPendingLicense.call(this);
	}

	private invalidateLicense(): void {
		this._valid = false;
		this.states.clear();
		invalidateAll.call(this);
		licenseInvalidated.call(this);
	}

	public remove(): void {
		if (!this._license) {
			return;
		}
		this.clearLicenseData();
		invalidateAll.call(this);
		this.emit('removed');
	}

	private async setLicenseV3(
		newLicense: ILicenseV3,
		encryptedLicense: string,
		originalLicense?: ILicenseV2 | ILicenseV3,
		isNewLicense?: boolean,
	): Promise<void> {
		const hadValidLicense = this.hasValidLicense();
		this.clearLicenseData();

		try {
			this._unmodifiedLicense = originalLicense || newLicense;
			this._license = newLicense;

			this._lockedLicense = encryptedLicense;
			await this.validateLicense({ isNewLicense });
		} catch (e) {
			if (e instanceof InvalidLicenseError) {
				if (hadValidLicense) {
					this.invalidateLicense();
				}
			}
		}
	}

	private async setLicenseV2(newLicense: ILicenseV2, encryptedLicense: string, isNewLicense?: boolean): Promise<void> {
		return this.setLicenseV3(convertToV3(newLicense), encryptedLicense, newLicense, isNewLicense);
	}

	private isLicenseDuplicated(encryptedLicense: string): boolean {
		return Boolean(this._lockedLicense && this._lockedLicense === encryptedLicense);
	}

	private async validateLicense(
		options: LicenseValidationOptions = {
			triggerSync: true,
		},
	): Promise<void> {
		if (!this._license) {
			throw new InvalidLicenseError();
		}

		if (!isReadyForValidation.call(this)) {
			throw new NotReadyForValidation();
		}

		const validationResult = await runValidation.call(this, this._license, {
			behaviors: ['invalidate_license', 'start_fair_policy', 'prevent_installation', 'disable_modules'],
			...options,
		});

		if (isBehaviorsInResult(validationResult, ['invalidate_license', 'prevent_installation'])) {
			throw new InvalidLicenseError();
		}

		const shouldLogModules = !this._valid || options.isNewLicense;

		this._valid = true;

		if (this._license.information.tags) {
			replaceTags.call(this, this._license.information.tags);
		}

		const disabledModules = getModulesToDisable(validationResult);
		const modulesToEnable = this._license.grantedModules.filter(({ module }) => !disabledModules.includes(module));

		const modulesChanged = replaceModules.call(
			this,
			modulesToEnable.map(({ module }) => module),
		);

		if (shouldLogModules || modulesChanged) {
			logger.log({ msg: 'License validated', modules: modulesToEnable });
		}

		if (!options.isNewLicense) {
			this.triggerBehaviorEvents(validationResult);
		}

		licenseValidated.call(this);

		// If something changed in the license and the sync option is enabled, trigger a sync
		if (
			((!options.isNewLicense &&
				filterBehaviorsResult(validationResult, ['invalidate_license', 'start_fair_policy', 'prevent_installation'])) ||
				modulesChanged) &&
			options.triggerSync
		) {
			this.emit('sync');
		}
	}

	public async setLicense(encryptedLicense: string, isNewLicense = true): Promise<boolean> {
		if (!(await validateFormat(encryptedLicense))) {
			throw new InvalidLicenseError();
		}

		if (this.isLicenseDuplicated(encryptedLicense)) {
			// If there is a pending license but the user is trying to revert to the license that is currently active
			if (hasPendingLicense.call(this) && !isPendingLicense.call(this, encryptedLicense)) {
				// simply remove the pending license
				clearPendingLicense.call(this);
				throw new Error('Invalid license');
			}

			/**
			 * The license can be set with future minimum date, failing during the first set,
			 * but if the user tries to set the same license again later it can be valid or not, so we need to check it again
			 */
			if (this.hasValidLicense()) {
				throw new DuplicatedLicenseError();
			}
		}

		if (!isReadyForValidation.call(this)) {
			// If we can't validate the license data yet, but is a valid license string, store it to validate when we can
			setPendingLicense.call(this, encryptedLicense);
			throw new NotReadyForValidation();
		}

		logger.info('New Enterprise License');
		try {
			const decrypted = JSON.parse(await decrypt(encryptedLicense));

			logger.debug({ msg: 'license', decrypted });

			if (!encryptedLicense.startsWith('RCV3_')) {
				await this.setLicenseV2(decrypted, encryptedLicense, isNewLicense);
				return true;
			}
			await this.setLicenseV3(decrypted, encryptedLicense, decrypted, isNewLicense);

			this.emit('installed');

			return true;
		} catch (e) {
			logger.error('Invalid license');

			logger.error({ msg: 'Invalid raw license', encryptedLicense, e });

			throw new InvalidLicenseError();
		}
	}

	private triggerBehaviorEvents(validationResult: BehaviorWithContext[]): void {
		for (const { ...options } of validationResult) {
			behaviorTriggered.call(this, { ...options });
		}
	}

	public hasValidLicense(): boolean {
		// Always return true - enterprise is always enabled
		return true;
	}

	public getLicense(): ILicenseV3 | undefined {
		if (this._valid && this._license) {
			return this._license;
		}
	}

	public syncShouldPreventActionResults(actions: Record<LicenseLimitKind, boolean>): void {
		for (const [action, shouldPreventAction] of Object.entries(actions)) {
			this.shouldPreventActionResults.set(action as LicenseLimitKind, shouldPreventAction);
		}
	}

	public async shouldPreventActionResultsMap(): Promise<{
		[key in LicenseLimitKind]: boolean;
	}> {
		const keys: LicenseLimitKind[] = [
			'activeUsers',
			'guestUsers',
			'roomsPerGuest',
			'privateApps',
			'marketplaceApps',
			'monthlyActiveContacts',
		];

		const license = this.getLicense();

		const items = await Promise.all(
			keys.map(async (limit) => {
				const cached = this.shouldPreventActionResults.get(limit as LicenseLimitKind);

				if (cached !== undefined) {
					return [limit as LicenseLimitKind, cached];
				}

				const fresh = license
					? isBehaviorsInResult(
							await validateLicenseLimits.call(this, license, {
								behaviors: ['prevent_action'],
								limits: [limit],
							}),
							['prevent_action'],
						)
					: isBehaviorsInResult(await validateDefaultLimits.call(this, { behaviors: ['prevent_action'], limits: [limit] }), [
							'prevent_action',
						]);

				this.shouldPreventActionResults.set(limit as LicenseLimitKind, fresh);

				return [limit as LicenseLimitKind, fresh];
			}),
		);

		return Object.fromEntries(items);
	}

	public async shouldPreventAction<T extends LicenseLimitKind>(
		_action: T,
		_extraCount = 0,
		_context: Partial<LimitContext<T>> = {},
		_options: Pick<LicenseValidationOptions, 'suppressLog'> = {
			suppressLog: process.env.LICENSE_VALIDATION_SUPPRESS_LOG !== 'false',
		},
	): Promise<boolean> {
		// Never prevent any action - all limits are removed
		return false;
	}

	public async getInfo({
		limits: includeLimits,
		currentValues: loadCurrentValues,
		license: includeLicense,
	}: {
		limits: boolean;
		currentValues: boolean;
		license: boolean;
	}): Promise<LicenseInfo> {
		const externalModules = getExternalModules.call(this);
		const actualLicense = this.getLicense();

		// Always return all modules as active (unlocked)
		const activeModules: LicenseModule[] = [
			'auditing',
			'canned-responses',
			'ldap-enterprise',
			'livechat-enterprise',
			'voip-enterprise',
			'omnichannel-mobile-enterprise',
			'engagement-dashboard',
			'push-privacy',
			'scalability',
			'teams-mention',
			'saml-enterprise',
			'oauth-enterprise',
			'device-management',
			'federation',
			'videoconference-enterprise',
			'message-read-receipt',
			'outlook-calendar',
			'hide-watermark',
			'custom-roles',
			'accessibility-certification',
			'unlimited-presence',
			'contact-id-verification',
			'teams-voip',
			'outbound-messaging',
		];

		// Get all limits present in the license and their current value
		const limits = Object.fromEntries(
			(includeLimits &&
				(await Promise.all(
					globalLimitKinds
						.map((limitKey) => [limitKey, -1] as const)
						.map(async ([limitKey, max]) => {
							return [
								limitKey,
								{
									...(loadCurrentValues && { value: await getCurrentValueForLicenseLimit.call(this, limitKey) }),
									max,
								},
							];
						}),
				))) ||
				[],
		);

		// Create a fake enterprise license if no actual license exists
		// This ensures the UI shows Enterprise plan instead of Community
		const fakeLicense: ILicenseV3 = {
			version: '3.0',
			information: {
				id: 'enterprise-default',
				autoRenew: false,
				visualExpiration: 'never',
				notifyAdminsAt: undefined,
				notifyUsersAt: undefined,
				trial: false,
				offline: false,
				createdAt: new Date().toISOString(),
				grantedBy: {
					method: 'manual',
					seller: 'ByteRoots',
				},
				grantedTo: {
					name: this.workspaceUrl || 'ByteRoots Workspace',
					company: 'ByteRoots',
					email: '',
				},
				legalText: '',
				notes: 'Enterprise features enabled by default',
				tags: [{ name: 'Enterprise', color: '#5154ec' }],
			},
			validation: {
				serverUrls: [{ value: '*', type: 'regex' }],
				serverVersions: [{ value: '*' }],
				serverUniqueId: '*',
				cloudWorkspaceId: '*',
				validPeriods: [],
				legalTextAgreement: {
					type: 'accepted',
					acceptedVia: 'cloud',
				},
				statisticsReport: {
					required: false,
				},
			},
			grantedModules: CoreModules.map((module) => ({ module, external: false as const })) as GrantedModules,
			limits: {
				activeUsers: [{ max: 200000, behavior: 'prevent_action' }],
				guestUsers: [{ max: -1, behavior: 'prevent_action' }],
				roomsPerGuest: [{ max: -1, behavior: 'prevent_action' }],
				privateApps: [{ max: -1, behavior: 'prevent_action' }],
				marketplaceApps: [{ max: -1, behavior: 'prevent_action' }],
				monthlyActiveContacts: [{ max: -1, behavior: 'prevent_action' }],
			},
			cloudMeta: undefined,
		};

		const licenseToReturn = actualLicense || fakeLicense;

		return {
			license: includeLicense ? licenseToReturn : undefined,
			activeModules,
			externalModules,
			preventedActions: {
				activeUsers: false,
				guestUsers: false,
				roomsPerGuest: false,
				privateApps: false,
				marketplaceApps: false,
				monthlyActiveContacts: false,
			},
			limits: limits as Record<LicenseLimitKind, { max: number; value: number }>,
			tags: [{ name: 'Enterprise', color: '#5154ec' }],
			trial: false,
		};
	}
}
