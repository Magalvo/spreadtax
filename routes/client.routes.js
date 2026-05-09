const express = require('express');
const router = express.Router();
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const bcrypt = require('bcryptjs');
const { Types } = require('mongoose');
const fileUpload = require('../config/cloudinary');
const {
  requireAccountant,
  requireClient,
  requireLoggedIn,
  loadOwnedClient
} = require('../middleware/auth');

const PASSWORD_REGEX = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;

function normalizeIdentifier(value) {
  return String(value || '').trim();
}

function identifierQueryValues(value) {
  const normalized = normalizeIdentifier(value);
  const values = [normalized];
  const numericValue = Number(normalized);

  if (Number.isSafeInteger(numericValue)) {
    values.push(numericValue);
  }

  return values;
}

async function clientIdentifierExists(field, value, excludeId) {
  const query = {
    [field]: { $in: identifierQueryValues(value) }
  };

  if (excludeId) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }

  return Client.collection.findOne(query, { projection: { _id: 1 } });
}

router.get('/clients/new', requireAccountant, async (req, res) => {
  const user = await User.findById(req.session.currentUser._id);

  // check for account type
  if (!req.session.currentUser || !user) {
    return res.redirect('/login');
  } else {
    if (user.accountType.isFree && user.userClients.length >= 2) {
      // showModal = true;
      return res.redirect('/#plans');
    } else if (user.accountType.isPremium && user.userClients.length >= 4) {
      // showModal = true;
      return res.redirect('/#plans');
    } else {
      return res.render('clients/new-client');
    }
  }
});

router.post('/clients/new', requireAccountant, fileUpload.single('image'), async (req, res) => {
  let fileUrlOnCloudinary = '';
  if (req.file) {
    fileUrlOnCloudinary = req.file.path;
  }
  //current logged User landfinance2
  const { companyName, email, password, address } = req.body;
  const nipc = normalizeIdentifier(req.body.nipc);
  const niss = normalizeIdentifier(req.body.niss);

  if (!companyName || !email || !password || !nipc || !niss || !address) {
    res.render('clients/new-client', { errorMessage: 'Fill in all fields' });
    return;
  }

  if (!/^\d{9}$/.test(nipc) || !/^\d{11}$/.test(niss)) {
    res.render('clients/new-client', {
      errorMessage: 'NIF must have 9 digits and NISS must have 11 digits'
    });
    return;
  }

  if (PASSWORD_REGEX.test(password) === false) {
    res.render('clients/new-client', { errorMessage: 'Password is too weak' });
    return;
  }

  const user = await User.findById(req.session.currentUser._id).populate(
    'userClients'
  );

  const testUsername = req.body.companyName;
  if (user.userClients.some(client => client.companyName === testUsername)) {
    res.render('clients/new-client', {
      errorMessage: 'Username already registered'
    });
    return;
  }

  const testNipc = req.body.nipc;
  if (
    user.userClients.some(client => String(client.nipc) === String(testNipc)) ||
    (await clientIdentifierExists('nipc', nipc))
  ) {
    res.render('clients/new-client', {
      errorMessage: 'NIPC already registered'
    });
    return;
  }

  const testNiss = req.body.niss;
  if (
    user.userClients.some(client => String(client.niss) === String(testNiss)) ||
    (await clientIdentifierExists('niss', niss))
  ) {
    res.render('clients/new-client', {
      errorMessage: 'NISS already registered'
    });
    return;
  }

  const testEmail = req.body.email;
  if (user.userClients.some(client => client.email === testEmail)) {
    res.render('clients/new-client', {
      errorMessage: 'Email already exists'
    });
    return;
  }

  const saltRounds = 10;
  const salt = bcrypt.genSaltSync(saltRounds);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const newClient = await Client.create({
    companyName,
    email,
    password: hashedPassword,
    nipc,
    niss,
    address,
    imageUrl: fileUrlOnCloudinary
  });

  //Find current user
  const currentUser = await User.findById(req.session.currentUser._id);

  //update push client
  currentUser.userClients.push(newClient._id);

  await currentUser.save();

  res.redirect('/user/dashboard');
});

router.get('/clients/:id', requireLoggedIn, loadOwnedClient, async (req, res) => {
  const clientId = req.params.id;

  try {
    if (!req.session.currentUser || !req.session.currentUser._id) {
      return res.redirect('/login');
    } else {
      const client = await Client.findById(clientId)
        .populate({
          path: 'clientFiles',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'chats',
          populate: { path: 'sender recipient' },
          options: { sort: { timestamp: 'desc' }, limit: 3 }
        });

      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
      ];

      if (client) {
        const messages = client.chats;

        res.render('clients/client-details', {
          client,
          months,
          messages
        });
      } else {
        res.render('clients/client-details', {
          client,
          months
        });
      }
    }
  } catch (error) {
    console.error(error);
    res.render('index');
  }
});

router.post('/clients/edit', requireAccountant, loadOwnedClient, fileUpload.single('image'), async (req, res) => {
  const { companyName, email, address } = req.body;
  const nipc = normalizeIdentifier(req.body.nipc);
  const niss = normalizeIdentifier(req.body.niss);
  const client = await Client.findById(req.query.id);

  let imageUrl = client.imageUrl;
  if (req.file) {
    imageUrl = req.file.path;
  }

  try {
    if (!/^\d{9}$/.test(nipc) || !/^\d{11}$/.test(niss)) {
      return res.render('clients/client-edit', {
        client,
        errorMessage: 'NIF must have 9 digits and NISS must have 11 digits'
      });
    }

    if (await clientIdentifierExists('nipc', nipc, req.query.id)) {
      return res.render('clients/client-edit', {
        client,
        errorMessage: 'NIPC already registered'
      });
    }

    if (await clientIdentifierExists('niss', niss, req.query.id)) {
      return res.render('clients/client-edit', {
        client,
        errorMessage: 'NISS already registered'
      });
    }

    await Client.findByIdAndUpdate(req.query.id, {
      companyName,
      email,
      nipc,
      niss,
      address,
      imageUrl
    }, {
      runValidators: true
    });

    res.redirect(`/clients/${req.query.id}`);
  } catch (e) {
    console.error(e);
    res.redirect(`/clients/${req.query.id}`);
  }
});

router.get('/clients/:id/edit', requireAccountant, loadOwnedClient, async (req, res) => {
  const client = await Client.findById(req.params.id);

  res.render('clients/client-edit', { client });
});

router.get('/client/dashboard/', requireClient, async (req, res) => {
  try {
    if (!req.session.currentUser || !req.session.currentUser._id) {
      return res.redirect('/login');
    } else {
      const clientId = req.session.currentUser._id;

      const client = await Client.findById(clientId)
        .populate({
          path: 'clientFiles',
          options: { strictPopulate: false }
        })
        .populate({
          path: 'chats',
          options: { sort: { timestamp: 'desc' }, limit: 3 },
          populate: { path: 'sender recipient' }
        });

      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
      ];

      res.render('clients/client-dashboard', {
        months,
        client,
        clientId,
        messages: client.chats,
        currentUserId: req.session.currentUser._id.toString() // Convert the current user ID to a string
      });
    }
  } catch (error) {
    console.error(error);
    res.render('index');
  }
});

router.post('/clients/:id/delete', requireAccountant, loadOwnedClient, async (req, res) => {
  const currentUser = await User.findById(req.session.currentUser._id);
  const deletedClient = await Client.findByIdAndDelete(req.params.id);

  try {
    if (!deletedClient) {
      return res.status(404).send('Client not found');
    }

    const index = currentUser.userClients.indexOf(deletedClient._id);
    if (index > -1) {
      currentUser.userClients.splice(index, 1);
    }

    await currentUser.save();
    console.log(`Client with ID ${req.params.id} deleted successfully`);

    res.redirect(`/user/dashboard`);
  } catch (err) {
    console.error(err);
  }
});

module.exports = router;
