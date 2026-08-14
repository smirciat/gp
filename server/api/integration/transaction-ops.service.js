'use strict';

import {Transaction, Customer, sequelize} from '../../sqldb';
import {findCustomerByIdentifier} from './membership.service';
import {transactionSummary} from './transactions.service';
import {
  normalizePoints,
  reverseBalanceDelta,
  signedBalanceDelta,
  validateTransactionPoints
} from '../transaction/points-guard';

const PAGE_SIZE = 1000;

/**
 * Paginated global ledger (legacy All Transactions — 1000 rows per page).
 */
export async function listAllTransactions({offset} = {}) {
  const page = Math.max(0, Math.floor(Number(offset)) || 0);
  const rows = await Transaction.findAll({
    order: [['_id', 'DESC']],
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE
  });

  return {
    offset: page,
    limit: PAGE_SIZE,
    count: rows.length,
    transactions: rows.map(transactionSummary)
  };
}

/**
 * Update a ledger row and adjust member currentPoints when points/type change.
 */
export async function updateTransaction({oldTransaction, newTransaction} = {}) {
  if (!oldTransaction || !newTransaction || oldTransaction._id == null) {
    const err = new Error('oldTransaction and newTransaction are required.');
    err.status = 400;
    throw err;
  }

  const newType = newTransaction.awardRedeem || 'award';
  const newValidated = validateTransactionPoints(newTransaction.points, newType);
  if (!newValidated.ok) {
    const err = new Error(newValidated.message);
    err.status = 400;
    throw err;
  }
  newTransaction.points = newValidated.points;

  const pointsOrTypeChanged =
    newTransaction.points !== oldTransaction.points ||
    newTransaction.awardRedeem !== oldTransaction.awardRedeem;

  if (pointsOrTypeChanged) {
    const oldDelta = signedBalanceDelta(
      oldTransaction.awardRedeem,
      oldTransaction.points
    );
    const newDelta = newValidated.skipBalance
      ? 0
      : signedBalanceDelta(newType, newValidated.points);
    const increment = newDelta - oldDelta;
    if (increment !== 0) {
      const string = 'COALESCE("currentPoints",0) + ' + increment;
      try {
        await Customer.update(
          {
            lastTransaction: oldTransaction._id,
            currentPoints: sequelize.literal(string)
          },
          {
            where: {userId: oldTransaction.userId}
          }
        );
      } catch (updateErr) {
        console.log(updateErr);
        const err = new Error(
          'Sequelize error while updating customer currentPoints.'
        );
        err.status = 500;
        throw err;
      }
    }
  }

  try {
    await Transaction.update(newTransaction, {
      where: {_id: oldTransaction._id}
    });
  } catch (updateErr) {
    console.log(updateErr);
    const err = new Error('Sequelize error while updating transaction.');
    err.status = 500;
    throw err;
  }

  const row = await Transaction.findOne({
    where: {_id: oldTransaction._id}
  });
  return {
    transaction: row ? transactionSummary(row) : newTransaction
  };
}

/**
 * Delete a ledger row and reverse its effect on member currentPoints.
 */
export async function deleteTransaction(transactionId) {
  const id = Math.floor(Number(transactionId));
  if (!Number.isFinite(id)) {
    const err = new Error('transaction id is required.');
    err.status = 400;
    throw err;
  }

  const row = await Transaction.findOne({where: {_id: id}});
  if (!row) {
    const err = new Error('Transaction not found.');
    err.status = 404;
    throw err;
  }

  const plain = row.get({plain: true});
  const delta = reverseBalanceDelta(plain.awardRedeem, plain.points);
  const customer = await findCustomerByIdentifier({userId: plain.userId});
  if (customer && delta !== 0) {
    const cp = normalizePoints(customer.get({plain: true}).currentPoints) || 0;
    await customer.update({currentPoints: cp + delta});
  }

  await row.destroy();

  return {
    deleted: true,
    _id: id,
    userId: plain.userId,
    currentPointsAdjusted: !!customer
  };
}
