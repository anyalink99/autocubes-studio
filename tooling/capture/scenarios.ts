import {CaptureScenario} from './types';
import {flowlineScenario} from '../../data/sites/flowline/scenario';

export const scenarios: Record<string, CaptureScenario> = {
  flowline: flowlineScenario,
};
