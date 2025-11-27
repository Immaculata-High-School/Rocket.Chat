import { patchOmniCore } from '@rocket.chat/omni-core-ee';
import { Meteor } from 'meteor/meteor';

import './methods/addMonitor';
import './methods/getUnitsFromUserRoles';
import './methods/removeMonitor';
import './methods/removeTag';
import './methods/saveTag';
import './methods/removeUnit';
import './methods/saveUnit';
import './methods/removeBusinessHour';
import './methods/resumeOnHold';
import './hooks/afterTakeInquiry';
import './hooks/beforeNewInquiry';
import './hooks/beforeNewRoom';
import './hooks/beforeRoutingChat';
import './hooks/checkAgentBeforeTakeInquiry';
import './hooks/handleNextAgentPreferredEvents';
import './hooks/onCheckRoomParamsApi';
import './hooks/onLoadConfigApi';
import './hooks/onSaveVisitorInfo';
import './hooks/scheduleAutoTransfer';
import './hooks/resumeOnHold';
import './hooks/afterOnHold';
import './hooks/onTransferFailure';
import './lib/routing/LoadBalancing';
import './lib/routing/LoadRotation';
import './lib/AutoCloseOnHoldScheduler';
import './business-hour';
import './api';
import { createDefaultPriorities } from './priorities';

// Enterprise features always enabled - use static imports
import './hooks';
import './startup';
import { createPermissions } from './permissions';
import { createSettings } from './settings';
import './lib/unit';

patchOmniCore();

Meteor.startup(() => {
	void createSettings();
	void createPermissions();
	void createDefaultPriorities();
});
