require('dotenv').config();

const mongoose = require('mongoose');
const Client = require('../models/Client.model');

const MONGO_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spreadtax';

function normalizeIdentifier(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function assertIdentifier(field, value, clientId) {
  const expectedLength = field === 'nipc' ? 9 : 11;
  const pattern = new RegExp(`^\\d{${expectedLength}}$`);

  if (!pattern.test(value)) {
    throw new Error(
      `Client ${clientId} has invalid ${field}: "${value}". Fix this value before running the migration.`
    );
  }
}

function assertNoDuplicate(seen, field, value, clientId) {
  const previousClientId = seen.get(value);

  if (previousClientId && previousClientId !== String(clientId)) {
    throw new Error(
      `Duplicate ${field} "${value}" found for clients ${previousClientId} and ${clientId}. Resolve the duplicate before running the migration.`
    );
  }

  seen.set(value, String(clientId));
}

async function main() {
  await mongoose.connect(MONGO_URI);

  const clients = await Client.collection
    .find({}, { projection: { nipc: 1, niss: 1 } })
    .toArray();

  const seenNipc = new Map();
  const seenNiss = new Map();
  const updates = [];

  for (const client of clients) {
    const nipc = normalizeIdentifier(client.nipc);
    const niss = normalizeIdentifier(client.niss);

    assertIdentifier('nipc', nipc, client._id);
    assertIdentifier('niss', niss, client._id);
    assertNoDuplicate(seenNipc, 'nipc', nipc, client._id);
    assertNoDuplicate(seenNiss, 'niss', niss, client._id);

    if (client.nipc !== nipc || client.niss !== niss) {
      updates.push({
        updateOne: {
          filter: { _id: client._id },
          update: {
            $set: {
              nipc,
              niss
            }
          }
        }
      });
    }
  }

  if (updates.length > 0) {
    await Client.collection.bulkWrite(updates);
  }

  await Client.createIndexes();

  console.log(`Migrated ${updates.length} client identifier record(s).`);
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
