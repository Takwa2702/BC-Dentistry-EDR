/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const assetTransfer = require('./lib/assetTransfer.js');

module.exports.assetTransfer = assetTransfer;
module.exports.contracts = [assetTransfer];
