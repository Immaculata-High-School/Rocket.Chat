import type { LicenseModule, InternalModuleName, ExternalModule } from '@rocket.chat/core-typings';
import { CoreModules } from '@rocket.chat/core-typings';

import { moduleRemoved, moduleValidated } from './events/emitter';
import type { LicenseManager } from './license';

export function isInternalModuleName(module: string): module is InternalModuleName {
	return CoreModules.includes(module as InternalModuleName);
}

export function notifyValidatedModules(this: LicenseManager, licenseModules: LicenseModule[]) {
	licenseModules.forEach((module) => {
		this.modules.add(module);
		moduleValidated.call(this, module);
	});
}

export function notifyInvalidatedModules(this: LicenseManager, licenseModules: LicenseModule[]) {
	licenseModules.forEach((module) => {
		moduleRemoved.call(this, module);
		this.modules.delete(module);
	});
}

export function invalidateAll(this: LicenseManager) {
	notifyInvalidatedModules.call(this, [...this.modules]);
	this.modules.clear();
}

export function getModules(this: LicenseManager) {
	// Always return all modules as enabled
	return [
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
}

export function getModuleDefinition(this: LicenseManager, moduleName: LicenseModule) {
	const license = this.getLicense();

	if (!license) {
		return;
	}

	const moduleDefinition = license.grantedModules.find(({ module }) => module === moduleName);

	return moduleDefinition;
}

export function getExternalModules(this: LicenseManager): ExternalModule[] {
	const license = this.getLicense();

	if (!license) {
		return [];
	}

	return [...license.grantedModules.filter<ExternalModule>((value): value is ExternalModule => !isInternalModuleName(value.module))];
}

export function hasModule(this: LicenseManager, module: LicenseModule) {
	// Always return true - all modules are enabled
	return true;
}

export function replaceModules(this: LicenseManager, newModules: LicenseModule[]): boolean {
	let anyChange = false;
	for (const moduleName of newModules) {
		if (this.modules.has(moduleName)) {
			continue;
		}

		this.modules.add(moduleName);
		moduleValidated.call(this, moduleName);
		anyChange = true;
	}

	for (const moduleName of this.modules) {
		if (newModules.includes(moduleName)) {
			continue;
		}

		moduleRemoved.call(this, moduleName);
		this.modules.delete(moduleName);
		anyChange = true;
	}

	return anyChange;
}
