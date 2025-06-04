import { createClient } from '@supabase/supabase-js';
import config from '../config/index.js';

const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey
);

/**
 * Monitor subscription health and detect anomalies
 */
export const monitorSubscriptionHealth = async () => {
  const issues = [];
  
  try {
    // Check for stuck pending subscriptions (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: stuckPending, error: pendingError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo);
      
    if (stuckPending && stuckPending.length > 0) {
      issues.push({
        type: 'stuck_pending',
        severity: 'warning',
        count: stuckPending.length,
        message: `${stuckPending.length} subscriptions stuck in pending state`,
        subscriptions: stuckPending
      });
    }
    
    // Check for subscriptions without credits allocated
    const { data: activeSubscriptions, error: activeError } = await supabase
      .from('subscriptions')
      .select('*, profiles!inner(credits_remaining)')
      .eq('status', 'active');
      
    const noCreditsSubscriptions = activeSubscriptions?.filter(
      sub => sub.profiles.credits_remaining === 0
    );
    
    if (noCreditsSubscriptions && noCreditsSubscriptions.length > 0) {
      issues.push({
        type: 'no_credits',
        severity: 'high',
        count: noCreditsSubscriptions.length,
        message: `${noCreditsSubscriptions.length} active subscriptions with no credits`,
        subscriptions: noCreditsSubscriptions
      });
    }
    
    // Check for failed webhook events - using raw SQL count instead of group
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: failedWebhooks, error: webhookError } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('processing_failed', true)
      .gte('created_at', twentyFourHoursAgo);
      
    if (failedWebhooks && failedWebhooks.length > 0) {
      // Count by event_name manually
      const eventCounts = {};
      failedWebhooks.forEach(webhook => {
        if (!eventCounts[webhook.event_name]) {
          eventCounts[webhook.event_name] = 0;
        }
        eventCounts[webhook.event_name]++;
      });
      
      // Convert to array of {event_name, count}
      const breakdown = Object.entries(eventCounts).map(([event_name, count]) => ({
        event_name,
        count
      }));
      
      issues.push({
        type: 'failed_webhooks',
        severity: 'high',
        count: failedWebhooks.length,
        message: 'Failed webhook events detected',
        breakdown
      });
    }
    
    // Check for duplicate active subscriptions per user - using client-side grouping
    const { data: activeUserSubscriptions, error: dupError } = await supabase
      .from('subscriptions')
      .select('user_id, id')
      .eq('status', 'active');
      
    if (activeUserSubscriptions && activeUserSubscriptions.length > 0) {
      // Group by user_id and count
      const userCounts = {};
      activeUserSubscriptions.forEach(sub => {
        if (!userCounts[sub.user_id]) {
          userCounts[sub.user_id] = 0;
        }
        userCounts[sub.user_id]++;
      });
      
      // Filter users with more than 1 subscription
      const duplicates = Object.entries(userCounts)
        .filter(([userId, count]) => count > 1)
        .map(([user_id, count]) => ({ user_id, count }));
      
      if (duplicates.length > 0) {
        issues.push({
          type: 'duplicate_subscriptions',
          severity: 'critical',
          count: duplicates.length,
          message: `${duplicates.length} users with multiple active subscriptions`,
          users: duplicates
        });
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error monitoring subscription health:', error);
    return {
      healthy: false,
      issues: [{
        type: 'monitoring_error',
        severity: 'critical',
        message: error.message
      }],
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Send alert for critical subscription issues
 * In production, this should integrate with your alerting system (email, Slack, etc.)
 */
export const sendSubscriptionAlert = async (issues) => {
  const criticalIssues = issues.filter(issue => 
    issue.severity === 'critical' || issue.severity === 'high'
  );
  
  if (criticalIssues.length > 0) {
    console.error('CRITICAL SUBSCRIPTION ISSUES DETECTED:', criticalIssues);
    
    // In production, implement actual alerting:
    // - Send email to admin
    // - Post to Slack channel
    // - Create PagerDuty incident
    // - Log to monitoring service
    
    // For now, just log to webhook_events for visibility
    await supabase
      .from('webhook_events')
      .insert({
        id: `alert-${Date.now()}`,
        event_name: 'subscription_health_alert',
        event_data: { issues: criticalIssues },
        processing_failed: false,
        created_at: new Date().toISOString()
      });
  }
};

/**
 * Run periodic health check
 */
export const runHealthCheck = async () => {
  const health = await monitorSubscriptionHealth();
  
  if (!health.healthy) {
    await sendSubscriptionAlert(health.issues);
  }
  
  return health;
}; 