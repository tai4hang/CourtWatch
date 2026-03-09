import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { authenticate } from '../middleware/auth.js';
import { PrismaClient } from '@prisma/client';
import { trackEvent, AnalyticsEvents } from '../services/analytics.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export async function billingRoutes(fastify: FastifyInstance) {
  // Create checkout session
  fastify.post('/create-checkout-session', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: { subscription: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (user.subscription?.status === 'active') {
      return reply.status(400).send({ error: 'Already subscribed' });
    }

    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY;
    if (!priceId) {
      return reply.status(500).send({ error: 'Stripe price not configured' });
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
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
        userId: user.id,
      },
    });

    return { url: session.url };
  });

  // Create portal session
  fastify.post('/create-portal-session', { preHandler: authenticate }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      include: { subscription: true },
    });

    if (!user?.subscription?.stripeCustomerId) {
      return reply.status(400).send({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
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
          
          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: session.customer as string,
              status: 'active',
              plan: 'monthly',
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
            update: {
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: session.customer as string,
              status: 'active',
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });

          trackEvent(AnalyticsEvents.SUBSCRIPTION_CREATED, { subscriptionId: subscription.id }, userId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status === 'active' ? 'active' : 'past_due',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'cancelled',
          },
        });

        trackEvent(AnalyticsEvents.SUBSCRIPTION_CANCELLED, { subscriptionId: subscription.id });
        break;
      }
    }

    return { received: true };
  });

  // Get subscription status
  fastify.get('/subscription', { preHandler: authenticate }, async (request: FastifyRequest) => {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: request.user!.id },
    });

    return { subscription };
  });
}
