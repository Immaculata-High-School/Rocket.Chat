import type { LicenseModule } from '@rocket.chat/core-typings';

import { useLicenseBase } from './useLicense';

export const useHasLicenseModule = (licenseName: LicenseModule | undefined): 'loading' | boolean => {
	// Always return true - all modules enabled (ByteRoots fork)
	return (
		useLicenseBase({
			select: () => !!licenseName,
		}).data ?? true
	);
};
