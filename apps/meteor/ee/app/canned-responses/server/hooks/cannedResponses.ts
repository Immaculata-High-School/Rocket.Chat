import { settings } from '../../../../../app/settings/server';
import { BeforeSaveCannedResponse } from '../../../../server/hooks/messages/BeforeSaveCannedResponse';

// Enterprise features always enabled - enable canned responses by default
BeforeSaveCannedResponse.enabled = settings.get('Canned_Responses_Enable');

// Watch setting changes
settings.watch<boolean>('Canned_Responses_Enable', (value) => {
	BeforeSaveCannedResponse.enabled = value;
});
