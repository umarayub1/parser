import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../supabaseClient';
import { selectUser } from '../store/authSlice';
import '../styles/ContactForm.css';

const ContactForm = () => {
  // Get current user from Redux store
  const user = useSelector(selectUser);
  
  const [formData, setFormData] = useState({
    name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStatus, setFormStatus] = useState({ type: '', message: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormStatus({ type: '', message: '' });

    try {
      // Prepare message data including user_id if logged in
      const messageData = {
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message
      };

      // Add user_id if the user is logged in
      if (user?.id) {
        messageData.user_id = user.id;
      }

      // Submit to Supabase contact_messages table
      const { error } = await supabase
        .from('contact_messages')
        .insert([messageData]);

      if (error) throw error;

      // Reset form on success
      setFormData({
        name: user?.user_metadata?.full_name || '',
        email: user?.email || '',
        subject: '',
        message: ''
      });
      setFormStatus({
        type: 'success',
        message: 'Your message has been sent successfully. We will get back to you soon!'
      });
    } catch (error) {
      console.error('Error submitting contact form:', error);
      setFormStatus({
        type: 'error',
        message: 'Failed to send message. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-form-container">
      <h1>Contact Us</h1>
      <p className="contact-intro">
        Have a question, suggestion, or comment? We would love to hear from you!
      </p>

      {formStatus.message && (
        <div className={`form-status ${formStatus.type}`}>
          {formStatus.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="contact-form">
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject</label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows="6"
            required
          ></textarea>
        </div>

        <button 
          type="submit" 
          className="submit-button" 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
};

export default ContactForm; 