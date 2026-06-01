/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const dentalRecordContract = require('./lib/dentalRecordContract');

module.exports.DentalRecordContract = dentalRecordContract;
module.exports.contracts = [dentalRecordContract];
