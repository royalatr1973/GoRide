import React, { useState, useRef, useEffect } from 'react';
import { voiceAPI } from '../api';

function VoiceChat({ onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hi! I can help you book a ride. Where would you like to go?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEnd = useRef(null);

  useEffect(() => {
    voiceAPI.newSession().then(({ data }) => {
      setSessionId(data.session_id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const { data } = await voiceAPI.sendMessage(userMsg, sessionId);
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply || data.message }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    }
    setLoading(false);
  };

  return (
    <div className="voice-overlay">
      <div className="voice-chat">
        <div className="voice-header">
          <h3>Voice Booking</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="voice-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`voice-msg ${msg.role}`}>
              {msg.text}
            </div>
          ))}
          {loading && <div className="voice-msg assistant typing">Thinking...</div>}
          <div ref={messagesEnd} />
        </div>
        <form className="voice-input" onSubmit={handleSend}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or say where you want to go..."
            autoFocus
          />
          <button type="submit" disabled={loading || !input.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}

export default VoiceChat;
