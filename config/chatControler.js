const ChatMessage = require('../models/Chat.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');

async function sendMessage(req, res) {
  const { message } = req.body;
  const currentUser = req.session.currentUser;

  if (!message || !message.trim()) {
    return res.status(400).send('Message is required');
  }

  try {
    if (currentUser.isAdmin) {
      const recipient = req.body.recipient;
      const client = res.locals.client || (await Client.findById(recipient));

      if (!client) {
        return res.status(404).send('Client not found');
      }

      const newUserMessage = new ChatMessage({
        sender: currentUser._id,
        senderModel: 'User',
        recipient: client._id,
        recipientModel: 'Client',
        content: message.trim()
      });

      await newUserMessage.save();

      // Save the message reference inside the client
      const user = await User.findById(currentUser._id);
      client.chats.push(newUserMessage);
      user.chats.push(newUserMessage);

      await client.save();
      await user.save();
      await newUserMessage.save();

      res.redirect(`/clients/${client.id}`);
    } else {
      const user = await User.findOne({
        userClients: currentUser._id
      });

      if (!user) {
        return res.status(404).send('Accountant not found');
      }

      const newClientMessage = new ChatMessage({
        sender: currentUser._id,
        senderModel: 'Client',
        recipient: user._id,
        recipientModel: 'User',
        content: message.trim()
      });

      const client = res.locals.client || (await Client.findById(currentUser._id));
      client.chats.push(newClientMessage);
      user.chats.push(newClientMessage);

      await client.save();
      await user.save();
      await newClientMessage.save();

      res.redirect(`/client/dashboard`);
    }

  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to send message');
  }
}

module.exports = {
  sendMessage
};
