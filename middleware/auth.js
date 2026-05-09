const User = require('../models/User.model');
const Client = require('../models/Client.model');

function requireLoggedIn(req, res, next) {
  if (!req.session.currentUser || !req.session.currentUser._id) {
    return res.redirect('/login');
  }

  return next();
}

function requireAccountant(req, res, next) {
  if (req.session.currentUser && req.session.currentUser.isAdmin) {
    return next();
  }

  return res.redirect('/');
}

function requireClient(req, res, next) {
  if (req.session.currentUser && !req.session.currentUser.isAdmin) {
    return next();
  }

  return res.redirect('/');
}

function requireSelf(req, res, next) {
  if (!req.session.currentUser || !req.session.currentUser._id) {
    return res.redirect('/login');
  }

  if (String(req.session.currentUser._id) !== String(req.params.id)) {
    return res.status(403).send('Forbidden');
  }

  return next();
}

async function loadOwnedClient(req, res, next) {
  try {
    const clientId =
      req.params.id || req.params.clientId || req.query.id || req.body.recipient;
    const currentUser = req.session.currentUser;

    if (!currentUser || !currentUser._id || !clientId) {
      return res.redirect('/login');
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).send('Client not found');
    }

    if (!currentUser.isAdmin) {
      if (String(currentUser._id) !== String(client._id)) {
        return res.status(403).send('Forbidden');
      }

      res.locals.client = client;
      return next();
    }

    const user = await User.findById(currentUser._id).select('userClients');
    const ownsClient = user.userClients.some(id => String(id) === String(client._id));

    if (!ownsClient) {
      return res.status(403).send('Forbidden');
    }

    res.locals.client = client;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireLoggedIn,
  requireAccountant,
  requireClient,
  requireSelf,
  loadOwnedClient
};
