import { Calendar } from '@rocket.chat/core-services';
import { Meteor } from 'meteor/meteor';

import { addSettings } from '../settings/outlookCalendar';

// Enterprise features always enabled - initialize directly
Meteor.startup(async () => {
	addSettings();

	await Calendar.setupNextNotification();
	await Calendar.setupNextStatusChange();
});
