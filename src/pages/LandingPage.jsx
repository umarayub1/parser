import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/landing-page.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Transform Your <span className="highlight">Bank Statements</span> into <span className="highlight-secondary">Actionable Insights</span>
          </h1>
          <p className="hero-subtitle">
            Effortlessly extract, categorize, and analyze your financial data with our AI-powered statement parser
          </p>
          <div className="hero-buttons">
            <Link to="/signup" className="btn btn-primary">
              Get Started — It's Free
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Sign In
            </Link>
          </div>
        </div>
        <div className="hero-image">
          <img src="/hero-graphic.svg" alt="Bank statement transformed into insights" />
          <div className="floating-card card-1">
            <div className="icon">📊</div>
            <div className="text">98% Accuracy</div>
          </div>
          <div className="floating-card card-2">
            <div className="icon">⚡</div>
            <div className="text">10x Faster</div>
          </div>
          <div className="floating-card card-3">
            <div className="icon">🔒</div>
            <div className="text">Bank-Level Security</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">Powerful Features at Your Fingertips</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h3>Intelligent Recognition</h3>
            <p>Our AI technology identifies transactions, balances, and account details with unprecedented accuracy</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>API Integration</h3>
            <p>Seamlessly integrate with your existing tools through our robust API for automated processing</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🚀</div>
            <h3>Instant Processing</h3>
            <p>Upload your statements and get structured, analysis-ready data in seconds</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💡</div>
            <h3>Smart Categorization</h3>
            <p>Automatically categorize transactions for better financial insights and reporting</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section">
        <div className="testimonial-container">
          <h2 className="section-title">Trusted by Financial Professionals</h2>
          <div className="testimonials-carousel">
            <div className="testimonial-card">
              <div className="quote">"This tool has saved our accounting team countless hours of manual data entry. The accuracy is remarkable."</div>
              <div className="author">
                <div className="author-image"></div>
                <div className="author-details">
                  <div className="author-name">Sarah Johnson</div>
                  <div className="author-position">CFO, TechGrowth</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Upload Your Statement</h3>
              <p>Simply upload your bank statement PDF through our secure platform</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>AI-Powered Processing</h3>
              <p>Our advanced algorithms extract and organize all financial data</p>
            </div>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Get Structured Results</h3>
              <p>Download your data in JSON format or access it through our API</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Transform Your Financial Data?</h2>
          <p>Join thousands of users who have simplified their financial analysis</p>
          <Link to="/signup" className="btn btn-primary btn-large">
            Get Started For Free
          </Link>
        </div>
        <div className="cta-features">
          <div className="cta-feature">
            <div className="check-icon">✓</div>
            <div>No credit card required</div>
          </div>
          <div className="cta-feature">
            <div className="check-icon">✓</div>
            <div>Free trial</div>
          </div>
          <div className="cta-feature">
            <div className="check-icon">✓</div>
            <div>Cancel anytime</div>
          </div>
        </div>
      </section>

      {/* Supported Banks */}
      <section className="banks-section">
        <h2 className="section-title">Works With All Major Banks</h2>
        <div className="banks-logos">
          <div className="bank-logo">Bank of America</div>
          <div className="bank-logo">Chase</div>
          <div className="bank-logo">Wells Fargo</div>
          <div className="bank-logo">Citi</div>
          <div className="bank-logo">Capital One</div>
          <div className="bank-logo">And many more...</div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage; 