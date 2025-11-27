// Enterprise features always enabled - use static imports
import './permissions';
import './hooks/onRemoveAgentDepartment';
import './hooks/onSaveAgentDepartment';
import './hooks/cannedResponses';
import './methods/saveCannedResponse';
import './methods/removeCannedResponse';
import { createSettings } from './settings';

void createSettings();
