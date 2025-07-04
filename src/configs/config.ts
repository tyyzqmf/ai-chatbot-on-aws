/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { existsSync, readFileSync } from 'fs';
import { SystemConfig } from './systemConfig';

export const CONFIG_FILE = './src/config.json';
export const DEFAULT_CONFIG: SystemConfig = {
  email: '',
};

export function getConfig(): SystemConfig {
  if (existsSync(CONFIG_FILE)) {
    return JSON.parse(
      readFileSync(CONFIG_FILE).toString('utf8'),
    ) as SystemConfig;
  }
  // Default config
  return DEFAULT_CONFIG;
}

export const config: SystemConfig = getConfig();
