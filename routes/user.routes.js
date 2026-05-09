const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const fileUpload = require('../config/cloudinary');
const isAdmin = require('../middleware/isAdmin');
const { requireSelf } = require('../middleware/auth');

// router.get('/user/dashboard', async (req, res) => {
//   try {
//     if (!req.session.currentUser || !req.session.currentUser._id) {
//       res.redirect('/login');
//     } else {
//       const userId = req.session.currentUser._id;
//       const user = await User.findById(userId).populate({
//         path: 'userClients',
//         options: { strictPopulate: false }
//       });
//       res.render('clients/client-list', { user });
//     }
//   } catch (e) {
//     console.log(e);
//     res.render('index');
//   }
// });

router.get('/user/dashboard', isAdmin, async (req, res) => {
  //   console.log(req.session.currentUser.userClients);
  try {
    if (!req.session.currentUser || !req.session.currentUser._id) {
      res.redirect('/login');
    } else {
      const userId = req.session.currentUser._id;
      const user = await User.findById(userId).populate({
        path: 'userClients',
        options: { strictPopulate: false }
      });
      res.render('users/user-dashboard', { user });
    }
  } catch (e) {
    console.log(e);
    res.render('index');
  }
});

router.get('/user/:id', requireSelf, async (req, res) => {
  const user = await User.findById(req.params.id);

  res.render('users/user-settings', { user });
});

router.get('/user/:id/edit', requireSelf, async (req, res) => {
  const user = await User.findById(req.params.id);

  res.render('users/user-edit', { user });
});

router.post('/user/:id/edit', requireSelf, fileUpload.single('image'), async (req, res) => {
  const { username, email, address } = req.body;
  const userId = req.params.id;
  const user = await User.findById(req.params.id);

  let imageUrl = user.imageUrl;

  if (req.file) {
    imageUrl = req.file.path;
  }

  try {
    await User.findByIdAndUpdate(userId, {
      username,
      email,
      address,
      imageUrl
    });

    res.redirect(`/user/${userId}`);
  } catch (e) {
    console.log(e);
    res.redirect(`/user/${userId}/edit`);
  }
});

module.exports = router;
