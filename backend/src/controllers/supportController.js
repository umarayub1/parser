import { supabaseAdmin } from '../services/supabase.js';

/**
 * Submit a support/contact form
 */
export const submitSupportRequest = async (req, res) => {
  try {
    const { name, email, subject, message, category } = req.body;
    const user = req.user; // Will be null if not authenticated
    
    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, subject, and message are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Prepare message data
    const messageData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      category: category || 'general'
    };

    // Add user_id if the user is logged in
    if (user?.id) {
      messageData.user_id = user.id;
    }

    // Submit to Supabase contact_messages table
    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .insert([messageData])
      .select()
      .single();

    if (error) {
      console.error('Error inserting contact message:', error);
      throw error;
    }

    console.log('Support request submitted successfully:', data.id);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Your support request has been submitted successfully. We will get back to you soon!',
      data: {
        id: data.id,
        created_at: data.created_at
      }
    });

  } catch (error) {
    console.error('Error submitting support request:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to submit support request. Please try again later.'
    });
  }
};

/**
 * Get support requests for a user (if authenticated)
 */
export const getUserSupportRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data, error } = await supabaseAdmin
      .from('contact_messages')
      .select('id, subject, category, created_at, message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Error fetching user support requests:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support requests'
    });
  }
}; 