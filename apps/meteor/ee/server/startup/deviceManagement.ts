import { addSettings } from '../settings/deviceManagement';
import { createPermissions, createEmailTemplates } from '../lib/deviceManagement/startup';
import { listenSessionLogin } from '../lib/deviceManagement/session';

// Since enterprise features are always enabled, initialize directly without dynamic imports
// This avoids Meteor's "Nested imports can not import an async module" error
void (async () => {
	await addSettings();
	await createPermissions();
	await createEmailTemplates();
	await listenSessionLogin();
})();
