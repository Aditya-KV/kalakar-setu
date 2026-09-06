export interface SellerOrder { fulfillment_status: number; payment_status: string; total_price: number }

export function sellerSummary(orders: SellerOrder[]) {
  return {
    pending: orders.filter((order) => order.fulfillment_status < 4).length,
    toPack: orders.filter((order) => order.fulfillment_status === 1).length,
    paidSales: orders.filter((order) => order.payment_status === 'paid')
      .reduce((total, order) => total + order.total_price, 0),
    delivered: orders.filter((order) => order.fulfillment_status === 4).length,
  };
}
