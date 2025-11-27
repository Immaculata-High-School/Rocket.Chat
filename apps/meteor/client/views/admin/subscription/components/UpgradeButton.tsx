import type { ButtonProps } from '@rocket.chat/fuselage/dist/components/Button/Button';
import type { ReactElement } from 'react';
import { memo } from 'react';

// ByteRoots fork: UpgradeButton is hidden since enterprise is always enabled
const UpgradeButton = ({
	children,
	target = '_blank',
	action,
	...props
}: Partial<ButtonProps> & {
	target: string;
	action: string;
}): ReactElement | null => {
	// Never show upgrade button - enterprise is always enabled
	return null;
};

export default memo(UpgradeButton);
