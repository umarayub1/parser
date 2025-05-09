import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { selectUser } from '../store/authSlice';
import ApiClient from '../components/ApiClient';
import config from '../config';
import '../styles/api-docs.css';

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

const ApiExamplesPage = () => {
  const user = useSelector(selectUser);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeTab, setActiveTab] = useState('examples');

  // Fetch API keys
  useEffect(() => {
    if (!user) return;

    const fetchApiKeys = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const keys = await ApiClient.getApiKeys();
        setApiKeys(keys || []);
        
        // Auto-select the first active key
        const activeKey = keys.find(key => key.is_active);
        if (activeKey) {
          setSelectedKey(activeKey.id);
        }
      } catch (err) {
        console.error('Error fetching API keys:', err);
        setError('Failed to load API keys. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchApiKeys();
  }, [user]);

  // Get selected API key
  const getSelectedKeyPrefix = () => {
    if (!selectedKey) return 'YOUR_API_KEY';
    const key = apiKeys.find(k => k.id === selectedKey);
    return key ? key.key_prefix : 'YOUR_API_KEY';
  };

  // Generate code examples with the selected API key
  const nodeJsExample = `const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function parseBankStatement() {
  try {
    // Create form data with the PDF file
    const formData = new FormData();
    formData.append('file', fs.createReadStream('path/to/statement.pdf'));
    
    // Optional: Add callback URL
    // formData.append('callback_url', 'https://your-callback-url.com/webhook');

    // Call the parsing API
    const response = await axios.post(
      '${config.apiBaseUrl}/parse-pdf',
      formData,
      {
        headers: {
          'Authorization': 'Bearer ${getSelectedKeyPrefix()}...rest_of_your_key',
          ...formData.getHeaders()
        }
      }
    );

    console.log('Parsing job submitted:', response.data);
    
    // Check status later using the requestId
    const requestId = response.data.requestId;
    const statusResponse = await axios.get(
      \`${config.apiBaseUrl}/parse-status/\${requestId}\`,
      {
        headers: {
          'Authorization': 'Bearer ${getSelectedKeyPrefix()}...rest_of_your_key'
        }
      }
    );
    
    console.log('Parsing status:', statusResponse.data);
    
    return statusResponse.data;
  } catch (error) {
    console.error('Error parsing bank statement:', error.response?.data || error.message);
    throw error;
  }
}

parseBankStatement();`;

  const pythonExample = `import requests
import os

def parse_bank_statement():
    try:
        # Open the PDF file
        with open('path/to/statement.pdf', 'rb') as file:
            # Create form data with the PDF file
            files = {'file': (os.path.basename(file.name), file, 'application/pdf')}
            
            # Optional: Add callback URL
            # data = {'callback_url': 'https://your-callback-url.com/webhook'}
            
            # Call the parsing API
            response = requests.post(
                '${config.apiBaseUrl}/parse-pdf',
                files=files,
                # data=data,  # Uncomment if adding callback URL
                headers={
                    'Authorization': 'Bearer ${getSelectedKeyPrefix()}...rest_of_your_key'
                }
            )
            
            response.raise_for_status()
            result = response.json()
            print('Parsing job submitted:', result)
            
            # Check status later using the requestId
            request_id = result['requestId']
            status_response = requests.get(
                f'${config.apiBaseUrl}/parse-status/{request_id}',
                headers={
                    'Authorization': 'Bearer ${getSelectedKeyPrefix()}...rest_of_your_key'
                }
            )
            
            status_response.raise_for_status()
            status_result = status_response.json()
            print('Parsing status:', status_result)
            
            return status_result
            
    except requests.exceptions.RequestException as e:
        print('Error parsing bank statement:', e)
        raise

parse_bank_statement()`;

  const cURLExample = `# Submit a PDF for parsing
curl -X POST \\
  ${config.apiBaseUrl}/parse-pdf \\
  -H 'Authorization: Bearer ${getSelectedKeyPrefix()}...rest_of_your_key' \\
  -F 'file=@/path/to/statement.pdf'

# Check parsing status (replace REQUEST_ID with the ID from the response above)
curl -X GET \\
  ${config.apiBaseUrl}/parse-status/REQUEST_ID \\
  -H 'Authorization: Bearer ${getSelectedKeyPrefix()}...rest_of_your_key'`;

  return (
    <div className="api-docs-container">
      <div className="api-nav-tabs">
        <div className="api-tabs-wrapper">
          <Link 
            to="/api-docs" 
            className={`api-tab ${activeTab === 'documentation' ? 'active' : ''}`}
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
            onClick={() => setActiveTab('examples')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            Code Examples
          </Link>
        </div>
      </div>
      
      <h1>API Usage Examples</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="api-key-selector">
        <label htmlFor="api-key-select">Select API Key: </label>
        <select 
          id="api-key-select"
          value={selectedKey || ''}
          onChange={(e) => setSelectedKey(e.target.value)}
          disabled={loading || apiKeys.length === 0}
        >
          {apiKeys.length === 0 && <option value="">No API keys available</option>}
          {apiKeys.map(key => (
            <option key={key.id} value={key.id} disabled={!key.is_active}>
              {key.name} ({key.key_prefix}...) {!key.is_active ? '(inactive)' : ''}
            </option>
          ))}
        </select>
        
        {apiKeys.length === 0 && !loading && (
          <p>
            <Link to="/api-docs">Create an API key</Link> to see personalized code examples.
          </p>
        )}
      </div>
      
      <div className="example-sections">
        <section className="example-section">
          <h2>Node.js Example</h2>
          <p>Parse a bank statement using Node.js and Axios:</p>
          <CodeBlock language="javascript">{nodeJsExample}</CodeBlock>
        </section>
        
        <section className="example-section">
          <h2>Python Example</h2>
          <p>Parse a bank statement using Python and Requests:</p>
          <CodeBlock language="python">{pythonExample}</CodeBlock>
        </section>
        
        <section className="example-section">
          <h2>cURL Example</h2>
          <p>Parse a bank statement using cURL:</p>
          <CodeBlock language="bash">{cURLExample}</CodeBlock>
        </section>
      </div>
      
      <section className="api-endpoints">
        <h2>API Endpoints</h2>
        <table className="endpoints-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Method</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>/api/parse-pdf</code></td>
              <td>POST</td>
              <td>Submit a PDF for parsing. Requires <code>multipart/form-data</code> with a <code>file</code> field.</td>
            </tr>
            <tr>
              <td><code>/api/parse-status/:requestId</code></td>
              <td>GET</td>
              <td>Check the status of a parsing request.</td>
            </tr>
            <tr>
              <td><code>/api/verify-key</code></td>
              <td>GET</td>
              <td>Verify an API key and get details about the key and user.</td>
            </tr>
          </tbody>
        </table>
      </section>
      
      <section className="api-authentication">
        <h2>Authentication</h2>
        <p>All API requests require authentication using your API key. Pass the key in the <code>Authorization</code> header:</p>
        <CodeBlock language="http">
          Authorization: Bearer ${getSelectedKeyPrefix()}...rest_of_your_key
        </CodeBlock>
        <p>Alternatively, you can use the <code>X-API-Key</code> header:</p>
        <CodeBlock language="http">
          X-API-Key: Bearer ${getSelectedKeyPrefix()}...rest_of_your_key
        </CodeBlock>
      </section>
    </div>
  );
};

export default ApiExamplesPage; 