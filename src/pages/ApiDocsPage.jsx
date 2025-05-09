import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';
import '../styles/api-docs.css';
import ApiClient from '../components/ApiClient';
import config from '../config';
import { Link } from 'react-router-dom';

// Code Block component for copyable code examples
const CodeBlock = ({ language, children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-language">{language}</span>
        <button 
          className="code-copy-button" 
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="code-block">
        <code>{children}</code>
      </pre>
    </div>
  );
};

const ApiDocsPage = () => {
  const user = useSelector(selectUser);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [keyName, setKeyName] = useState('');
  const [expiresIn, setExpiresIn] = useState('never');
  const [newKey, setNewKey] = useState(null);
  const [apiRequests, setApiRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [activeTab, setActiveTab] = useState('documentation');

  // Fetch API keys
  useEffect(() => {
    if (!user) return;

    const fetchApiKeys = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const keys = await ApiClient.getApiKeys();
        setApiKeys(keys || []);
      } catch (err) {
        console.error('Error fetching API keys:', err);
        setError('Failed to load API keys. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchApiKeys();
  }, [user]);

  // Create API key
  const handleCreateKey = async (e) => {
    e.preventDefault();
    
    if (!keyName.trim()) {
      setError('Please enter a name for your API key');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await ApiClient.createApiKey(keyName, expiresIn);
      
      // Show the full key to the user (only time they'll see it)
      setNewKey(response.apiKey);
      setSuccess('API key created successfully! Make sure to copy it now, as you won\'t be able to see it again.');
      
      // Reset form
      setKeyName('');
      setExpiresIn('never');
      
      // Refresh key list
      const keys = await ApiClient.getApiKeys();
      setApiKeys(keys || []);
    } catch (err) {
      console.error('Error creating API key:', err);
      setError(err.message || 'Failed to create API key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete API key
  const handleDeleteKey = async (keyId) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await ApiClient.deleteApiKey(keyId);
      
      // Update state to remove deleted key
      setApiKeys(apiKeys.filter(key => key.id !== keyId));
      setSuccess('API key deleted successfully');
    } catch (err) {
      console.error('Error deleting API key:', err);
      setError(err.message || 'Failed to delete API key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle key active state
  const handleToggleKeyActive = async (keyId, isCurrentlyActive) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await ApiClient.updateApiKey(keyId, !isCurrentlyActive);
      
      // Update state
      setApiKeys(apiKeys.map(key => 
        key.id === keyId ? { ...key, is_active: !isCurrentlyActive } : key
      ));
      
      setSuccess(`API key ${!isCurrentlyActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      console.error('Error updating API key:', err);
      setError(err.message || 'Failed to update API key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch recent API requests
  const handleViewRequests = async (keyId) => {
    try {
      setLoadingRequests(true);
      setError(null);
      
      const requests = await ApiClient.getApiRequests(keyId);
      setApiRequests(requests || []);
      setActiveTab('requests');
    } catch (err) {
      console.error('Error fetching API requests:', err);
      setError(err.message || 'Failed to load API requests. Please try again.');
    } finally {
      setLoadingRequests(false);
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  // Calculate days remaining
  const getDaysRemaining = (expiryDate) => {
    if (!expiryDate) return 'Never expires';
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Expired';
    return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
  };

  // Render API key table
  const renderApiKeysTable = () => {
    if (loading) return <p className="loading-message">Loading API keys...</p>;
    if (apiKeys.length === 0) return <p>You haven't created any API keys yet.</p>;
    
    return (
      <div className="api-keys-table-wrapper">
        <table className="api-keys-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Prefix</th>
              <th>Created</th>
              <th>Last Used</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {apiKeys.map(key => (
              <tr key={key.id} className={!key.is_active ? 'inactive-key' : ''}>
                <td>{key.name}</td>
                <td><code>{key.key_prefix}</code></td>
                <td>{formatDate(key.created_at)}</td>
                <td>{formatDate(key.last_used_at) || 'Never'}</td>
                <td>{formatDate(key.expires_at) || 'Never'} {key.expires_at && <span className="days-remaining">({getDaysRemaining(key.expires_at)})</span>}</td>
                <td>
                  <span className={`status-badge ${key.is_active ? 'status-active' : 'status-inactive'}`}>
                    {key.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="key-actions">
                  <button 
                    className="action-button toggle-button" 
                    onClick={() => handleToggleKeyActive(key.id, key.is_active)}
                    title={key.is_active ? 'Deactivate key' : 'Activate key'}
                  >
                    {key.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button 
                    className="action-button view-button" 
                    onClick={() => handleViewRequests(key.id)}
                    title="View requests made with this key"
                  >
                    View Requests
                  </button>
                  <button 
                    className="action-button delete-button" 
                    onClick={() => handleDeleteKey(key.id)}
                    title="Delete this API key"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render API requests table
  const renderApiRequestsTable = () => {
    if (loadingRequests) return <p className="loading-message">Loading API requests...</p>;
    if (apiRequests.length === 0) return <p>No API requests found for this key.</p>;
    
    return (
      <div className="api-requests-table-wrapper">
        <h3>Recent API Requests</h3>
        <button className="back-button" onClick={() => setActiveTab('keys')}>
          Back to API Keys
        </button>
        <table className="api-requests-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Endpoint</th>
              <th>Method</th>
              <th>Status</th>
              <th>Response Time</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {apiRequests.map(req => (
              <tr key={req.id} className={req.status_code >= 400 ? 'error-request' : ''}>
                <td>{formatDate(req.request_timestamp)}</td>
                <td>{req.endpoint}</td>
                <td>{req.method}</td>
                <td>
                  <span className={`status-code ${req.status_code >= 400 ? 'error-status' : 'success-status'}`}>
                    {req.status_code}
                  </span>
                </td>
                <td>{req.response_time_ms} ms</td>
                <td>{req.request_ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="api-docs-container">
      <div className="api-nav-tabs">
        <div className="api-tabs-wrapper">
          <Link 
            to="/api-docs" 
            className={`api-tab ${activeTab === 'documentation' ? 'active' : ''}`}
            onClick={() => setActiveTab('documentation')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            API Keys & Management
          </Link>
          <Link 
            to="/api-examples" 
            className={`api-tab ${activeTab === 'examples' ? 'active' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            Code Examples
          </Link>
        </div>
      </div>

      <h1>API Documentation</h1>
      
      <div className="tabs">
        <button 
          className={`tab-button ${activeTab === 'documentation' ? 'active' : ''}`}
          onClick={() => setActiveTab('documentation')}
        >
          Documentation
        </button>
        <button 
          className={`tab-button ${activeTab === 'keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('keys')}
        >
          API Keys
        </button>
        {activeTab === 'requests' && (
          <button 
            className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
          >
            API Requests
          </button>
        )}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {newKey && (
        <div className="new-key-container">
          <h3>Your New API Key</h3>
          <p>Copy this key now. You won't be able to see it again!</p>
          <div className="key-display">
            <code>{newKey}</code>
            <button 
              className="copy-button"
              onClick={() => {
                navigator.clipboard.writeText(newKey);
                alert('API key copied to clipboard!');
              }}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <div className="tab-content">
        {activeTab === 'documentation' && (
          <div className="documentation-section">
            <section className="api-section">
              <h2>Getting Started</h2>
              <p>
                Our API allows you to programmatically parse bank statements. To use the API:
              </p>
              <ol>
                <li>Create an API key in the <button className="link-button" onClick={() => setActiveTab('keys')}>API Keys</button> tab</li>
                <li>Use the key to authenticate your requests</li>
                <li>Submit PDFs for parsing</li>
                <li>Check the status of your parsing jobs</li>
                <li>Retrieve the parsed data</li>
              </ol>
            </section>

            <section className="api-section">
              <h2>Authentication</h2>
              <p>
                All API requests require authentication using an API key. You can pass your API key in one of two ways:
              </p>
              <ul>
                <li>
                  <strong>Authorization header:</strong>
                  <code>Authorization: Bearer bp_abc123.your_full_key</code>
                </li>
                <li>
                  <strong>X-API-Key header:</strong>
                  <code>X-API-Key: Bearer bp_abc123.your_full_key</code>
                </li>
              </ul>
            </section>

            <section className="api-section">
              <h2>Endpoints</h2>
              
              <div className="endpoint">
                <h3>Parse PDF</h3>
                <div className="endpoint-details">
                  <p>
                    <span className="method post">POST</span>
                    <code>/api/parse-pdf</code>
                  </p>
                  <div className="description">
                    <p>Upload a PDF bank statement for parsing.</p>
                    
                    <h4>Request</h4>
                    <p>Content-Type: <code>multipart/form-data</code></p>
                    <p>Form Fields:</p>
                    <ul>
                      <li><code>file</code> - The PDF file to parse (required)</li>
                      <li><code>callback_url</code> - Optional URL that will receive a POST request when parsing is complete</li>
                    </ul>
                    
                    <h4>Response</h4>
                    <p>Status: <code>202 Accepted</code></p>
                    <CodeBlock language="json">{`{
  "success": true,
  "message": "PDF parsing job submitted successfully",
  "requestId": "uuid-of-request",
  "estimatedTime": "40 seconds"
}`}</CodeBlock>

                    <h4>Errors</h4>
                    <ul>
                      <li><code>400 Bad Request</code> - PDF file is missing or invalid</li>
                      <li><code>401 Unauthorized</code> - Invalid API key</li>
                      <li><code>402 Payment Required</code> - Insufficient credits</li>
                      <li><code>500 Internal Server Error</code> - Server error</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="endpoint">
                <h3>Check Parsing Status</h3>
                <div className="endpoint-details">
                  <p>
                    <span className="method post">POST</span>
                    <code>/api/parse-pdf</code>
                  </p>
                  <div className="description">
                    <p>Check the status of a parsing request.</p>
                    
                    <h4>Request</h4>
                    <p>Content-Type: <code>application/json</code></p>
                    <CodeBlock language="json">{`{
  "requestId": "uuid-of-request"
}`}</CodeBlock>
                    
                    <h4>Response</h4>
                    <p>Status: <code>200 OK</code></p>
                    <CodeBlock language="json">{`{
  "success": true,
  "requestId": "uuid-of-request",
  "status": "processing",
  "fileName": "statement.pdf",
  "createdAt": "2023-06-29T13:45:00.000Z",
  "startedAt": "2023-06-29T13:45:10.000Z",
  "completedAt": null,
  "error": null,
  "data": null
}`}</CodeBlock>
                    <p>When parsing is complete (<code>status</code> is <code>"success"</code>), the <code>data</code> field will contain the parsed data.</p>

                    <h4>Errors</h4>
                    <ul>
                      <li><code>400 Bad Request</code> - Missing requestId</li>
                      <li><code>401 Unauthorized</code> - Invalid API key</li>
                      <li><code>404 Not Found</code> - Request not found</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="api-section">
              <h2>Parsed Data Format</h2>
              <p>
                The parsed data is returned in a structured JSON format:
              </p>
              <CodeBlock language="json">{`{
  "meta_data": {
    "Bank Name": "Example Bank",
    "Account Number": "XXXX1234",
    "Statement Period": "June 1 - June 30, 2023",
    "Opening Balance": 1000.00,
    "Closing Balance": 1500.00,
    "Currency": "USD",
    "Ending Balance Offset": 0.00
  },
  "transactions_data": [
    {
      "date": "2023-06-05",
      "description": "PAYMENT RECEIVED",
      "amount": 2000.00,
      "type": "credit",
      "category": "income",
      "balance": 3000.00
    },
    {
      "date": "2023-06-10",
      "description": "GROCERY STORE",
      "amount": -150.00,
      "type": "debit",
      "category": "groceries",
      "balance": 2850.00
    }
  ]
}`}</CodeBlock>
            </section>

            <section className="api-section">
              <h2>Callback Notifications</h2>
              <p>
                You can optionally provide a callback URL when submitting a PDF for parsing. When the parsing is complete, 
                our system will send a POST request to your callback URL with the parsing results.
              </p>
              
              <h3>Callback Request Format</h3>
              <CodeBlock language="json">{`{
  "requestId": "uuid-of-request",
  "status": "success", // or "error"
  "fileName": "statement.pdf",
  "createdAt": "2023-06-29T13:45:00.000Z",
  "completedAt": "2023-06-29T13:47:30.000Z",
  "error": null,
  "data": { /* parsed data object */ }
}`}</CodeBlock>
              
              <h3>Verifying Callbacks</h3>
              <p>
                To verify that callbacks are coming from our service, we include a signature header.
                You should validate this signature to ensure the request is authentic:
              </p>
              <CodeBlock language="json">{`// Headers included in callback request
{
  "Content-Type": "application/json",
  "X-Callback-Signature": "sha256=hash_of_payload_using_your_api_key",
  "X-Request-ID": "uuid-of-request"
}`}</CodeBlock>

              <h3>Handling Callbacks Example</h3>
              <p>Here's an example of how to handle callbacks in different programming languages:</p>
              
              <div className="code-example">
                <h4>Node.js (Express)</h4>
                <CodeBlock language="javascript">{`const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

// Your secret API key
const API_KEY = 'bp_abc123.your_full_key';

// Endpoint to receive callbacks
app.post('/api/parsing-callback', (req, res) => {
  // Get the signature from the request headers
  const signature = req.headers['x-callback-signature'];
  const requestId = req.headers['x-request-id'];
  
  // Verify the signature
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', API_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');
    
  if (signature !== expectedSignature) {
    console.error('Invalid signature');
    return res.status(401).send('Invalid signature');
  }
  
  // Parse the data
  const { status, fileName, data, error } = req.body;
  
  if (status === 'success') {
    console.log(\`Parsing completed for \${fileName}\`);
    // Process the parsed data
    // Store in database, notify user, etc.
  } else {
    console.error(\`Parsing failed for \${fileName}: \${error}\`);
    // Handle the error
  }
  
  // Always return 200 OK to acknowledge receipt
  res.status(200).send('OK');
});

app.listen(3000, () => {
  console.log('Callback server running on port 3000');
});`}</CodeBlock>
              </div>
              
              <div className="code-example">
                <h4>Python (Flask)</h4>
                <CodeBlock language="python">{`from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)

# Your secret API key
API_KEY = 'bp_abc123.your_full_key'

@app.route('/api/parsing-callback', methods=['POST'])
def parsing_callback():
    # Get the signature from the request headers
    signature = request.headers.get('X-Callback-Signature')
    request_id = request.headers.get('X-Request-ID')
    
    # Get the raw request body
    request_data = request.get_json()
    
    # Compute expected signature
    expected_signature = 'sha256=' + hmac.new(
        API_KEY.encode('utf-8'),
        json.dumps(request_data).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Verify the signature
    if not hmac.compare_digest(signature, expected_signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Parse the data
    status = request_data.get('status')
    file_name = request_data.get('fileName')
    data = request_data.get('data')
    error = request_data.get('error')
    
    if status == 'success':
        print(f'Parsing completed for {file_name}')
        # Process the parsed data
        # Store in database, notify user, etc.
    else:
        print(f'Parsing failed for {file_name}: {error}')
        # Handle the error
    
    # Always return 200 OK to acknowledge receipt
    return jsonify({'status': 'success'}), 200

if __name__ == '__main__':
    app.run(port=5000)`}</CodeBlock>
              </div>

              <div className="note-box">
                <h4>Security Best Practices</h4>
                <ul>
                  <li>Always verify the signature of incoming callbacks</li>
                  <li>Use HTTPS for your callback URL</li>
                  <li>Process callback data idempotently (same callback may be sent multiple times)</li>
                </ul>
              </div>
            </section>

            <section className="api-section">
              <h2>Rate Limits</h2>
              <p>
                API requests are limited to 100 requests per hour per API key. If you exceed the limit, you'll receive a <code>429 Too Many Requests</code> response.
              </p>
            </section>

            <section className="api-section">
              <h2>Code Examples</h2>
              
              <div className="code-example">
                <h3>cURL</h3>
                <CodeBlock language="bash">{`# Parse a PDF
curl -X POST \\
  ${config.apiBaseUrl}/parse-pdf \\
  -H "Authorization: Bearer bp_abc123.your_full_key" \\
  -F "file=@statement.pdf" \\
  -F "callback_url=https://your-app.com/api/callbacks"

# Check status
curl -X POST \\
  ${config.apiBaseUrl}/parse-pdf \\
  -H "Authorization: Bearer bp_abc123.your_full_key" \\
  -H "Content-Type: application/json" \\
  -d '{"requestId": "uuid-of-request"}'`}</CodeBlock>
              </div>
              
              <div className="code-example">
                <h3>JavaScript</h3>
                <CodeBlock language="javascript">{`// Parse a PDF
async function parsePdf(apiKey, pdfFile, callbackUrl) {
  const formData = new FormData();
  formData.append('file', pdfFile);
  
  // Add callback URL if provided
  if (callbackUrl) {
    formData.append('callback_url', callbackUrl);
  }
  
  const response = await fetch(
    '${config.apiBaseUrl}/parse-pdf',
    {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`
      },
      body: formData
    }
  );
  
  return await response.json();
}

// Check status
async function checkStatus(apiKey, requestId) {
  const response = await fetch(
    '${config.apiBaseUrl}/parse-pdf',
    {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requestId })
    }
  );
  
  return await response.json();
}`}</CodeBlock>
              </div>
              
              <div className="code-example">
                <h3>Python</h3>
                <CodeBlock language="python">{`import requests

# Parse a PDF
def parse_pdf(api_key, pdf_file_path, callback_url=None):
    url = '${config.apiBaseUrl}/parse-pdf'
    headers = {
        'Authorization': f'Bearer {api_key}'
    }
    files = {
        'file': open(pdf_file_path, 'rb')
    }
    
    # Add callback URL if provided
    data = {}
    if callback_url:
        data['callback_url'] = callback_url
    
    response = requests.post(url, headers=headers, files=files, data=data)
    return response.json()

# Check status
def check_status(api_key, request_id):
    url = '${config.apiBaseUrl}/parse-pdf'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    data = {
        'requestId': request_id
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()`}</CodeBlock>
              </div>
            </section>
          </div>
        )}
        
        {activeTab === 'keys' && (
          <div className="api-keys-section">
            <h2>API Keys</h2>
            <p>API keys are used to authenticate requests to our API. Keep your keys secure and don't share them publicly.</p>
            
            <form className="create-key-form" onSubmit={handleCreateKey}>
              <div className="form-group">
                <label htmlFor="keyName">Key Name</label>
                <input
                  type="text"
                  id="keyName"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="E.g., Production, Development, Test"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="expiresIn">Expires In</label>
                <select
                  id="expiresIn"
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                >
                  <option value="never">Never</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">365 days</option>
                </select>
              </div>
              
              <button
                type="submit"
                className="create-key-button"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create API Key'}
              </button>
            </form>
            
            <div className="api-keys-list">
              <h3>Your API Keys</h3>
              {renderApiKeysTable()}
            </div>
          </div>
        )}
        
        {activeTab === 'requests' && (
          <div className="api-requests-section">
            {renderApiRequestsTable()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiDocsPage; 