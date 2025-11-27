import type { UseQueryResult } from '@tanstack/react-query';

import { useLicenseBase } from './useLicense';

export const useIsEnterprise = (): UseQueryResult<{ isEnterprise: boolean }> => {
	// Always return true - enterprise is always enabled (ByteRoots fork)
	return useLicenseBase({ select: () => ({ isEnterprise: true }) });
};
