import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth.js';
import { subscriptionModel } from '../db/models.js';
import { trackEvent, AnalyticsEvents } from '../services/analytics.js';
import { logger } from '../utils/logger.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function billingRoutes(fastify: FastifyInstance) {
  // Create checkout session
  fastify.post('/create-checkout-session', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.id;
    const existing = await subscriptionModel.findByUserId(userId);

    if (existing?.status === 'ACTIVE') {
      return reply.status(400).send({ error: 'Already subscribed' });
    }

    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY;
    if (!priceId) {
      return reply.status(500).send({ error: 'Stripe price not configured' });
    }

    const session = await stripe.checkout.sessions.create({
      // customer_email would need to be fetched from user
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId,
      },
    });

    return { url: session.url };
  });

  // Create portal session
  fastify.post('/create-portal-session', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const subscription = await subscriptionModel.findByUserId(request.user!.id);

    if (!subscription?.stripe_customer_id) {
      return reply.status(400).send({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/settings`,
    });

    return { url: session.url };
  });

  // Stripe webhook (no auth - handled by webhook secret)
  fastify.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(request.body as string, sig, webhookSecret);
      } else {
        event = JSON.parse(request.body as string);
      }
    } catch (err) {
      logger.error({ err }, 'Webhook signature verification failed');
      return reply.status(400).send({ error: 'Webhook signature verification failed' });
    }

    // Handle subscription events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
          
          await subscriptionModel.upsert({
            userId,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: session.customer as string,
            status: 'ACTIVE',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          });

          trackEvent(AnalyticsEvents.SUBSCRIPTION_CREATED, { subscriptionId: subscription.id }, userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Find user by stripe_subscription_id
        const existing = await subscriptionModel.findByUserId(subscription.id); // This won't work, need to fix
        
        await subscriptionModel.upsert({
          userId: subscription.metadata.userId || '',
          status: subscription.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Would need to find by stripe_subscription_id and update status
        trackEvent(AnalyticsEvents.SUBSCRIPTION_CANCELLED, { subscriptionId: subscription.id });
        break;
      }
    }

    return { received: true };
  });

  // Get subscription status
  fastify.get('/subscription', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const subscription = await subscriptionModel.findByUserId(request.user!.id);

    return {
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
        currentPeriodEnd: subscription.current_period_end,
      } : null,
    };
  });
}
