/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const dentalRecordSharing = require('./lib/dentalRecordSharing');

module.exports.DentalRecordSharing = dentalRecordSharing;
module.exports.contracts = [dentalRecordSharing];
