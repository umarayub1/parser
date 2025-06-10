import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';
import { submitSupportRequest } from '../services/supportService';

const SupportPage = () => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  
  const [formData, setFormData] = useState({
    name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    subject: '',
    message: '',
    category: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formStatus, setFormStatus] = useState({ type: '', message: '' });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
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
        setSubmitted(true);
        setFormStatus({
          type: 'success',
          message: response.message || 'Your support request has been submitted successfully!'
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
    { value: 'payment', label: 'Payment Issues' },
    { value: 'technical', label: 'Technical Support' },
    { value: 'account', label: 'Account Questions' },
    { value: 'billing', label: 'Billing Inquiries' },
    { value: 'feature', label: 'Feature Requests' },
    { value: 'general', label: 'General Questions' }
  ];

  const faqs = [
    {
      question: 'How do I process a payment retry?',
      answer: 'If your payment failed, you can retry by going to the Subscriptions page and selecting your plan again. Make sure your payment details are correct.'
    },
    {
      question: 'Why was my payment declined?',
      answer: 'Payments can be declined for various reasons including insufficient funds, expired cards, or bank security measures. Contact your bank if the issue persists.'
    },
    {
      question: 'How do I change my subscription plan?',
      answer: 'You can upgrade or downgrade your plan anytime by going to the Subscriptions page. Changes take effect immediately.'
    },
    {
      question: 'How are credits calculated?',
      answer: 'Credits are consumed based on the number of pages in your PDF and your subscription plan. Each plan has different rates per page.'
    },
    {
      question: 'Do my unused credits roll over to the next month?',
      answer: 'Yes, unused credits roll over to the next month, so you never lose credits you\'ve paid for. This ensures you get the full value of your subscription.'
    }
  ];

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.successContainer}>
          <div style={styles.successIcon}>✅</div>
          <h1 style={styles.successTitle}>Support Request Submitted!</h1>
          <p style={styles.successMessage}>
            Thank you for contacting us. We've received your message and will get back to you within 24 hours.
          </p>
          <button onClick={() => navigate('/requests')} style={styles.button}>
            Return to Requests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Support Center</h1>
        <p style={styles.subtitle}>
          We're here to help! Get answers to common questions or contact our support team.
        </p>
      </div>

      <div style={styles.content}>
        {/* FAQ Section */}
        <div style={styles.faqSection}>
          <h2 style={styles.sectionTitle}>Frequently Asked Questions</h2>
          <div style={styles.faqList}>
            {faqs.map((faq, index) => (
              <div key={index} style={styles.faqItem}>
                <h3 style={styles.faqQuestion}>{faq.question}</h3>
                <p style={styles.faqAnswer}>{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        <div style={styles.contactSection}>
          <h2 style={styles.sectionTitle}>Contact Support</h2>
          <p style={styles.contactDescription}>
            Can't find what you're looking for? Send us a message and we'll help you out.
          </p>

          {formStatus.message && (
            <div style={{
              ...styles.formStatus,
              backgroundColor: formStatus.type === 'success' ? '#e7f5ea' : '#fdecea',
              color: formStatus.type === 'success' ? '#2e7d32' : '#d32f2f',
              border: `1px solid ${formStatus.type === 'success' ? '#a5d6b7' : '#f5c6cb'}`
            }}>
              {formStatus.message}
            </div>
          )}
          
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  style={styles.input}
                  required
                />
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                style={styles.select}
              >
                {supportCategories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Subject</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="Brief description of your issue"
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Message</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                style={styles.textarea}
                placeholder="Describe your issue in detail..."
                rows="6"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...styles.submitButton,
                opacity: isSubmitting ? 0.7 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        </div>

        {/* Quick Contact Options */}
        <div style={styles.quickContact}>
          <h3 style={styles.quickContactTitle}>Other Ways to Reach Us</h3>
          <div style={styles.contactMethods}>
            <div style={styles.contactMethod}>
              <span style={styles.contactIcon}>📧</span>
              <div>
                <h4 style={styles.contactMethodTitle}>Email</h4>
                <p style={styles.contactMethodText}>ramish@parselab.co</p>
                <p style={styles.contactMethodNote}>Response within 24 hours</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '40px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '50px'
  },
  title: {
    fontSize: '42px',
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '15px',
    margin: '0 0 15px 0'
  },
  subtitle: {
    fontSize: '18px',
    color: '#7f8c8d',
    lineHeight: 1.6,
    maxWidth: '600px',
    margin: '0 auto'
  },
  content: {
    display: 'grid',
    gap: '50px'
  },
  faqSection: {
    background: '#f8f9fa',
    borderRadius: '12px',
    padding: '30px'
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '25px',
    margin: '0 0 25px 0'
  },
  faqList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  faqItem: {
    background: 'white',
    borderRadius: '8px',
    padding: '20px',
    border: '1px solid #e9ecef'
  },
  faqQuestion: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '10px',
    margin: '0 0 10px 0'
  },
  faqAnswer: {
    fontSize: '14px',
    color: '#6c757d',
    lineHeight: 1.6,
    margin: 0
  },
  contactSection: {
    background: 'white',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
  },
  contactDescription: {
    fontSize: '16px',
    color: '#6c757d',
    marginBottom: '30px',
    lineHeight: 1.6
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '8px'
  },
  input: {
    padding: '12px',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'border-color 0.3s ease',
    outline: 'none'
  },
  select: {
    padding: '12px',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'border-color 0.3s ease',
    outline: 'none',
    background: 'white'
  },
  textarea: {
    padding: '12px',
    border: '2px solid #e9ecef',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'border-color 0.3s ease',
    outline: 'none',
    resize: 'vertical',
    minHeight: '120px'
  },
  submitButton: {
    background: 'linear-gradient(135deg, #3498db, #2980b9)',
    color: 'white',
    border: 'none',
    padding: '15px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    alignSelf: 'flex-start'
  },
  quickContact: {
    background: '#f8f9fa',
    borderRadius: '12px',
    padding: '30px',
    textAlign: 'center'
  },
  quickContactTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '20px',
    margin: '0 0 20px 0'
  },
  contactMethods: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px'
  },
  contactMethod: {
    display: 'flex',
    gap: '15px',
    alignItems: 'flex-start'
  },
  contactIcon: {
    fontSize: '24px'
  },
  contactMethodTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '5px',
    margin: '0 0 5px 0'
  },
  contactMethodText: {
    fontSize: '14px',
    color: '#6c757d',
    marginBottom: '3px',
    margin: '0 0 3px 0'
  },
  contactMethodNote: {
    fontSize: '12px',
    color: '#adb5bd',
    margin: 0
  },
  successContainer: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  successIcon: {
    fontSize: '80px',
    marginBottom: '20px'
  },
  successTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '15px',
    margin: '0 0 15px 0'
  },
  successMessage: {
    fontSize: '18px',
    color: '#7f8c8d',
    lineHeight: 1.6,
    marginBottom: '30px',
    maxWidth: '500px',
    margin: '0 auto 30px auto'
  },
  button: {
    background: 'linear-gradient(135deg, #3498db, #2980b9)',
    color: 'white',
    border: 'none',
    padding: '12px 30px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease'
  },
  formStatus: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    fontWeight: '500'
  }
};

// Add CSS for input focus states
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  input:focus, select:focus, textarea:focus {
    border-color: #3498db !important;
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1) !important;
  }
  
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }
  
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr !important;
    }
  }
`;
document.head.appendChild(styleSheet);

export default SupportPage; 