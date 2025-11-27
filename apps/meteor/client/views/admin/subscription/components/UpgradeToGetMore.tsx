import { ButtonGroup } from '@rocket.chat/fuselage';
import type { ReactNode } from 'react';
import { memo } from 'react';

type UpgradeToGetMoreProps = {
	activeModules: string[];
	isEnterprise: boolean;
	children: ReactNode;
};

// ByteRoots fork: All enterprise modules are always enabled, never show upgrade content
const UpgradeToGetMore = ({ children }: UpgradeToGetMoreProps) => {
	return (
		<ButtonGroup large vertical>
			{children}
		</ButtonGroup>
	);
};

export default memo(UpgradeToGetMore);
