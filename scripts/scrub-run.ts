import { prisma } from '../src/services/prisma.service';

const main = async () => {
  const run = process.argv[2];
  const users = await prisma.user.findMany({
    where: { email: { contains: `or_${run}@` } },
    select: { id: true, email: true },
  });
  for (const u of users) {
    const orders = await prisma.order.findMany({ where: { userId: u.id }, select: { id: true } });
    const ids = orders.map((o) => o.id);
    await prisma.orderTimeline.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.delivery.deleteMany({ where: { subOrder: { orderId: { in: ids } } } });
    await prisma.shipment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.subOrder.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.couponUsage.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.walletTransaction.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
  console.log(`scrubbed ${users.length} users for run ${run}`);
  await prisma.$disconnect();
};

main();
