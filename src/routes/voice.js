const express = require('express');
const Joi = require('joi');
const db = require('../db/connection');
const { authenticate, authorizeRole } = require('../middleware/auth');
const voiceAI = require('../services/voiceAI');

const router = express.Router();
router.use(authenticate, authorizeRole('passenger'));

// POST /api/voice/message — process a voice/text message through AI
router.post('/message', async (req, res, next) => {
  try {
    const schema = Joi.object({
      message: Joi.string().max(1000).required(),
      session_id: Joi.string().uuid(),
      current_location: Joi.object({
        lat: Joi.number(),
        lng: Joi.number(),
        address: Joi.string(),
      }),
    });
    const { message, session_id, current_location } = await schema.validateAsync(req.body);

    // Get or create conversation session
    let session;
    if (session_id) {
      session = await db('conversation_sessions')
        .where({ id: session_id, passenger_id: req.user.id })
        .first();
    }

    if (!session) {
      [session] = await db('conversation_sessions').insert({
        passenger_id: req.user.id,
        state: 'greeting',
        context: JSON.stringify({}),
        messages: JSON.stringify([]),
      }).returning('*');
    }

    const history = typeof session.messages === 'string' ? JSON.parse(session.messages) : session.messages;
    const context = typeof session.context === 'string' ? JSON.parse(session.context) : session.context;

    // Get active ride info if any
    let activeRide = null;
    if (session.active_ride_id) {
      activeRide = await db('rides').where({ id: session.active_ride_id }).first();
    }

    // Process through Claude AI
    const aiResponse = await voiceAI.processMessage(message, history, {
      currentLocation: current_location,
      conversationState: session.state,
      activeRide,
    });

    // Update conversation history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: aiResponse.raw || aiResponse.response_text });

    // Keep last 20 messages to manage token usage
    const trimmedHistory = history.slice(-20);

    await db('conversation_sessions').where({ id: session.id }).update({
      state: aiResponse.conversation_state || session.state,
      context: JSON.stringify({ ...context, last_action: aiResponse.action }),
      messages: JSON.stringify(trimmedHistory),
    });

    res.json({
      session_id: session.id,
      response_text: aiResponse.response_text,
      language: aiResponse.language,
      action: aiResponse.action,
      action_data: aiResponse.action_data,
      conversation_state: aiResponse.conversation_state,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/voice/new-session — start a fresh conversation
router.post('/new-session', async (req, res, next) => {
  try {
    const [session] = await db('conversation_sessions').insert({
      passenger_id: req.user.id,
      state: 'greeting',
      context: JSON.stringify({}),
      messages: JSON.stringify([]),
    }).returning('*');

    // Generate greeting
    const passenger = await db('passengers').where({ id: req.user.id }).first();
    const lang = passenger.language_preference || 'en';
    const greeting = lang === 'ta'
      ? 'வணக்கம்! எங்கே போக வேண்டும்?'
      : `Hi${passenger.name ? ` ${passenger.name}` : ''}! Where would you like to go?`;

    res.json({
      session_id: session.id,
      response_text: greeting,
      language: lang,
      action: 'none',
      conversation_state: 'greeting',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
