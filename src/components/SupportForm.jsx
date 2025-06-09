import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { submitSupportRequest } from '../services/supportService';
import '../styles/ContactForm.css';

const SupportForm = () => {
  // Get current user from Redux store
  const user = useSelector(selectUser);
  
  const [formData, setFormData] = useState({
    name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    subject: '',
    message: '',
    category: 'general'
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
      const response = await submitSupportRequest(formData);
      
      if (response.success) {
        // Reset form on success
        setFormData({
          name: user?.user_metadata?.full_name || '',
          email: user?.email || '',
          subject: '',
          message: '',
          category: 'general'
        });
        setFormStatus({
          type: 'success',
          message: response.message || 'Your support request has been submitted successfully. We will get back to you soon!'
        });
      } else {
        throw new Error(response.error || 'Failed to submit support request');
      }
    } catch (error) {
      console.error('Error submitting support request:', error);
      setFormStatus({
        type: 'error',
        message: error.message || 'Failed to submit support request. Please try again later.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const supportCategories = [
    { value: 'general', label: 'General Questions' },
    { value: 'technical', label: 'Technical Support' },
    { value: 'payment', label: 'Payment Issues' },
    { value: 'billing', label: 'Billing Inquiries' },
    { value: 'account', label: 'Account Questions' },
    { value: 'feature', label: 'Feature Requests' }
  ];

  return (
    <div className="contact-form-container">
      <h1>Support Center</h1>
      <p className="contact-intro">
        Have a question, need help, or want to report an issue? We're here to help!
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
          <label htmlFor="category">Category</label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            {supportCategories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="subject">Subject</label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            placeholder="Brief description of your issue"
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
            placeholder="Describe your issue or question in detail..."
            required
          ></textarea>
        </div>

        <button 
          type="submit" 
          className="submit-button" 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send Support Request'}
        </button>
      </form>
    </div>
  );
};

export default SupportForm; 