import { Router } from 'express';

import healthRoutes from '../modules/health/health.routes';
import systemRoutes from '../modules/system/system.routes';
import authRoutes from '../modules/auth/auth.routes';
import userRoutes from '../modules/user/user.routes';
import vendorRoutes from '../modules/vendor/vendor.routes';
import productRoutes from '../modules/product/product.routes';
import categoryRoutes from '../modules/category/category.routes';
import catalogRoutes from '../modules/catalog/catalog.routes';
import { cartRoutes, wishlistRoutes } from '../modules/cart/cart.routes';
import orderRoutes from '../modules/order/order.routes';
import paymentRoutes from '../modules/payment/payment.routes';
import { reviewRoutes, couponRoutes, flashSaleRoutes } from '../modules/review/review.routes';
import { shippingRoutes, settingsRoutes, adminRoutes } from '../modules/shipping/shipping.routes';
import { notificationRoutes, chatRoutes, ticketRoutes } from '../modules/notification/notification.routes';
import { trackingRoutes, analyticsRoutes, searchRoutes, uploadRoutes } from '../modules/analytics/analytics.routes';
import contentRoutes from '../modules/content/content.routes';
import {
  loyaltyRoutes,
  referralRoutes,
  giftCardRoutes,
  templateRoutes,
} from '../modules/engagement/engagement.routes';
import { getSpec } from '../docs/swagger.routes';

const apiRoutes = Router();

// ── Always available (bypass maintenance mode, no auth) ─────────────────────
apiRoutes.use('/health', healthRoutes);
apiRoutes.use('/version', systemRoutes);
apiRoutes.get('/docs.json', (_req, res) => res.json(getSpec()));

// ── Module routes (auth module is public; guards live inside each route) ────
apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/users', userRoutes);
apiRoutes.use('/vendors', vendorRoutes);
apiRoutes.use('/products', productRoutes);
apiRoutes.use('/categories', categoryRoutes);
apiRoutes.use(catalogRoutes);
apiRoutes.use('/cart', cartRoutes);
apiRoutes.use('/wishlist', wishlistRoutes);
apiRoutes.use('/orders', orderRoutes);
apiRoutes.use('/payments', paymentRoutes);
apiRoutes.use('/reviews', reviewRoutes);
apiRoutes.use('/coupons', couponRoutes);
apiRoutes.use('/flash-sales', flashSaleRoutes);
apiRoutes.use('/shipping', shippingRoutes);
apiRoutes.use('/settings', settingsRoutes);
apiRoutes.use('/admin', adminRoutes);
apiRoutes.use('/notifications', notificationRoutes);
apiRoutes.use('/chat', chatRoutes);
apiRoutes.use('/tickets', ticketRoutes);
apiRoutes.use('/tracking', trackingRoutes);
apiRoutes.use('/analytics', analyticsRoutes);
apiRoutes.use('/search', searchRoutes);
apiRoutes.use('/upload', uploadRoutes);
apiRoutes.use('/content', contentRoutes);
apiRoutes.use('/loyalty', loyaltyRoutes);
apiRoutes.use('/referrals', referralRoutes);
apiRoutes.use('/gift-cards', giftCardRoutes);
apiRoutes.use('/templates', templateRoutes);

export { apiRoutes };
export default apiRoutes;