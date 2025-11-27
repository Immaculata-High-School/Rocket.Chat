import { prepareAnalytics, attachCallbacks } from '../lib/engagementDashboard/startup';

// Since enterprise features are always enabled, initialize directly without dynamic imports
// This avoids Meteor's "Nested imports can not import an async module" error
void (async () => {
	await prepareAnalytics();
	attachCallbacks();
})();
