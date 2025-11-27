// Enterprise features always enabled - use static imports
import '../lib/audit/methods';
import '../api/audit';
import { createPermissions } from '../lib/audit/startup';

void createPermissions();
