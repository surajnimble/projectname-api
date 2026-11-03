/**
 * Seeds the static content and inbound marketing rows: pages, blogs, FAQs,
 * contact messages and newsletter subscribers.
 */
import { PrismaClient } from '@prisma/client';
import { daysFromNow, demoId, seedRow, seedRowBy } from './helpers';
import type { IdentityContext } from './types';

/** Adds the policy pages and blog posts the public content routes serve. */
const seedContent = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  superAdminId: string,
): Promise<void> => {
  for (const [index, page] of [
    {
      title: 'Privacy Policy',
      slug: 'privacy-policy',
      content: 'We collect only what is needed to fulfil your orders.',
    },
    {
      title: 'Return Policy',
      slug: 'return-policy',
      content: 'Returns are accepted within 7 days of delivery.',
    },
  ].entries()) {
    await seedRowBy(prisma, 'page', { slug: page.slug }, demoId('page', index + 1), {
      ...page,
      isPublished: true,
      metaTitle: page.title,
      metaDescription: page.content,
    });
  }

  for (const [index, blog] of [
    {
      title: 'Five ways to style a cotton shirt',
      slug: 'five-ways-to-style-a-cotton-shirt',
      excerpt: 'A cotton shirt works for the office and the weekend.',
      content: 'Start with a neutral shirt, then layer textures and colours.',
      tags: ['fashion', 'style'],
    },
    {
      title: 'Choosing the right smart watch',
      slug: 'choosing-the-right-smart-watch',
      excerpt: 'Battery, sensors and size are the three things that matter.',
      content: 'Pick a battery that lasts a week and a strap you can wear daily.',
      tags: ['electronics', 'guide'],
    },
    {
      title: 'How returns work',
      slug: 'how-returns-work',
      excerpt: 'A short walkthrough of the return and refund flow.',
      content: 'Raise a request from the order screen and keep the packaging.',
      tags: ['help'],
    },
    {
      title: 'Festive sale preview',
      slug: 'festive-sale-preview',
      excerpt: 'What is coming up in the festive sale.',
      content: 'Expect discounts across electronics, fashion and home.',
      tags: ['sale', 'promo'],
    },
  ].entries()) {
    await seedRowBy(prisma, 'blog', { slug: blog.slug }, demoId('blog', index + 1), {
      ...blog,
      coverImage: `https://picsum.photos/seed/${blog.slug}/1200/600`,
      authorId: superAdminId,
      isPublished: true,
      publishedAt: daysFromNow(-10 + index),
    });
  }

  await seedRow(prisma, 'faq', demoId('faq', 'shipping'), {
    question: 'Do you ship internationally?',
    answer: 'Yes. International shipping takes 7-15 business days.',
    category: 'shipping',
    sortOrder: 5,
    isActive: true,
  });

  void identity;
};

/** Adds contact form submissions and newsletter subscribers. */
const seedInbound = async (prisma: PrismaClient): Promise<void> => {
  for (const [index, submission] of [
    {
      name: 'Deepak Joshi',
      email: 'deepak@example.com',
      subject: 'Bulk order enquiry',
      message: 'Do you offer bulk pricing for corporate gifting?',
      isRead: false,
    },
    {
      name: 'Meera Nair',
      email: 'meera@example.com',
      subject: 'Delivery timing',
      message: 'Can I schedule delivery for the weekend?',
      isRead: true,
    },
    {
      name: 'Karan Malhotra',
      email: 'karan@example.com',
      subject: 'Invoice request',
      message: 'Please share the GST invoice for my last order.',
      isRead: false,
    },
    {
      name: 'Anita Desai',
      email: 'anita@example.com',
      subject: 'Partnership',
      message: 'I would like to sell on your marketplace.',
      isRead: true,
    },
  ].entries()) {
    await seedRow(prisma, 'contactSubmission', demoId('contact', index + 1), {
      ...submission,
      phone: `+9198765432${10 + index}`,
      createdAt: daysFromNow(-4 + index),
    });
  }

  for (const [index, subscriber] of [
    'subscriber1@example.com',
    'subscriber2@example.com',
    'subscriber3@example.com',
    'subscriber4@example.com',
  ].entries()) {
    await seedRowBy(
      prisma,
      'newsletterSubscriber',
      { email: subscriber },
      demoId('newsletter', index + 1),
      {
        email: subscriber,
        isActive: true,
        isSubscribed: true,
        token: `demo-newsletter-token-${index + 1}`,
      },
    );
  }
};

/** Seeds every content row. */
export const seedContentModule = async (
  prisma: PrismaClient,
  identity: IdentityContext,
  superAdminId: string,
): Promise<void> => {
  await seedContent(prisma, identity, superAdminId);
  await seedInbound(prisma);

  // eslint-disable-next-line no-console
  console.log('[seed]   content (pages, blogs, FAQs, contact, newsletter) — done');
};
