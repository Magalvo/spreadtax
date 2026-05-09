const express = require('express');
const router = express.Router();
const transporter = require('../config/transporter.config');
const { requireLoggedIn } = require('../middleware/auth');

router.post('/send-email', requireLoggedIn, async (req, res, next) => {
  const { email, subject, message } = req.body;

  try {
    const info = await transporter.sendMail({
      from: `"Spreadtax" <${process.env.EMAIL_ADDRESS}>`,
      to: email,
      subject,
      text: message
    });

    return res.render('message', { email, subject, message, info });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
