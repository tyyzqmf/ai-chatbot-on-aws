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


import * as fs from 'fs';
import { Command } from '@commander-js/extra-typings';
import Enquirer from 'enquirer';
import { LIB_VERSION } from './version';
import { CONFIG_FILE, DEFAULT_CONFIG } from '../configs/config';
import { SystemConfig } from '../configs/systemConfig';

/**
 * Main entry point
 */

const program = new Command().description(
  'Creates a new chatbot configuration',
);

(async () => {
  program.version(LIB_VERSION);

  program.option('-p, --prefix <prefix>', 'The prefix for the stack');

  program.action(async (options: any) => {
    if (fs.existsSync(CONFIG_FILE)) {
      const config: SystemConfig = JSON.parse(
        fs.readFileSync(CONFIG_FILE).toString('utf8'),
      );
      options.email = config.email;
      options.certificateArn = config.certificateArn;
      options.domainName = config.domainName;
    }
    try {
      await processCreateOptions(options);
    } catch (err) {
      console.error('Could not complete the operation.');
      if (err instanceof Error) {
        console.error(err.message);
      }
      process.exit(1);
    }
  });

  program.parse(process.argv);
})().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

function createConfig(config: any): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, undefined, 2));
  console.log('Configuration written to ./src/config.json');
}

/**
 * Prompts the user for missing options
 *
 * @param options Options provided via the CLI
 * @returns The complete options
 */
async function processCreateOptions(options: any): Promise<void> {

  const questions = [
    {
      type: 'input',
      name: 'email',
      message:
        'Please enter the administrator email address: ',
      initial: options.email,
    },
    {
      type: 'input',
      name: 'certificateArn',
      message:
        'Please enter the SSL certificate ARN (optional, press enter to skip): ',
      initial: options.certificateArn,
    },
    {
      type: 'input',
      name: 'domainName',
      message:
        'Please enter the domain name for the application (optional, press enter to skip): ',
      initial: options.domainName,
    },
  ];

  const answers: any = await Enquirer.prompt(questions);
  // Create the config object
  const config = {
    ...DEFAULT_CONFIG,
    email: answers.email,
    certificateArn: answers.certificateArn,
    domainName: answers.domainName,
  };

  console.log('\n✨ This is the chosen configuration:\n');
  console.log(JSON.stringify(config, undefined, 2));
  (
    (await Enquirer.prompt([
      {
        type: 'confirm',
        name: 'create',
        message:
          'Do you want to create/update the configuration based on the above settings',
        initial: true,
      },
    ])) as any
  ).create
    ? createConfig(config)
    : console.log('Skipping');
}
